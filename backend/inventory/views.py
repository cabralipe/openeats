from django.db import models
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
import csv
import io
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
import base64
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Delivery, DeliveryItem, Supply, StockBalance, StockMovement
from .serializers import DeliverySerializer, SupplySerializer, StockBalanceSerializer, StockMovementSerializer


def _pdf_text(value):
    text = '' if value is None else str(value)
    return text.encode('latin-1', 'replace').decode('latin-1')


class SupplyViewSet(viewsets.ModelViewSet):
    queryset = Supply.objects.all().order_by('name')
    serializer_class = SupplySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        query = self.request.query_params.get('q')
        category = self.request.query_params.get('category')
        is_active = self.request.query_params.get('is_active')
        if query:
            queryset = queryset.filter(name__icontains=query)
        if category:
            queryset = queryset.filter(category__icontains=category)
        if is_active in ['true', 'false']:
            queryset = queryset.filter(is_active=is_active == 'true')
        return queryset

    def perform_create(self, serializer):
        supply = serializer.save()
        StockBalance.objects.get_or_create(supply=supply)


class StockViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockBalance.objects.select_related('supply').all().order_by('supply__name')
    serializer_class = StockBalanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        query = self.request.query_params.get('q')
        category = self.request.query_params.get('category')
        low_stock = self.request.query_params.get('low_stock')
        if query:
            queryset = queryset.filter(supply__name__icontains=query)
        if category:
            queryset = queryset.filter(supply__category__icontains=category)
        if low_stock in ['true', 'false']:
            if low_stock == 'true':
                queryset = queryset.filter(quantity__lt=models.F('supply__min_stock'))
            else:
                queryset = queryset.filter(quantity__gte=models.F('supply__min_stock'))
        return queryset


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related('supply').all().order_by('-created_at')
    serializer_class = StockMovementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        movement_type = self.request.query_params.get('type')
        supply = self.request.query_params.get('supply')
        school = self.request.query_params.get('school')
        if date_from:
            queryset = queryset.filter(movement_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(movement_date__lte=date_to)
        if movement_type:
            queryset = queryset.filter(type=movement_type)
        if supply:
            queryset = queryset.filter(supply_id=supply)
        if school:
            queryset = queryset.filter(school_id=school)
        return queryset


class StockExportCsvView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        queryset = StockBalance.objects.select_related('supply').all().order_by('supply__name')
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename=\"stock.csv\"'
        writer = csv.writer(response)
        writer.writerow(['Insumo', 'Categoria', 'Unidade', 'Quantidade', 'Minimo', 'Status', 'Diferenca'])
        for balance in queryset:
            diff = balance.quantity - balance.supply.min_stock
            if balance.quantity < balance.supply.min_stock:
                status = 'BAIXO'
            elif balance.quantity >= balance.supply.min_stock * 2:
                status = 'ALTO'
            else:
                status = 'NORMAL'
            writer.writerow([
                balance.supply.name,
                balance.supply.category,
                balance.supply.unit,
                balance.quantity,
                balance.supply.min_stock,
                status,
                diff,
            ])
        return response


class StockExportPdfView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        queryset = StockBalance.objects.select_related('supply').all().order_by('supply__category', 'supply__name')
        
        # Group by category and status
        low_stock = []
        normal_stock = []
        high_stock = []
        
        for balance in queryset:
            item = {
                'name': balance.supply.name,
                'category': balance.supply.category,
                'unit': balance.supply.unit,
                'quantity': float(balance.quantity),
                'min_stock': float(balance.supply.min_stock),
            }
            if balance.quantity < balance.supply.min_stock:
                low_stock.append(item)
            elif balance.quantity >= balance.supply.min_stock * 2:
                high_stock.append(item)
            else:
                normal_stock.append(item)

        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename=\"stock_report.pdf\"'
        pdf = canvas.Canvas(response, pagesize=A4)
        width, height = A4
        
        def draw_header(y_pos, title):
            pdf.setFont('Helvetica-Bold', 14)
            pdf.drawString(40, y_pos, _pdf_text(title))
            return y_pos - 20
        
        def draw_section(y_pos, section_title, items, color):
            if not items:
                return y_pos
            pdf.setFont('Helvetica-Bold', 12)
            pdf.setFillColorRGB(*color)
            pdf.drawString(40, y_pos, _pdf_text(f'{section_title} ({len(items)} itens)'))
            pdf.setFillColorRGB(0, 0, 0)
            y_pos -= 18
            pdf.setFont('Helvetica', 9)
            for item in items:
                if y_pos < 60:
                    pdf.showPage()
                    y_pos = height - 40
                    pdf.setFont('Helvetica', 9)
                line = f"  {item['name']} ({item['category']}) - {item['quantity']:.2f} {item['unit']} (min: {item['min_stock']:.2f})"
                pdf.drawString(40, y_pos, _pdf_text(line[:100]))
                y_pos -= 14
            return y_pos - 10

        y = height - 40
        y = draw_header(y, 'Relatorio de Estoque Detalhado')
        pdf.setFont('Helvetica', 9)
        pdf.drawString(40, y, _pdf_text(f"Gerado em: {timezone.now().strftime('%Y-%m-%d %H:%M')}"))
        y -= 10
        total_items = len(low_stock) + len(normal_stock) + len(high_stock)
        pdf.drawString(40, y, _pdf_text(f"Total de insumos: {total_items}"))
        y -= 30

        # Low stock (red)
        y = draw_section(y, 'ESTOQUE BAIXO - Requer Reposicao', low_stock, (0.8, 0.2, 0.2))
        
        # Normal stock (blue)
        y = draw_section(y, 'ESTOQUE NORMAL', normal_stock, (0.2, 0.4, 0.8))
        
        # High stock (green)
        y = draw_section(y, 'ESTOQUE ALTO', high_stock, (0.2, 0.6, 0.3))

        pdf.showPage()
        pdf.save()
        return response


class StockExportXlsxView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        queryset = StockBalance.objects.select_related('supply').all().order_by('supply__category', 'supply__name')

        workbook = Workbook()
        
        # Summary sheet
        summary_sheet = workbook.active
        summary_sheet.title = 'Resumo'
        summary_sheet.append(['Categoria', 'Total Itens', 'Itens Baixos', 'Itens Normais', 'Itens Altos'])
        
        # All items sheet
        items_sheet = workbook.create_sheet(title='Todos os Itens')
        items_sheet.append(['Insumo', 'Categoria', 'Unidade', 'Quantidade', 'Estoque Minimo', 'Status', 'Diferenca'])
        
        # Low stock sheet
        low_sheet = workbook.create_sheet(title='Estoque Baixo')
        low_sheet.append(['Insumo', 'Categoria', 'Unidade', 'Quantidade', 'Estoque Minimo', 'Falta'])
        
        # Normal stock sheet
        normal_sheet = workbook.create_sheet(title='Estoque Normal')
        normal_sheet.append(['Insumo', 'Categoria', 'Unidade', 'Quantidade', 'Estoque Minimo'])
        
        # High stock sheet
        high_sheet = workbook.create_sheet(title='Estoque Alto')
        high_sheet.append(['Insumo', 'Categoria', 'Unidade', 'Quantidade', 'Estoque Minimo', 'Excesso'])

        category_stats = {}
        
        for balance in queryset:
            cat = balance.supply.category or 'Sem Categoria'
            if cat not in category_stats:
                category_stats[cat] = {'total': 0, 'low': 0, 'normal': 0, 'high': 0}
            
            category_stats[cat]['total'] += 1
            diff = float(balance.quantity) - float(balance.supply.min_stock)
            
            if balance.quantity < balance.supply.min_stock:
                status = 'BAIXO'
                category_stats[cat]['low'] += 1
                low_sheet.append([
                    balance.supply.name,
                    cat,
                    balance.supply.unit,
                    float(balance.quantity),
                    float(balance.supply.min_stock),
                    abs(diff),
                ])
            elif balance.quantity >= balance.supply.min_stock * 2:
                status = 'ALTO'
                category_stats[cat]['high'] += 1
                high_sheet.append([
                    balance.supply.name,
                    cat,
                    balance.supply.unit,
                    float(balance.quantity),
                    float(balance.supply.min_stock),
                    diff,
                ])
            else:
                status = 'NORMAL'
                category_stats[cat]['normal'] += 1
                normal_sheet.append([
                    balance.supply.name,
                    cat,
                    balance.supply.unit,
                    float(balance.quantity),
                    float(balance.supply.min_stock),
                ])
            
            items_sheet.append([
                balance.supply.name,
                cat,
                balance.supply.unit,
                float(balance.quantity),
                float(balance.supply.min_stock),
                status,
                diff,
            ])
        
        for cat, stats in category_stats.items():
            summary_sheet.append([cat, stats['total'], stats['low'], stats['normal'], stats['high']])

        buffer = io.BytesIO()
        workbook.save(buffer)
        buffer.seek(0)
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename=\"stock_report.xlsx\"'
        return response


class DeliveryExportPdfView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        queryset = Delivery.objects.select_related('school').prefetch_related('items').all().order_by('-delivery_date')
        school = request.query_params.get('school')
        status_value = request.query_params.get('status')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if school:
            queryset = queryset.filter(school_id=school)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if date_from:
            queryset = queryset.filter(delivery_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(delivery_date__lte=date_to)

        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename=\"deliveries.pdf\"'
        pdf = canvas.Canvas(response, pagesize=A4)
        width, height = A4
        y = height - 40
        pdf.setFont('Helvetica-Bold', 14)
        pdf.drawString(40, y, _pdf_text('Relatorio de Entregas'))
        y -= 18
        pdf.setFont('Helvetica', 9)
        pdf.drawString(40, y, _pdf_text(f"Gerado em: {timezone.now().strftime('%Y-%m-%d %H:%M')}"))
        y -= 20

        pdf.setFont('Helvetica', 10)
        for delivery in queryset:
            if y < 120:
                pdf.showPage()
                y = height - 40
                pdf.setFont('Helvetica', 10)
            items_count = len(delivery.items.all())
            status_label = delivery.get_status_display()
            line = f"{delivery.delivery_date} - {delivery.school.name} - {status_label} - Itens: {items_count}"
            pdf.drawString(40, y, _pdf_text(line[:120]))
            y -= 14
            if delivery.conference_submitted_at:
                pdf.drawString(40, y, _pdf_text(f"Conferida em: {delivery.conference_submitted_at.strftime('%Y-%m-%d %H:%M')}"))
                y -= 14
            if delivery.conference_signed_by:
                pdf.drawString(40, y, _pdf_text(f"Assinada por: {delivery.conference_signed_by}"))
                y -= 14
            if delivery.conference_signature:
                try:
                    header, encoded = delivery.conference_signature.split(',', 1)
                    image_bytes = base64.b64decode(encoded)
                    image = ImageReader(io.BytesIO(image_bytes))
                    pdf.drawImage(image, 40, y - 50, width=200, height=50, preserveAspectRatio=True, mask='auto')
                    y -= 60
                except Exception:
                    pdf.drawString(40, y, _pdf_text("Assinatura: [erro ao carregar imagem]"))
                    y -= 14
            y -= 6

        pdf.showPage()
        pdf.save()
        return response


class DeliveryExportXlsxView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        queryset = Delivery.objects.select_related('school').prefetch_related('items').all().order_by('-delivery_date')
        school = request.query_params.get('school')
        status_value = request.query_params.get('status')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if school:
            queryset = queryset.filter(school_id=school)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if date_from:
            queryset = queryset.filter(delivery_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(delivery_date__lte=date_to)

        workbook = Workbook()
        summary_sheet = workbook.active
        summary_sheet.title = 'Entregas'
        summary_sheet.append(['Data', 'Escola', 'Status', 'Itens', 'Responsavel', 'Telefone', 'Observacoes'])

        items_sheet = workbook.create_sheet(title='Itens')
        items_sheet.append([
            'Data',
            'Escola',
            'Status',
            'Insumo',
            'Unidade',
            'Quantidade Planejada',
            'Quantidade Recebida',
            'Falta',
            'Observacao Divergencia',
        ])

        for delivery in queryset:
            items = list(delivery.items.select_related('supply').all())
            summary_sheet.append([
                str(delivery.delivery_date),
                delivery.school.name,
                delivery.get_status_display(),
                len(items),
                delivery.responsible_name,
                delivery.responsible_phone,
                delivery.notes,
            ])
            for item in items:
                shortage = None
                if item.received_quantity is not None:
                    shortage_value = item.planned_quantity - item.received_quantity
                    shortage = float(shortage_value) if shortage_value > 0 else 0
                items_sheet.append([
                    str(delivery.delivery_date),
                    delivery.school.name,
                    delivery.get_status_display(),
                    item.supply.name,
                    item.supply.unit,
                    float(item.planned_quantity),
                    float(item.received_quantity) if item.received_quantity is not None else None,
                    shortage,
                    item.divergence_note,
                ])

        buffer = io.BytesIO()
        workbook.save(buffer)
        buffer.seek(0)
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename=\"deliveries.xlsx\"'
        return response


class ConsumptionExportPdfView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        queryset = StockMovement.objects.select_related('supply').filter(type=StockMovement.Types.OUT).order_by('-movement_date')
        supply = request.query_params.get('supply')
        school = request.query_params.get('school')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if supply:
            queryset = queryset.filter(supply_id=supply)
        if school:
            queryset = queryset.filter(school_id=school)
        if date_from:
            queryset = queryset.filter(movement_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(movement_date__lte=date_to)

        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename=\"consumption.pdf\"'
        pdf = canvas.Canvas(response, pagesize=A4)
        width, height = A4
        y = height - 40
        pdf.setFont('Helvetica-Bold', 14)
        pdf.drawString(40, y, _pdf_text('Relatorio de Consumo'))
        y -= 18
        pdf.setFont('Helvetica', 9)
        pdf.drawString(40, y, _pdf_text(f"Gerado em: {timezone.now().strftime('%Y-%m-%d %H:%M')}"))
        y -= 20

        pdf.setFont('Helvetica', 10)
        for movement in queryset:
            if y < 60:
                pdf.showPage()
                y = height - 40
                pdf.setFont('Helvetica', 10)
            line = f"{movement.movement_date} - {movement.supply.name} - {movement.quantity}{movement.supply.unit}"
            pdf.drawString(40, y, _pdf_text(line[:120]))
            y -= 16

        pdf.showPage()
        pdf.save()
        return response


class ConsumptionExportXlsxView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        queryset = StockMovement.objects.select_related('supply').filter(type=StockMovement.Types.OUT).order_by('-movement_date')
        supply = request.query_params.get('supply')
        school = request.query_params.get('school')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if supply:
            queryset = queryset.filter(supply_id=supply)
        if school:
            queryset = queryset.filter(school_id=school)
        if date_from:
            queryset = queryset.filter(movement_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(movement_date__lte=date_to)

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = 'Consumo'
        sheet.append(['Data', 'Insumo', 'Unidade', 'Quantidade', 'Observacao'])

        totals_sheet = workbook.create_sheet(title='Resumo por Insumo')
        totals_sheet.append(['Insumo', 'Unidade', 'Quantidade Total'])

        totals = {}
        for movement in queryset:
            sheet.append([
                str(movement.movement_date),
                movement.supply.name,
                movement.supply.unit,
                float(movement.quantity),
                movement.note,
            ])
            key = movement.supply_id
            if key not in totals:
                totals[key] = {
                    'name': movement.supply.name,
                    'unit': movement.supply.unit,
                    'total': 0.0,
                }
            totals[key]['total'] += float(movement.quantity)

        for entry in totals.values():
            totals_sheet.append([entry['name'], entry['unit'], entry['total']])

        buffer = io.BytesIO()
        workbook.save(buffer)
        buffer.seek(0)
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename=\"consumption.xlsx\"'
        return response


class DeliveryViewSet(viewsets.ModelViewSet):
    queryset = Delivery.objects.select_related('school', 'created_by').prefetch_related('items__supply').all().order_by('-created_at')
    serializer_class = DeliverySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        school = self.request.query_params.get('school')
        status_value = self.request.query_params.get('status')
        conference_enabled = self.request.query_params.get('conference_enabled')

        if school:
            queryset = queryset.filter(school_id=school)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if conference_enabled in ['true', 'false']:
            queryset = queryset.filter(conference_enabled=conference_enabled == 'true')
        return queryset

    def perform_destroy(self, instance):
        if instance.status != Delivery.Status.DRAFT:
            raise ValidationError('Apenas entregas em rascunho podem ser excluidas.')
        instance.delete()

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        delivery = self.get_object()
        if delivery.status != Delivery.Status.DRAFT:
            raise ValidationError('Somente entregas em rascunho podem ser enviadas.')

        items = list(delivery.items.select_related('supply').all())
        if not items:
            raise ValidationError('Adicione itens antes de enviar a entrega.')

        with transaction.atomic():
            for item in items:
                balance, _ = StockBalance.objects.select_for_update().get_or_create(supply=item.supply)
                if balance.quantity < item.planned_quantity:
                    raise ValidationError(
                        f"Saldo insuficiente para {item.supply.name}. Disponivel: {balance.quantity}"
                    )
                balance.quantity -= item.planned_quantity
                balance.save()
                StockMovement.objects.create(
                    supply=item.supply,
                    school=delivery.school,
                    type=StockMovement.Types.OUT,
                    quantity=item.planned_quantity,
                    movement_date=delivery.delivery_date,
                    note=f"Saida automatica da entrega {delivery.id} para {delivery.school.name}.",
                    created_by=request.user,
                )

            delivery.status = Delivery.Status.SENT
            delivery.conference_enabled = True
            delivery.sent_at = timezone.now()
            delivery.save(update_fields=['status', 'conference_enabled', 'sent_at', 'updated_at'])

        serializer = self.get_serializer(delivery)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def conference_link(self, request, pk=None):
        delivery = self.get_object()
        return Response({
            'slug': delivery.school.public_slug,
            'token': delivery.school.public_token,
            'delivery_id': str(delivery.id),
            'url': f"/public/delivery?slug={delivery.school.public_slug}&token={delivery.school.public_token}&delivery_id={delivery.id}",
            'api_url': f"/public/schools/{delivery.school.public_slug}/delivery/current/?token={delivery.school.public_token}&delivery_id={delivery.id}",
        })
