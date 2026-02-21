from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
import csv
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from merenda_semed.authentication import QueryParamJWTAuthentication

from .models import Menu, MenuItem
from .serializers import MenuItemBulkSerializer, MenuItemSerializer, MenuSerializer
from .utils import generate_menu_pdf


class MenuViewSet(viewsets.ModelViewSet):
    queryset = Menu.objects.select_related('school').prefetch_related('items').all().order_by('-week_start')
    serializer_class = MenuSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        school = self.request.query_params.get('school')
        week_start = self.request.query_params.get('week_start')
        week_end = self.request.query_params.get('week_end')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        status_value = self.request.query_params.get('status')
        if school:
            queryset = queryset.filter(school_id=school)
        if week_start:
            queryset = queryset.filter(week_start=week_start)
        if week_end:
            queryset = queryset.filter(week_end=week_end)
        if date_from:
            queryset = queryset.filter(week_start__gte=date_from)
        if date_to:
            queryset = queryset.filter(week_start__lte=date_to)
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='items/bulk')
    def items_bulk(self, request, pk=None):
        menu = self.get_object()
        serializer = MenuItemBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items_data = serializer.validated_data['items']
        MenuItem.objects.filter(menu=menu).delete()
        items = [
            MenuItem(menu=menu, **item)
            for item in items_data
        ]
        MenuItem.objects.bulk_create(items)
        return Response(MenuItemSerializer(menu.items.all(), many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        menu = self.get_object()
        menu.status = Menu.Status.PUBLISHED
        menu.published_at = timezone.now()
        menu.save(update_fields=['status', 'published_at'])
        return Response(MenuSerializer(menu).data)

    @action(detail=True, methods=['post'])
    def copy(self, request, pk=None):
        """Copy a menu to one or more schools."""
        from django.db import transaction
        from schools.models import School

        source_menu = self.get_object()

        # Accept both target_schools (list) and target_school (single) for backwards compat
        target_schools = request.data.get('target_schools')
        if not target_schools:
            single = request.data.get('target_school')
            if single:
                target_schools = [single]

        if not isinstance(target_schools, list) or not target_schools:
            return Response({'detail': 'Informe ao menos uma escola de destino.'}, status=400)

        week_start = request.data.get('week_start') or source_menu.week_start
        week_end = request.data.get('week_end') or source_menu.week_end

        # Deduplicate and validate schools
        seen = set()
        unique_ids = []
        for sid in target_schools:
            sid = str(sid).strip()
            if sid and sid not in seen:
                seen.add(sid)
                unique_ids.append(sid)

        schools = list(School.objects.filter(id__in=unique_ids))
        if len(schools) != len(unique_ids):
            found_ids = {str(s.id) for s in schools}
            missing = [sid for sid in unique_ids if sid not in found_ids]
            return Response({'detail': f'Escola(s) não encontrada(s): {", ".join(missing)}'}, status=404)

        source_items = list(source_menu.items.all())
        school_by_id = {str(s.id): s for s in schools}
        created_menus = []

        with transaction.atomic():
            for sid in unique_ids:
                school = school_by_id[sid]
                new_menu = Menu.objects.create(
                    school=school,
                    name=source_menu.name,
                    week_start=week_start,
                    week_end=week_end,
                    status=Menu.Status.DRAFT,
                    created_by=self.request.user,
                )
                MenuItem.objects.bulk_create([
                    MenuItem(
                        menu=new_menu,
                        day_of_week=item.day_of_week,
                        meal_type=item.meal_type,
                        meal_name=item.meal_name,
                        description=item.description,
                        portion_text=item.portion_text,
                        image_url=item.image_url,
                    )
                    for item in source_items
                ])
                created_menus.append(new_menu)

        return Response({
            'count': len(created_menus),
            'menus': MenuSerializer(created_menus, many=True).data,
        }, status=status.HTTP_201_CREATED)



class MenuExportCsvView(viewsets.ViewSet):
    authentication_classes = [QueryParamJWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        queryset = Menu.objects.select_related('school').prefetch_related('items').all().order_by('-week_start')
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename=\"menus.csv\"'
        writer = csv.writer(response)
        writer.writerow(['Escola', 'Nome Cardapio', 'Semana Inicio', 'Semana Fim', 'Status', 'Dia', 'Refeicao', 'Nome Refeicao', 'Quantidade', 'Imagem', 'Descricao'])
        for menu in queryset:
            for item in menu.items.all():
                writer.writerow([
                    menu.school.name,
                    menu.name,
                    menu.week_start,
                    menu.week_end,
                    menu.status,
                    item.day_of_week,
                    item.meal_type,
                    item.meal_name,
                    item.portion_text,
                    item.image_url,
                    item.description,
                ])
        return response


class MenuExportPdfView(viewsets.ViewSet):
    authentication_classes = [QueryParamJWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        school_id = request.query_params.get('school')
        week_start = request.query_params.get('week_start')
        if not school_id or not week_start:
            return Response({'detail': 'school e week_start obrigatorios.'}, status=400)
        menu = get_object_or_404(
            Menu.objects.select_related('school').prefetch_related('items'),
            school_id=school_id,
            week_start=week_start,
        )
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename=\"menu.pdf\"'
        
        generate_menu_pdf(menu, response)
        
        return response
