from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
import csv
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Menu, MenuItem
from .serializers import MenuItemBulkSerializer, MenuItemSerializer, MenuSerializer


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


class MenuExportCsvView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        queryset = Menu.objects.select_related('school').prefetch_related('items').all().order_by('-week_start')
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename=\"menus.csv\"'
        writer = csv.writer(response)
        writer.writerow(['Escola', 'Semana Inicio', 'Semana Fim', 'Status', 'Dia', 'Refeicao', 'Nome Refeicao', 'Quantidade', 'Imagem', 'Descricao'])
        for menu in queryset:
            for item in menu.items.all():
                writer.writerow([
                    menu.school.name,
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
        pdf = canvas.Canvas(response, pagesize=A4)
        width, height = A4
        y = height - 40
        pdf.setFont('Helvetica-Bold', 14)
        pdf.drawString(40, y, f"Cardapio - {menu.school.name}")
        y -= 20
        pdf.setFont('Helvetica', 10)
        pdf.drawString(40, y, f"Semana: {menu.week_start} a {menu.week_end}")
        y -= 20
        items = menu.items.all().order_by('day_of_week', 'meal_type')
        for item in items:
            if y < 60:
                pdf.showPage()
                y = height - 40
            title = item.meal_name or item.meal_type
            portion = f" ({item.portion_text})" if item.portion_text else ""
            pdf.drawString(40, y, f"{item.day_of_week} - {title}{portion}: {item.description}")
            y -= 16
        pdf.showPage()
        pdf.save()
        return response
