from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from inventory.models import Delivery, DeliveryItem, SchoolStockBalance, StockBalance
from menus.models import Menu, MenuItem

from .models import (
    PnaeAnnualAction,
    PnaeAnnualGoal,
    PnaeAnnualPlan,
    PnaeAnnualPlanItem,
    PnaeAnnualPlanMonthlyExecution,
    PnaeAnnualPlanWorkflowEvent,
)


ZERO = Decimal('0')
WEEKLY_BASE = Decimal('5')
MONTH_LABELS = {
    1: 'Janeiro',
    2: 'Fevereiro',
    3: 'Marco',
    4: 'Abril',
    5: 'Maio',
    6: 'Junho',
    7: 'Julho',
    8: 'Agosto',
    9: 'Setembro',
    10: 'Outubro',
    11: 'Novembro',
    12: 'Dezembro',
}
DAY_OF_WEEK_MAP = {
    0: MenuItem.DayOfWeek.MON,
    1: MenuItem.DayOfWeek.TUE,
    2: MenuItem.DayOfWeek.WED,
    3: MenuItem.DayOfWeek.THU,
    4: MenuItem.DayOfWeek.FRI,
}


class PnaeWorkflowError(ValueError):
    pass


def _to_decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value or 0))
    except Exception:
        return ZERO


def _round_decimal(value: Decimal) -> Decimal:
    return value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _convert_qty(value: Decimal, unit_from: str, unit_to: str):
    if unit_from == unit_to:
        return value
    if unit_from == 'g' and unit_to == 'kg':
        return value / Decimal('1000')
    if unit_from == 'kg' and unit_to == 'g':
        return value * Decimal('1000')
    if unit_from == 'ml' and unit_to == 'l':
        return value / Decimal('1000')
    if unit_from == 'l' and unit_to == 'ml':
        return value * Decimal('1000')
    return None


def get_business_days(year: int, month: int) -> list[date]:
    _, total_days = calendar.monthrange(year, month)
    return [
        date(year, month, day)
        for day in range(1, total_days + 1)
        if date(year, month, day).weekday() < 5
    ]


def calculate_monthly_occurrences(year: int, month: int, weekly_frequency: int) -> int:
    business_days = len(get_business_days(year, month))
    if business_days <= 0 or weekly_frequency <= 0:
        return 0
    ratio = Decimal(str(weekly_frequency)) / WEEKLY_BASE
    occurrences = (Decimal(business_days) * ratio).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    return max(1, int(occurrences))


def pick_service_dates(year: int, month: int, occurrences: int, offset: int = 0) -> list[date]:
    business_days = get_business_days(year, month)
    if occurrences <= 0 or not business_days:
        return []
    if occurrences >= len(business_days):
        return business_days

    selected: list[date] = []
    used_indexes: set[int] = set()
    for index in range(occurrences):
        base_position = ((index + 1) * len(business_days)) / (occurrences + 1)
        position = int(round(base_position - 1 + (offset * 0.35)))
        position = max(0, min(len(business_days) - 1, position))
        while position in used_indexes and position < len(business_days) - 1:
            position += 1
        while position in used_indexes and position > 0:
            position -= 1
        used_indexes.add(position)
        selected.append(business_days[position])
    return sorted(selected)


def ensure_plan_editable(plan: PnaeAnnualPlan):
    if plan.is_locked:
        raise PnaeWorkflowError('Este plano esta bloqueado para edicao apos aprovacao/arquivamento.')


def record_workflow_event(
    plan: PnaeAnnualPlan,
    *,
    action: str,
    actor,
    from_status: str,
    to_status: str,
    comment: str = '',
):
    return PnaeAnnualPlanWorkflowEvent.objects.create(
        plan=plan,
        action=action,
        actor=actor,
        from_status=from_status or '',
        to_status=to_status,
        comment=comment or '',
    )


@transaction.atomic
def submit_plan_for_review(plan: PnaeAnnualPlan, actor, comment: str = '') -> PnaeAnnualPlan:
    ensure_plan_editable(plan)
    if plan.status not in {PnaeAnnualPlan.Status.DRAFT, PnaeAnnualPlan.Status.REJECTED}:
        raise PnaeWorkflowError('Somente planos em rascunho ou reprovados podem ser submetidos.')
    previous_status = plan.status
    plan.status = PnaeAnnualPlan.Status.IN_REVIEW
    plan.submitted_by = actor
    plan.submitted_at = timezone.now()
    plan.last_review_comment = comment or ''
    plan.save(update_fields=['status', 'submitted_by', 'submitted_at', 'last_review_comment', 'updated_at'])
    record_workflow_event(
        plan,
        action=PnaeAnnualPlanWorkflowEvent.Action.SUBMITTED,
        actor=actor,
        from_status=previous_status,
        to_status=plan.status,
        comment=comment,
    )
    return plan


@transaction.atomic
def approve_plan(plan: PnaeAnnualPlan, actor, comment: str = '') -> PnaeAnnualPlan:
    if plan.status != PnaeAnnualPlan.Status.IN_REVIEW:
        raise PnaeWorkflowError('Somente planos em revisao podem ser aprovados.')
    previous_status = plan.status
    plan.status = PnaeAnnualPlan.Status.APPROVED
    plan.approved_by = actor
    plan.approved_at = timezone.now()
    plan.last_review_comment = comment or ''
    plan.save(update_fields=['status', 'approved_by', 'approved_at', 'last_review_comment', 'updated_at'])
    record_workflow_event(
        plan,
        action=PnaeAnnualPlanWorkflowEvent.Action.APPROVED,
        actor=actor,
        from_status=previous_status,
        to_status=plan.status,
        comment=comment,
    )
    sync_monthly_execution_snapshots(plan)
    return plan


@transaction.atomic
def reject_plan(plan: PnaeAnnualPlan, actor, comment: str = '') -> PnaeAnnualPlan:
    if plan.status != PnaeAnnualPlan.Status.IN_REVIEW:
        raise PnaeWorkflowError('Somente planos em revisao podem ser reprovados.')
    previous_status = plan.status
    plan.status = PnaeAnnualPlan.Status.REJECTED
    plan.rejected_by = actor
    plan.rejected_at = timezone.now()
    plan.last_review_comment = comment or ''
    plan.save(update_fields=['status', 'rejected_by', 'rejected_at', 'last_review_comment', 'updated_at'])
    record_workflow_event(
        plan,
        action=PnaeAnnualPlanWorkflowEvent.Action.REJECTED,
        actor=actor,
        from_status=previous_status,
        to_status=plan.status,
        comment=comment,
    )
    return plan


def sync_monthly_execution_snapshots(plan: PnaeAnnualPlan):
    totals_by_month: dict[int, int] = defaultdict(int)
    for item in plan.items.all():
        monthly_occurrences = calculate_monthly_occurrences(plan.year, item.month, item.weekly_frequency)
        totals_by_month[item.month] += item.servings_planned * monthly_occurrences

    for month, planned_servings in totals_by_month.items():
        execution, _ = PnaeAnnualPlanMonthlyExecution.objects.get_or_create(
            plan=plan,
            month=month,
            defaults={'planned_servings': planned_servings},
        )
        if execution.planned_servings != planned_servings:
            execution.planned_servings = planned_servings
            execution.save(update_fields=['planned_servings', 'updated_at'])


def build_month_projection(plan: PnaeAnnualPlan, month: int) -> dict:
    items = list(
        plan.items.filter(month=month)
        .select_related('education_stage', 'education_modality', 'recipe')
        .prefetch_related('recipe__ingredients__supply')
        .order_by('meal_type', 'education_stage__name', 'education_modality__name')
    )
    warnings: list[str] = []
    school_balances = {
        str(balance.supply_id): balance.quantity
        for balance in SchoolStockBalance.objects.select_related('supply').filter(school=plan.school)
    }
    central_balances = {
        str(balance.supply_id): balance.quantity
        for balance in StockBalance.objects.select_related('supply').all()
    }

    procurement_map: dict[tuple[str, str], dict] = {}
    plan_items_data: list[dict] = []
    menu_projection: list[dict] = []
    meal_offsets: dict[str, int] = defaultdict(int)

    for item in items:
        monthly_occurrences = calculate_monthly_occurrences(plan.year, item.month, item.weekly_frequency)
        projected_servings = item.servings_planned * monthly_occurrences
        dates = pick_service_dates(plan.year, item.month, monthly_occurrences, meal_offsets[item.meal_type])
        meal_offsets[item.meal_type] += 1
        estimated_cost = ZERO

        if item.recipe_id and item.recipe and item.recipe.servings_base > 0:
            scale_factor = _to_decimal(projected_servings) / _to_decimal(item.recipe.servings_base)
            for ingredient in item.recipe.ingredients.all():
                qty_needed = _round_decimal(_to_decimal(ingredient.qty_base) * scale_factor)
                cost_reference = _to_decimal(ingredient.net_weight) or _to_decimal(ingredient.qty_base)
                estimated_cost += _round_decimal(cost_reference * scale_factor * _to_decimal(ingredient.unit_cost))
                key = (str(ingredient.supply_id), ingredient.unit)
                aggregate = procurement_map.setdefault(key, {
                    'supply_id': str(ingredient.supply_id),
                    'supply_name': ingredient.supply.name,
                    'unit': ingredient.unit,
                    'qty_needed': ZERO,
                    'estimated_cost': ZERO,
                    'school_stock_available': ZERO,
                    'central_stock_available': ZERO,
                    'school_shortage': ZERO,
                    'central_shortage': ZERO,
                })
                aggregate['qty_needed'] += qty_needed
                aggregate['estimated_cost'] += _round_decimal(cost_reference * scale_factor * _to_decimal(ingredient.unit_cost))

                school_stock = _to_decimal(school_balances.get(str(ingredient.supply_id), 0))
                central_stock = _to_decimal(central_balances.get(str(ingredient.supply_id), 0))
                if ingredient.supply.unit != ingredient.unit:
                    converted_school = _convert_qty(school_stock, ingredient.supply.unit, ingredient.unit)
                    converted_central = _convert_qty(central_stock, ingredient.supply.unit, ingredient.unit)
                    school_stock = converted_school if converted_school is not None else ZERO
                    central_stock = converted_central if converted_central is not None else ZERO
                aggregate['school_stock_available'] = school_stock
                aggregate['central_stock_available'] = central_stock
        else:
            warnings.append(
                f'Item {item.id} ({item.get_meal_type_display()}) nao possui receita vinculada para projecao operacional.'
            )

        for service_date in dates:
            week_start = service_date - timedelta(days=service_date.weekday())
            week_end = week_start + timedelta(days=4)
            menu_projection.append({
                'date': service_date.isoformat(),
                'day_of_week': DAY_OF_WEEK_MAP[service_date.weekday()],
                'week_start': week_start.isoformat(),
                'week_end': week_end.isoformat(),
                'meal_type': item.meal_type,
                'meal_type_display': item.get_meal_type_display(),
                'recipe_id': str(item.recipe_id) if item.recipe_id else None,
                'recipe_name': item.recipe.name if item.recipe_id and item.recipe else '',
                'education_stage_name': item.education_stage.name,
                'education_modality_name': item.education_modality.name,
                'servings_planned': item.servings_planned,
                'plan_item_id': str(item.id),
            })

        plan_items_data.append({
            'id': str(item.id),
            'month': item.month,
            'education_stage_name': item.education_stage.name,
            'education_modality_name': item.education_modality.name,
            'meal_type': item.meal_type,
            'meal_type_display': item.get_meal_type_display(),
            'recipe_id': str(item.recipe_id) if item.recipe_id else None,
            'recipe_name': item.recipe.name if item.recipe_id and item.recipe else '',
            'weekly_frequency': item.weekly_frequency,
            'monthly_occurrences': monthly_occurrences,
            'projected_servings': projected_servings,
            'estimated_cost': float(_round_decimal(estimated_cost)),
            'notes': item.notes or '',
        })

    procurement = []
    for _, entry in sorted(procurement_map.items(), key=lambda item: item[1]['supply_name']):
        entry['qty_needed'] = _round_decimal(entry['qty_needed'])
        entry['estimated_cost'] = _round_decimal(entry['estimated_cost'])
        entry['school_shortage'] = max(ZERO, entry['qty_needed'] - entry['school_stock_available'])
        entry['central_shortage'] = max(ZERO, entry['school_shortage'] - entry['central_stock_available'])
        procurement.append({
            'supply_id': entry['supply_id'],
            'supply_name': entry['supply_name'],
            'unit': entry['unit'],
            'qty_needed': float(entry['qty_needed']),
            'estimated_cost': float(entry['estimated_cost']),
            'school_stock_available': float(entry['school_stock_available']),
            'central_stock_available': float(entry['central_stock_available']),
            'school_shortage': float(entry['school_shortage']),
            'central_shortage': float(entry['central_shortage']),
        })

    projected_occurrences = sum(item['monthly_occurrences'] for item in plan_items_data)
    projected_servings = sum(item['projected_servings'] for item in plan_items_data)
    estimated_cost_total = sum(item['estimated_cost'] for item in plan_items_data)

    return {
        'month': month,
        'month_label': MONTH_LABELS.get(month, str(month)),
        'summary': {
            'projected_items': len(plan_items_data),
            'projected_occurrences': projected_occurrences,
            'projected_servings': projected_servings,
            'estimated_cost': round(estimated_cost_total, 2),
            'supplies_with_shortage': sum(1 for entry in procurement if entry['school_shortage'] > 0),
            'supplies_uncovered_centrally': sum(1 for entry in procurement if entry['central_shortage'] > 0),
        },
        'items': plan_items_data,
        'menu_projection': menu_projection,
        'procurement': procurement,
        'warnings': list(dict.fromkeys(warnings)),
    }


def build_operational_summary(plan: PnaeAnnualPlan, selected_month: int | None = None) -> dict:
    months = sorted(set(plan.items.values_list('month', flat=True)))
    if not months:
        selected_month = selected_month or timezone.localdate().month
        empty = {
            'month': selected_month,
            'month_label': MONTH_LABELS.get(selected_month, str(selected_month)),
            'summary': {
                'projected_items': 0,
                'projected_occurrences': 0,
                'projected_servings': 0,
                'estimated_cost': 0,
                'supplies_with_shortage': 0,
                'supplies_uncovered_centrally': 0,
            },
            'items': [],
            'menu_projection': [],
            'procurement': [],
            'warnings': ['Nenhum item do plano foi cadastrado para gerar projecoes operacionais.'],
        }
        return {
            'selected_month': selected_month,
            'selected_month_label': empty['month_label'],
            'monthly_overview': [],
            'detail': empty,
            'annual_summary': empty['summary'],
        }

    selected_month = selected_month if selected_month in months else months[0]
    monthly_details = [build_month_projection(plan, month) for month in months]
    detail = next(item for item in monthly_details if item['month'] == selected_month)
    annual_summary = {
        'projected_items': sum(item['summary']['projected_items'] for item in monthly_details),
        'projected_occurrences': sum(item['summary']['projected_occurrences'] for item in monthly_details),
        'projected_servings': sum(item['summary']['projected_servings'] for item in monthly_details),
        'estimated_cost': round(sum(item['summary']['estimated_cost'] for item in monthly_details), 2),
        'supplies_with_shortage': sum(item['summary']['supplies_with_shortage'] for item in monthly_details),
        'supplies_uncovered_centrally': sum(item['summary']['supplies_uncovered_centrally'] for item in monthly_details),
    }
    monthly_overview = [
        {
            'month': item['month'],
            'month_label': item['month_label'],
            **item['summary'],
        }
        for item in monthly_details
    ]
    return {
        'selected_month': selected_month,
        'selected_month_label': MONTH_LABELS.get(selected_month, str(selected_month)),
        'monthly_overview': monthly_overview,
        'detail': detail,
        'annual_summary': annual_summary,
    }


@transaction.atomic
def generate_menu_drafts_from_plan(plan: PnaeAnnualPlan, month: int, user) -> dict:
    projection = build_month_projection(plan, month)
    warnings = list(projection['warnings'])
    weeks_map: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for entry in projection['menu_projection']:
        weeks_map[(entry['week_start'], entry['week_end'])].append(entry)

    created_menus = []
    for (week_start, week_end), entries in sorted(weeks_map.items()):
        week_start_date = date.fromisoformat(week_start)
        week_end_date = date.fromisoformat(week_end)
        menu, created = Menu.objects.get_or_create(
            school=plan.school,
            week_start=week_start_date,
            defaults={
                'week_end': week_end_date,
                'name': f'Plano PNAE {MONTH_LABELS.get(month, month)} {plan.year}',
                'status': Menu.Status.DRAFT,
                'notes': f'Gerado automaticamente a partir do plano PNAE {plan.id}.',
                'created_by': user,
                'author_name': getattr(user, 'name', ''),
                'author_crn': getattr(user, 'crn', ''),
            },
        )
        if not created and menu.items.exists():
            warnings.append(
                f'Ja existe cardapio preenchido para a semana iniciada em {week_start}. O rascunho nao foi sobrescrito.'
            )
            continue
        if not created:
            menu.week_end = week_end_date
            menu.status = Menu.Status.DRAFT
            menu.notes = f'Gerado automaticamente a partir do plano PNAE {plan.id}.'
            menu.author_name = getattr(user, 'name', '')
            menu.author_crn = getattr(user, 'crn', '')
            menu.save(update_fields=['week_end', 'status', 'notes', 'author_name', 'author_crn', 'updated_at'])
            menu.items.all().delete()

        menu_items = [
            MenuItem(
                menu=menu,
                day_of_week=entry['day_of_week'],
                meal_type=entry['meal_type'],
                meal_name=entry['meal_type_display'],
                description=entry['recipe_name'] or f"Item planejado para {entry['education_stage_name']}",
                recipe_id=entry['recipe_id'],
            )
            for entry in entries
            if entry['recipe_id']
        ]
        MenuItem.objects.bulk_create(menu_items)
        created_menus.append({
            'id': str(menu.id),
            'week_start': menu.week_start.isoformat(),
            'week_end': menu.week_end.isoformat(),
            'items_created': len(menu_items),
        })

    return {
        'created_menus': created_menus,
        'warnings': warnings,
    }


@transaction.atomic
def generate_delivery_draft_from_plan(plan: PnaeAnnualPlan, month: int, user) -> dict:
    projection = build_month_projection(plan, month)
    shortages = [entry for entry in projection['procurement'] if entry['school_shortage'] > 0]
    if not shortages:
        raise PnaeWorkflowError('Nao ha necessidade de reposicao para gerar entrega deste mes.')

    business_days = get_business_days(plan.year, month)
    delivery_date = business_days[0] if business_days else date(plan.year, month, 1)
    delivery = Delivery.objects.create(
        school=plan.school,
        delivery_date=delivery_date,
        notes=f'Gerado automaticamente a partir do plano PNAE {plan.id} para {MONTH_LABELS.get(month, month)}/{plan.year}.',
        status=Delivery.Status.DRAFT,
        created_by=user,
    )
    DeliveryItem.objects.bulk_create([
        DeliveryItem(
            delivery=delivery,
            supply_id=item['supply_id'],
            planned_quantity=_to_decimal(item['school_shortage']),
        )
        for item in shortages
    ])
    return {
        'delivery_id': str(delivery.id),
        'delivery_date': delivery.delivery_date.isoformat(),
        'items_created': len(shortages),
    }


def build_dashboard_metrics(queryset) -> dict:
    today = timezone.localdate()
    plans = queryset
    plan_ids = list(plans.values_list('id', flat=True))
    if not plan_ids:
        return {
            'plans_by_status': {status: 0 for status, _ in PnaeAnnualPlan.Status.choices},
            'overdue_goals': 0,
            'delayed_actions': 0,
            'budget_estimated': 0,
            'budget_executed': 0,
            'schools_covered': 0,
            'stages_covered': 0,
            'modalities_covered': 0,
            'monthly_execution_open': 0,
        }

    budget_totals = plans.aggregate(
        total_estimated=Sum('budget_items__estimated_amount'),
        total_executed=Sum('budget_items__executed_amount'),
    )
    return {
        'plans_by_status': {
            status: plans.filter(status=status).count()
            for status, _ in PnaeAnnualPlan.Status.choices
        },
        'overdue_goals': PnaeAnnualGoal.objects.filter(
            plan_id__in=plan_ids,
            due_date__lt=today,
        ).count(),
        'delayed_actions': PnaeAnnualAction.objects.filter(
            plan_id__in=plan_ids,
            end_date__lt=today,
        ).exclude(status__in=[PnaeAnnualAction.Status.COMPLETED, PnaeAnnualAction.Status.CANCELLED]).count(),
        'budget_estimated': float(_to_decimal(budget_totals['total_estimated'])),
        'budget_executed': float(_to_decimal(budget_totals['total_executed'])),
        'schools_covered': plans.values('school_id').distinct().count(),
        'stages_covered': PnaeAnnualPlanItem.objects.filter(plan_id__in=plan_ids).values('education_stage_id').distinct().count(),
        'modalities_covered': PnaeAnnualPlanItem.objects.filter(plan_id__in=plan_ids).values('education_modality_id').distinct().count(),
        'monthly_execution_open': PnaeAnnualPlanMonthlyExecution.objects.filter(
            plan_id__in=plan_ids,
        ).exclude(status=PnaeAnnualPlanMonthlyExecution.Status.COMPLETED).count(),
    }
