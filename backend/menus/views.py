from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
import csv
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from merenda_semed.authentication import QueryParamJWTAuthentication

from .models import Menu, MenuItem
from .serializers import MenuItemBulkSerializer, MenuItemSerializer, MenuSerializer


def _pdf_text(value):
    text = '' if value is None else str(value)
    return text.encode('latin-1', 'replace').decode('latin-1')


def _start_pdf_page(pdf, title, generated_at, filters, page_number):
    width, height = A4
    left = 32
    right = width - 32

    pdf.setFillColor(colors.HexColor('#1f3a6d'))
    pdf.rect(0, height - 84, width, 84, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont('Helvetica-Bold', 16)
    pdf.drawString(left, height - 32, _pdf_text('SEMED - Prestacao de Contas'))
    pdf.setFont('Helvetica', 11)
    pdf.drawString(left, height - 50, _pdf_text(title))
    pdf.setFont('Helvetica', 9)
    pdf.drawRightString(right, height - 32, _pdf_text(f"Pagina {page_number}"))
    pdf.drawRightString(right, height - 50, _pdf_text(f"Gerado em: {generated_at.strftime('%Y-%m-%d %H:%M')}"))

    y = height - 102
    pdf.setFillColor(colors.HexColor('#f4f6fb'))
    pdf.rect(left, y - 28, right - left, 28, stroke=0, fill=1)
    pdf.setFillColor(colors.HexColor('#1b2a41'))
    pdf.setFont('Helvetica', 8.5)
    filters_text = ' | '.join([f"{label}: {value}" for label, value in filters])
    pdf.drawString(left + 8, y - 17, _pdf_text(filters_text))
    return y - 40


def _draw_pdf_footer(pdf, page_number):
    width, _ = A4
    pdf.setStrokeColor(colors.HexColor('#d2d8e6'))
    pdf.line(32, 26, width - 32, 26)
    pdf.setFont('Helvetica', 8)
    pdf.setFillColor(colors.HexColor('#5b6578'))
    pdf.drawString(32, 14, _pdf_text('Documento de prestacao de contas - cardapio escolar'))
    pdf.drawRightString(width - 32, 14, _pdf_text(f"Pagina {page_number}"))


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
        """Copy a menu to another school."""
        source_menu = self.get_object()
        target_school_id = request.data.get('target_school')
        week_start = request.data.get('week_start')
        week_end = request.data.get('week_end')
        
        if not target_school_id:
            return Response({'detail': 'Escola destino obrigatória.'}, status=400)
        
        from schools.models import School
        try:
            target_school = School.objects.get(id=target_school_id)
        except School.DoesNotExist:
            return Response({'detail': 'Escola destino não encontrada.'}, status=404)
        
        # Use source menu dates if not provided
        if not week_start:
            week_start = source_menu.week_start
        if not week_end:
            week_end = source_menu.week_end
        
        # Create new menu for target school
        new_menu = Menu.objects.create(
            school=target_school,
            name=source_menu.name,
            week_start=week_start,
            week_end=week_end,
            status=Menu.Status.DRAFT,
            created_by=self.request.user,
        )
        
        # Copy all items
        for item in source_menu.items.all():
            MenuItem.objects.create(
                menu=new_menu,
                day_of_week=item.day_of_week,
                meal_type=item.meal_type,
                meal_name=item.meal_name,
                description=item.description,
                portion_text=item.portion_text,
                image_url=item.image_url,
            )
        
        return Response(MenuSerializer(new_menu).data, status=status.HTTP_201_CREATED)



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
        pdf = canvas.Canvas(response, pagesize=A4)
        _, height = A4
        generated_at = timezone.now()
        page_number = 1
        filters = [
            ('Escola', menu.school.name),
            ('Cardapio', menu.name or 'Sem nome'),
            ('Semana', f"{menu.week_start} a {menu.week_end}"),
        ]
        y = _start_pdf_page(pdf, 'Relatorio de Cardapio Semanal', generated_at, filters, page_number)

        items = menu.items.all().order_by('day_of_week', 'meal_type')
        pdf.setFont('Helvetica', 9)
        pdf.setFillColor(colors.HexColor('#1b2a41'))
        pdf.drawString(32, y, _pdf_text(f"Total de preparacoes planejadas: {items.count()}"))
        y -= 18

        current_day = None
        for item in items:
            if y < 74:
                _draw_pdf_footer(pdf, page_number)
                pdf.showPage()
                page_number += 1
                y = _start_pdf_page(pdf, 'Relatorio de Cardapio Semanal', generated_at, filters, page_number)

            day_label = item.get_day_of_week_display()
            if day_label != current_day:
                current_day = day_label
                pdf.setFillColor(colors.HexColor('#e3e9f5'))
                pdf.rect(32, y - 14, 530, 16, stroke=0, fill=1)
                pdf.setFillColor(colors.HexColor('#1b2a41'))
                pdf.setFont('Helvetica-Bold', 9)
                pdf.drawString(36, y - 10, _pdf_text(day_label))
                y -= 20
                if y < 74:
                    _draw_pdf_footer(pdf, page_number)
                    pdf.showPage()
                    page_number += 1
                    y = _start_pdf_page(pdf, 'Relatorio de Cardapio Semanal', generated_at, filters, page_number)

            meal_label = item.meal_name or item.get_meal_type_display()
            portion = item.portion_text or '-'
            description = item.description or '-'

            pdf.setFont('Helvetica-Bold', 8.5)
            pdf.setFillColor(colors.HexColor('#1b2a41'))
            pdf.drawString(36, y - 8, _pdf_text(meal_label[:45]))
            pdf.setFont('Helvetica', 8)
            pdf.drawString(300, y - 8, _pdf_text(f"Porcao: {portion[:18]}"))
            y -= 12

            wrapped_description = [description[i:i + 95] for i in range(0, len(description), 95)] or ['-']
            for line in wrapped_description[:3]:
                if y < 64:
                    _draw_pdf_footer(pdf, page_number)
                    pdf.showPage()
                    page_number += 1
                    y = _start_pdf_page(pdf, 'Relatorio de Cardapio Semanal', generated_at, filters, page_number)
                pdf.setFont('Helvetica', 8)
                pdf.setFillColor(colors.black)
                pdf.drawString(46, y - 8, _pdf_text(line))
                y -= 11

            pdf.setStrokeColor(colors.HexColor('#e8edf6'))
            pdf.line(36, y - 3, 556, y - 3)
            y -= 8

        _draw_pdf_footer(pdf, page_number)
        pdf.save()
        return response
