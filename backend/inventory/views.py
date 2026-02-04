from django.db import models
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
import csv
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Delivery, DeliveryItem, Supply, StockBalance, StockMovement
from .serializers import DeliverySerializer, SupplySerializer, StockBalanceSerializer, StockMovementSerializer


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
        if date_from:
            queryset = queryset.filter(movement_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(movement_date__lte=date_to)
        if movement_type:
            queryset = queryset.filter(type=movement_type)
        if supply:
            queryset = queryset.filter(supply_id=supply)
        return queryset


class StockExportCsvView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        queryset = StockBalance.objects.select_related('supply').all().order_by('supply__name')
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename=\"stock.csv\"'
        writer = csv.writer(response)
        writer.writerow(['Insumo', 'Categoria', 'Unidade', 'Quantidade', 'Minimo', 'Baixo'])
        for balance in queryset:
            writer.writerow([
                balance.supply.name,
                balance.supply.category,
                balance.supply.unit,
                balance.quantity,
                balance.supply.min_stock,
                'sim' if balance.quantity < balance.supply.min_stock else 'nao',
            ])
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
