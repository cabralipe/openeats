from datetime import date

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from inventory.models import Delivery, LotBalanceSchool, SchoolStockBalance, StockMovement
from inventory.services.lots import debit_lot_school, fefo_suggestion_service
from menus.models import MealServiceEntry, MealServiceReport, Menu, MenuItem


class MealServiceItemInputSerializer(serializers.Serializer):
    meal_type = serializers.CharField(max_length=16)
    served_count = serializers.IntegerField(min_value=0)


class MealServiceInputSerializer(serializers.Serializer):
    service_date = serializers.DateField()
    items = MealServiceItemInputSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('Informe pelo menos uma refeicao.')
        meal_types = [item['meal_type'] for item in items]
        if len(meal_types) != len(set(meal_types)):
            raise serializers.ValidationError('Categorias de refeicao duplicadas.')
        return items


WEEKDAY_MAP = {
    0: MenuItem.DayOfWeek.MON,
    1: MenuItem.DayOfWeek.TUE,
    2: MenuItem.DayOfWeek.WED,
    3: MenuItem.DayOfWeek.THU,
    4: MenuItem.DayOfWeek.FRI,
}

WEEKDAY_LABELS = {
    0: 'Segunda-feira',
    1: 'Terca-feira',
    2: 'Quarta-feira',
    3: 'Quinta-feira',
    4: 'Sexta-feira',
    5: 'Sabado',
    6: 'Domingo',
}


def resolve_meal_service_menu(school, service_date):
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


def build_meal_service_categories(menu, service_date):
    if not menu:
        return []

    day_of_week = WEEKDAY_MAP.get(service_date.weekday())
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


def get_meal_service_payload(school, service_date):
    menu = resolve_meal_service_menu(school, service_date)
    categories = build_meal_service_categories(menu, service_date)

    existing_entries = {}
    report = MealServiceReport.objects.prefetch_related('entries').filter(
        school=school,
        service_date=service_date,
    ).first()
    if report:
        existing_entries = {entry.meal_type: entry.served_count for entry in report.entries.all()}

    return {
        'school': str(school.id),
        'school_name': school.name,
        'service_date': service_date.isoformat(),
        'weekday': WEEKDAY_LABELS.get(service_date.weekday(), ''),
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
        'existing_entries': existing_entries,
    }


def save_meal_service_report(school, service_date, items):
    menu = resolve_meal_service_menu(school, service_date)
    categories = build_meal_service_categories(menu, service_date)
    if not categories:
        raise PermissionDenied('Nao ha refeicoes cadastradas para esta data.')

    label_by_type = {item['meal_type']: item['meal_label'] for item in categories}
    allowed_types = set(label_by_type.keys())
    provided_types = {item['meal_type'] for item in items}

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
                for item in items
            ]
        )

    total_served = sum(item['served_count'] for item in items)
    return report, total_served


def resolve_consumption_actor_id(school, fallback_user_id=None):
    if fallback_user_id:
        return fallback_user_id

    created_by = Delivery.objects.filter(school=school).order_by('-created_at').values_list('created_by', flat=True).first()
    if not created_by:
        created_by = StockMovement.objects.filter(school=school).order_by('-created_at').values_list('created_by', flat=True).first()
    if not created_by:
        User = get_user_model()
        created_by = (
            User.objects.filter(is_active=True)
            .order_by('-is_superuser', '-is_staff', 'date_joined')
            .values_list('id', flat=True)
            .first()
        )
    if not created_by:
        raise PermissionDenied('Nao foi possivel registrar consumo sem responsavel.')
    return created_by


def apply_school_consumption(school, items, *, created_by_id=None):
    actor_id = resolve_consumption_actor_id(school, fallback_user_id=created_by_id)
    supply_ids = [item['supply'] for item in items]

    low_stock_items = []
    processed_items = []

    with transaction.atomic():
        balances = {
            str(balance.supply_id): balance
            for balance in SchoolStockBalance.objects.select_for_update()
            .select_related('supply')
            .filter(
                school=school,
                supply_id__in=supply_ids,
                quantity__gt=0,
                supply__is_active=True,
            )
        }
        if len(balances) != len(items):
            raise PermissionDenied('Insumo invalido ou sem estoque na escola.')

        for entry in items:
            school_balance = balances.get(str(entry['supply']))
            supply = school_balance.supply

            school_lot_balances_exist = LotBalanceSchool.objects.filter(
                school=school,
                lot__supply=supply,
                quantity__gt=0,
            ).exists()
            if school_lot_balances_exist:
                allocations = fefo_suggestion_service(
                    supply=supply,
                    qty=entry['quantity'],
                    from_central=False,
                    school=school,
                )
                for allocation in allocations:
                    debit_lot_school(school=school, lot=allocation.lot, quantity=allocation.quantity)

            if school_balance.quantity - entry['quantity'] < 0:
                raise PermissionDenied(f'Estoque insuficiente de {supply.name} na escola.')

            school_balance.quantity -= entry['quantity']
            school_balance.save(update_fields=['quantity', 'last_updated'])

            min_stock = school_balance.min_stock if school_balance.min_stock > 0 else supply.min_stock
            if school_balance.quantity < min_stock:
                low_stock_items.append(
                    {
                        'supply_id': str(supply.id),
                        'supply_name': supply.name,
                        'quantity': school_balance.quantity,
                        'min_stock': min_stock,
                        'unit': supply.unit,
                    }
                )

            processed_items.append(
                {
                    'supply_id': str(supply.id),
                    'supply_name': supply.name,
                    'unit': supply.unit,
                    'quantity': entry['quantity'],
                    'remaining_quantity': school_balance.quantity,
                }
            )

            StockMovement.objects.create(
                supply=supply,
                school=school,
                type=StockMovement.Types.OUT,
                quantity=entry['quantity'],
                movement_date=entry['movement_date'],
                note=entry.get('note', ''),
                created_by_id=actor_id,
            )

        if low_stock_items:
            from inventory.models import Notification

            items_text = ', '.join(
                [f"{item['supply_name']} ({item['quantity']:.2f})" for item in low_stock_items]
            )
            Notification.objects.create(
                notification_type=Notification.NotificationType.DELIVERY_DIVERGENCE,
                title=f'Estoque baixo - {school.name}',
                message=f'Os seguintes itens estao com estoque abaixo do limite: {items_text}',
                school=school,
                is_alert=True,
            )

    return {
        'detail': 'Consumo registrado com sucesso.',
        'items_processed': len(processed_items),
        'processed_items': processed_items,
        'low_stock_items': low_stock_items,
    }
