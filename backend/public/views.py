from datetime import date
from django.http import HttpResponse

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from inventory.models import Delivery, SchoolStockBalance, StockBalance, StockMovement, Supply
from inventory.serializers import (
    DeliveryConferenceInputSerializer,
    PublicConsumptionInputSerializer,
    PublicDeliverySerializer,
    SupplySerializer,
)
from menus.models import MealServiceEntry, MealServiceReport, Menu, MenuItem
from menus.serializers import MenuSerializer
from menus.utils import generate_menu_pdf
from schools.models import School
from schools.serializers import SchoolPublicSerializer


class PublicBaseView(APIView):
    permission_classes = [permissions.AllowAny]

    def _validate_token(self, school, token):
        if not token or token != school.public_token:
            raise PermissionDenied('Token invalido.')


class PublicSchoolListView(APIView):
    """List all schools that have published menus - no authentication required."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # List schools that have at least one published menu.
        # The public page may be accessed on weekends/holidays, when no menu
        # matches "current week" strictly.
        schools_with_menu = School.objects.filter(
            is_active=True,
            menus__status=Menu.Status.PUBLISHED,
        ).distinct().order_by('name')
        
        # Return minimal public info (name and slug only)
        data = [{'id': str(s.id), 'name': s.name, 'slug': s.public_slug, 'city': s.city} for s in schools_with_menu]
        return Response(data)


class PublicSchoolDetailView(PublicBaseView):
    def get(self, request, slug):
        school = get_object_or_404(School, public_slug=slug)
        token = request.query_params.get('token')
        self._validate_token(school, token)
        return Response(SchoolPublicSerializer(school).data)


class PublicMenuCurrentView(APIView):
    """Get current week's menu for a school - no token required for public viewing."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        school = get_object_or_404(School, public_slug=slug, is_active=True)
        today = date.today()
        queryset = Menu.objects.prefetch_related('items').filter(
            school=school,
            status=Menu.Status.PUBLISHED,
        )

        # Prefer the menu that matches today's date.
        menu = queryset.filter(
            week_start__lte=today,
            week_end__gte=today,
        ).order_by('-week_start').first()

        # Fallback to latest published menu when no current-week menu exists
        # (e.g., weekends or gaps in publication calendar).
        if not menu:
            menu = queryset.order_by('-week_start').first()

        if not menu:
            return Response({'detail': 'Nenhum cardápio publicado para esta escola.'}, status=404)
        
        return Response(MenuSerializer(menu).data)



class PublicMenuPdfView(PublicBaseView):
    def get(self, request, slug):
        school = get_object_or_404(School, public_slug=slug)
        week_start = request.query_params.get('week_start')
        if not week_start:
            raise PermissionDenied('week_start obrigatorio.')
        menu = get_object_or_404(
            Menu.objects.prefetch_related('items'),
            school=school,
            status=Menu.Status.PUBLISHED,
            week_start=week_start,
        )
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename=\"menu.pdf\"'
        generate_menu_pdf(menu, response)
        return response


class PublicMenuByWeekView(PublicBaseView):
    def get(self, request, slug):
        school = get_object_or_404(School, public_slug=slug)
        token = request.query_params.get('token')
        self._validate_token(school, token)
        week_start = request.query_params.get('week_start')
        if not week_start:
            raise PermissionDenied('week_start obrigatorio.')
        menu = get_object_or_404(
            Menu.objects.prefetch_related('items'),
            school=school,
            status=Menu.Status.PUBLISHED,
            week_start=week_start,
        )
        return Response(MenuSerializer(menu).data)



class PublicDeliveryCurrentView(PublicBaseView):
    def _get_delivery(self, school, delivery_id=None):
        queryset = Delivery.objects.prefetch_related('items__supply').filter(
            school=school,
            conference_enabled=True,
        )
        if delivery_id:
            return get_object_or_404(queryset, id=delivery_id)
        delivery = queryset.order_by('-sent_at', '-created_at').first()
        if not delivery:
            raise PermissionDenied('Nenhuma entrega habilitada para conferencia.')
        return delivery

    def get(self, request, slug):
        school = get_object_or_404(School, public_slug=slug)
        token = request.query_params.get('token')
        delivery_id = request.query_params.get('delivery_id')
        self._validate_token(school, token)
        delivery = self._get_delivery(school, delivery_id=delivery_id)
        return Response(PublicDeliverySerializer(delivery).data)

    def post(self, request, slug):
        school = get_object_or_404(School, public_slug=slug)
        token = request.query_params.get('token')
        delivery_id = request.query_params.get('delivery_id')
        self._validate_token(school, token)
        if not delivery_id:
            raise PermissionDenied('delivery_id obrigatorio para envio da conferencia.')

        serializer = DeliveryConferenceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            delivery = self._get_delivery(school, delivery_id=delivery_id)
            delivery = Delivery.objects.select_for_update().get(id=delivery.id)
            if delivery.status == Delivery.Status.CONFERRED:
                raise PermissionDenied('Conferencia ja enviada para esta entrega.')
            if delivery.status != Delivery.Status.SENT:
                raise PermissionDenied('Entrega ainda nao enviada pela SEMED.')

            delivery_items = {str(item.id): item for item in delivery.items.all()}
            payload_items = serializer.validated_data['items']
            payload_ids = {str(entry['item_id']) for entry in payload_items}

            missing_ids = set(delivery_items.keys()) - payload_ids
            if missing_ids:
                raise PermissionDenied('Envie a conferencia de todos os itens da entrega.')

            for entry in payload_items:
                item = delivery_items.get(str(entry['item_id']))
                if not item:
                    raise PermissionDenied('Item da conferencia nao pertence a entrega.')
                item.received_quantity = entry['received_quantity']
                item.divergence_note = entry.get('note', '')
                item.save(update_fields=['received_quantity', 'divergence_note'])

            for entry in payload_items:
                item = delivery_items.get(str(entry['item_id']))
                if not item:
                    continue
                # Update school stock balance
                school_balance, _ = SchoolStockBalance.objects.select_for_update().get_or_create(
                    school=school,
                    supply=item.supply,
                    defaults={'quantity': 0}
                )
                school_balance.quantity += entry['received_quantity']
                school_balance.save()
                StockMovement.objects.create(
                    supply=item.supply,
                    school=school,
                    type=StockMovement.Types.IN,
                    quantity=entry['received_quantity'],
                    movement_date=delivery.delivery_date,
                    note=f"Entrada confirmada da entrega {delivery.id}.",
                    created_by=delivery.created_by,
                )

            for entry in payload_items:
                item = delivery_items.get(str(entry['item_id']))
                if not item:
                    continue
                adjustment = item.planned_quantity - entry['received_quantity']
                if adjustment == 0:
                    continue
                balance, _ = StockBalance.objects.select_for_update().get_or_create(supply=item.supply)
                if adjustment > 0:
                    balance.quantity += adjustment
                    movement_type = StockMovement.Types.IN
                    movement_note = f"Ajuste de conferencia (falta) da entrega {delivery.id}."
                    movement_quantity = adjustment
                else:
                    movement_quantity = abs(adjustment)
                    if balance.quantity - movement_quantity < 0:
                        raise PermissionDenied('Saldo insuficiente para ajustar a conferencia.')
                    balance.quantity -= movement_quantity
                    movement_type = StockMovement.Types.OUT
                    movement_note = f"Ajuste de conferencia (excesso) da entrega {delivery.id}."
                balance.save()
                StockMovement.objects.create(
                    supply=item.supply,
                    school=school,
                    type=movement_type,
                    quantity=movement_quantity,
                    movement_date=delivery.delivery_date,
                    note=movement_note,
                    created_by=delivery.created_by,
                )

            delivery.status = Delivery.Status.CONFERRED
            delivery.conference_submitted_at = timezone.now()
            # Sender (who delivered) signature
            delivery.sender_signature = serializer.validated_data['sender_signature_data']
            delivery.sender_signed_by = serializer.validated_data['sender_signer_name']
            # Receiver (who received at school) signature
            delivery.receiver_signature = serializer.validated_data['receiver_signature_data']
            delivery.receiver_signed_by = serializer.validated_data['receiver_signer_name']
            # Legacy fields (for backward compat)
            delivery.conference_signature = delivery.receiver_signature
            delivery.conference_signed_by = delivery.receiver_signed_by
            delivery.save(update_fields=[
                'status', 'conference_submitted_at',
                'sender_signature', 'sender_signed_by',
                'receiver_signature', 'receiver_signed_by',
                'conference_signature', 'conference_signed_by',
                'updated_at'
            ])

            # Create notification for delivery conference
            from inventory.models import Notification
            
            # Check if any item has a note
            has_notes = any(item.get('note', '').strip() for item in payload_items)
            
            if has_notes:
                # Create alert notification for divergence/observation
                Notification.objects.create(
                    notification_type=Notification.NotificationType.DELIVERY_WITH_NOTE,
                    title=f'⚠️ Entrega com observação - {school.name}',
                    message=f'A entrega de {delivery.delivery_date} para {school.name} foi conferida com observações. Verificar os itens.',
                    delivery=delivery,
                    school=school,
                    is_alert=True,
                )
            else:
                # Create normal notification
                Notification.objects.create(
                    notification_type=Notification.NotificationType.DELIVERY_CONFERRED,
                    title=f'Entrega conferida - {school.name}',
                    message=f'A entrega de {delivery.delivery_date} para {school.name} foi conferida por {delivery.receiver_signed_by}.',
                    delivery=delivery,
                    school=school,
                    is_alert=False,
                )


        delivery = self._get_delivery(school, delivery_id=delivery_id)
        return Response(PublicDeliverySerializer(delivery).data)



class PublicConsumptionView(PublicBaseView):
    def get(self, request, slug):
        school = get_object_or_404(School, public_slug=slug)
        token = request.query_params.get('token')
        self._validate_token(school, token)
        supplies = Supply.objects.filter(
            is_active=True,
            school_balances__school=school,
            school_balances__quantity__gt=0,
        ).distinct().order_by('name')
        return Response(SupplySerializer(supplies, many=True).data)

    def post(self, request, slug):
        school = get_object_or_404(School, public_slug=slug)
        token = request.query_params.get('token')
        self._validate_token(school, token)

        serializer = PublicConsumptionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data['items']

        supply_ids = [item['supply'] for item in items]
        supplies = {
            str(balance.supply_id): balance.supply
            for balance in SchoolStockBalance.objects.select_related('supply').filter(
                school=school,
                supply_id__in=supply_ids,
                quantity__gt=0,
                supply__is_active=True,
            )
        }
        if len(supplies) != len(items):
            raise PermissionDenied('Insumo invalido ou sem estoque na escola.')

        created_by = Delivery.objects.filter(school=school).order_by('-created_at').values_list('created_by', flat=True).first()
        if not created_by:
            created_by = StockMovement.objects.filter(school=school).order_by('-created_at').values_list('created_by', flat=True).first()
        if not created_by:
            User = get_user_model()
            created_by = User.objects.filter(is_active=True).order_by('-is_superuser', '-is_staff', 'date_joined').values_list('id', flat=True).first()
        if not created_by:
            raise PermissionDenied('Nao foi possivel registrar consumo sem responsavel.')

        low_stock_items = []
        with transaction.atomic():
            for entry in items:
                supply = supplies.get(str(entry['supply']))
                # Update school stock balance
                school_balance, _ = SchoolStockBalance.objects.select_for_update().get_or_create(
                    school=school,
                    supply=supply,
                    defaults={'quantity': 0}
                )
                if school_balance.quantity - entry['quantity'] < 0:
                    raise PermissionDenied(f"Estoque insuficiente de {supply.name} na escola.")
                school_balance.quantity -= entry['quantity']
                school_balance.save()
                
                # Check if stock is now low (use school-specific min_stock if set, otherwise supply's)
                min_stock = school_balance.min_stock if school_balance.min_stock > 0 else supply.min_stock
                if school_balance.quantity < min_stock:
                    low_stock_items.append({
                        'supply_name': supply.name,
                        'quantity': school_balance.quantity,
                        'min_stock': min_stock,
                    })
                
                StockMovement.objects.create(
                    supply=supply,
                    school=school,
                    type=StockMovement.Types.OUT,
                    quantity=entry['quantity'],
                    movement_date=entry['movement_date'],
                    note=entry.get('note', ''),
                    created_by_id=created_by,
                )
            
            # Create notification for low stock items
            if low_stock_items:
                from inventory.models import Notification
                items_text = ', '.join([f"{item['supply_name']} ({item['quantity']:.2f})" for item in low_stock_items])
                Notification.objects.create(
                    notification_type=Notification.NotificationType.DELIVERY_DIVERGENCE,
                    title=f'⚠️ Estoque baixo - {school.name}',
                    message=f'Os seguintes itens estão com estoque abaixo do limite: {items_text}',
                    school=school,
                    is_alert=True,
                )

        return Response({'detail': 'Consumo registrado com sucesso.'})


class PublicMealServiceItemInputSerializer(serializers.Serializer):
    meal_type = serializers.CharField(max_length=16)
    served_count = serializers.IntegerField(min_value=0)


class PublicMealServiceInputSerializer(serializers.Serializer):
    service_date = serializers.DateField()
    items = PublicMealServiceItemInputSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('Informe pelo menos uma refeicao.')
        meal_types = [item['meal_type'] for item in items]
        if len(meal_types) != len(set(meal_types)):
            raise serializers.ValidationError('Categorias de refeicao duplicadas.')
        return items


class PublicMealServiceView(PublicBaseView):
    _weekday_map = {
        0: MenuItem.DayOfWeek.MON,
        1: MenuItem.DayOfWeek.TUE,
        2: MenuItem.DayOfWeek.WED,
        3: MenuItem.DayOfWeek.THU,
        4: MenuItem.DayOfWeek.FRI,
    }

    _weekday_labels = {
        0: 'Segunda-feira',
        1: 'Terca-feira',
        2: 'Quarta-feira',
        3: 'Quinta-feira',
        4: 'Sexta-feira',
        5: 'Sabado',
        6: 'Domingo',
    }

    def _resolve_menu(self, school, service_date):
        queryset = Menu.objects.prefetch_related('items').filter(
            school=school,
            status=Menu.Status.PUBLISHED,
        )
        menu = queryset.filter(
            week_start__lte=service_date,
            week_end__gte=service_date,
        ).order_by('-week_start').first()
        if not menu:
            menu = queryset.filter(week_start__lte=service_date).order_by('-week_start').first()
        if not menu:
            menu = queryset.order_by('-week_start').first()
        return menu

    def _build_categories(self, menu, service_date):
        if not menu:
            return []
        day_of_week = self._weekday_map.get(service_date.weekday())
        if not day_of_week:
            return []
        meal_label_map = dict(MenuItem.MealType.choices)
        grouped = {}
        for item in menu.items.filter(day_of_week=day_of_week).order_by('meal_type', 'created_at'):
            payload = grouped.setdefault(
                item.meal_type,
                {
                    'meal_type': item.meal_type,
                    'meal_label': meal_label_map.get(item.meal_type, item.meal_type),
                    'items': [],
                },
            )
            payload['items'].append(item.description)
        return list(grouped.values())

    def get(self, request, slug):
        school = get_object_or_404(School, public_slug=slug, is_active=True)
        token = request.query_params.get('token')
        self._validate_token(school, token)

        raw_date = request.query_params.get('date')
        try:
            service_date = date.fromisoformat(raw_date) if raw_date else date.today()
        except ValueError:
            raise PermissionDenied('Data invalida. Use o formato YYYY-MM-DD.')

        menu = self._resolve_menu(school, service_date)
        categories = self._build_categories(menu, service_date)

        existing = {}
        report = MealServiceReport.objects.prefetch_related('entries').filter(
            school=school,
            service_date=service_date,
        ).first()
        if report:
            existing = {entry.meal_type: entry.served_count for entry in report.entries.all()}

        return Response(
            {
                'school': str(school.id),
                'school_name': school.name,
                'service_date': service_date.isoformat(),
                'weekday': self._weekday_labels.get(service_date.weekday(), ''),
                'menu': (
                    {
                        'id': str(menu.id),
                        'week_start': menu.week_start.isoformat(),
                        'week_end': menu.week_end.isoformat(),
                    }
                    if menu
                    else None
                ),
                'categories': categories,
                'existing_entries': existing,
            }
        )

    def post(self, request, slug):
        school = get_object_or_404(School, public_slug=slug, is_active=True)
        token = request.query_params.get('token')
        self._validate_token(school, token)

        serializer = PublicMealServiceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        service_date = serializer.validated_data['service_date']
        menu = self._resolve_menu(school, service_date)
        categories = self._build_categories(menu, service_date)
        if not categories:
            raise PermissionDenied('Nao ha refeicoes cadastradas para esta data.')

        label_by_type = {item['meal_type']: item['meal_label'] for item in categories}
        allowed_types = set(label_by_type.keys())
        provided_items = serializer.validated_data['items']
        provided_types = {item['meal_type'] for item in provided_items}

        invalid_types = provided_types - allowed_types
        if invalid_types:
            raise PermissionDenied('Categoria de refeicao invalida para o cardapio desta data.')
        missing_types = allowed_types - provided_types
        if missing_types:
            raise PermissionDenied('Informe todas as categorias de refeicao exibidas.')

        with transaction.atomic():
            report, _ = MealServiceReport.objects.update_or_create(
                school=school,
                service_date=service_date,
                defaults={'menu': menu},
            )
            MealServiceEntry.objects.filter(report=report).delete()
            MealServiceEntry.objects.bulk_create(
                [
                    MealServiceEntry(
                        report=report,
                        meal_type=item['meal_type'],
                        meal_label=label_by_type.get(item['meal_type'], item['meal_type']),
                        served_count=item['served_count'],
                    )
                    for item in provided_items
                ]
            )

        total_served = sum(item['served_count'] for item in provided_items)
        return Response(
            {
                'detail': 'Refeicoes servidas registradas com sucesso.',
                'report_id': str(report.id),
                'total_served': total_served,
            }
        )
