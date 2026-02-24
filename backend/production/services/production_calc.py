from __future__ import annotations

from collections import defaultdict
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP
import re
import unicodedata

from django.db.models import Q

from inventory.models import SchoolStockBalance, Supply
from menus.models import Menu, MenuItem
from production.models import SupplyAlias, SupplyConsumptionRule


ZERO = Decimal('0')
ONE_HUNDRED = Decimal('100')


def normalize_text(s: str) -> str:
    text = unicodedata.normalize('NFKD', (s or '').strip().lower())
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r'[^a-z0-9\s]+', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def parse_ingredients_from_description(description: str) -> list[str]:
    raw = re.split(r'[,;]+', description or '')
    stopwords = {'e', 'com', 'de', 'da', 'do', 'das', 'dos'}
    tokens = []
    for token in raw:
        token = re.sub(r'\([^)]*\)', ' ', token or '')
        token = re.sub(r'\b\d+(?:[.,]\d+)?\s*(kg|g|l|ml|un|und|unit)\b', ' ', token, flags=re.I)
        normalized = normalize_text(token)
        if not normalized:
            continue
        if normalized in stopwords:
            continue
        tokens.append(normalized)
    return tokens


def _to_decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:
        return ZERO


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


def resolve_supply_from_text(token: str, warnings: list[str] | None = None):
    normalized = normalize_text(token)
    if not normalized:
        return None
    alias = SupplyAlias.objects.select_related('supply').filter(alias=normalized).first()
    if alias:
        return alias.supply

    candidates = list(Supply.objects.filter(is_active=True).filter(name__icontains=normalized).order_by('name')[:3])
    if not candidates and ' ' in normalized:
        simplified = normalized.split(' ')[0]
        candidates = list(Supply.objects.filter(is_active=True).filter(name__icontains=simplified).order_by('name')[:3])
    if len(candidates) == 1:
        return candidates[0]
    if len(candidates) > 1 and warnings is not None:
        warnings.append(f'Alias ambiguo para token "{token}".')
    elif warnings is not None:
        warnings.append(f'Insumo nao encontrado para token "{token}".')
    return None


def get_rule(school, supply, meal_type: str):
    return (
        SupplyConsumptionRule.objects.filter(
            school=school,
            supply=supply,
            active=True,
        )
        .filter(Q(meal_type=meal_type) | Q(meal_type=''))
        .order_by('-meal_type')
        .first()
    )


def get_stock_available(school, supply):
    balance = SchoolStockBalance.objects.filter(school=school, supply=supply).first()
    return _to_decimal(balance.quantity) if balance else ZERO


def _round_decimal(value: Decimal, rounding: dict | None):
    rounding = rounding or {}
    mode = str(rounding.get('mode') or 'NEAREST').upper()
    decimals = int(rounding.get('decimals', 2))
    if mode == 'NONE':
        return value
    quantum = Decimal('1').scaleb(-decimals)
    if mode == 'UP':
        return value.quantize(quantum, rounding=ROUND_CEILING)
    return value.quantize(quantum, rounding=ROUND_HALF_UP)


def _students_for_meal(students_by_meal_type: dict, meal_type: str, warnings: list[str]) -> Decimal:
    if meal_type in students_by_meal_type:
        return _to_decimal(students_by_meal_type.get(meal_type))
    if 'DEFAULT' in students_by_meal_type:
        return _to_decimal(students_by_meal_type.get('DEFAULT'))
    warnings.append(f'Sem alunos informados para {meal_type} e sem DEFAULT. Usando 0.')
    return ZERO


def _serialize_decimal(value: Decimal | None):
    if value is None:
        return None
    return float(value)


def calculate_for_menu(menu: Menu, students_by_meal_type: dict, waste_percent=0, include_stock=True, rounding=None) -> dict:
    warnings: list[str] = []
    waste_factor = Decimal('1') + (_to_decimal(waste_percent) / ONE_HUNDRED)
    menu = Menu.objects.select_related('school').prefetch_related(
        'items__recipe__ingredients__supply',
        'items__recipe',
    ).get(pk=menu.pk)

    days_map: dict[str, list[dict]] = defaultdict(list)
    totals_map: dict[tuple[str, str], dict] = {}

    for item in menu.items.all().order_by('day_of_week', 'meal_type', 'created_at'):
        students = _students_for_meal(students_by_meal_type or {}, item.meal_type, warnings)
        meal_result = {
            'meal_type': item.meal_type,
            'meal_name': item.meal_name or '',
            'mode': 'RECIPE' if (item.recipe_id and item.calc_mode == MenuItem.CalcMode.RECIPE) else 'FREE_TEXT',
            'recipe_id': str(item.recipe_id) if item.recipe_id else None,
            'scale_factor': None,
            'ingredients': [],
        }
        meal_agg: dict[tuple[str, str], dict] = {}

        if item.recipe_id and item.calc_mode == MenuItem.CalcMode.RECIPE and item.recipe and item.recipe.servings_base > 0:
            scale_factor = (students / Decimal(item.recipe.servings_base)) if item.recipe.servings_base else ZERO
            meal_result['scale_factor'] = float(scale_factor)
            for ri in item.recipe.ingredients.all():
                qty_needed_raw = _to_decimal(ri.qty_base) * scale_factor * waste_factor
                qty_needed = _round_decimal(qty_needed_raw, rounding)
                key = (str(ri.supply_id), ri.unit)
                entry = meal_agg.setdefault(key, {
                    'supply_id': str(ri.supply_id),
                    'supply_name': ri.supply.name,
                    'unit': ri.unit,
                    'qty_needed_raw': ZERO,
                    'qty_needed': ZERO,
                    'stock_available': ZERO if include_stock else None,
                    'stock_shortage': ZERO if include_stock else None,
                    'source': 'RECIPE',
                    'notes': ri.notes or '',
                })
                entry['qty_needed_raw'] += qty_needed_raw
                entry['qty_needed'] += qty_needed
        else:
            tokens = parse_ingredients_from_description(item.description)
            if not tokens:
                warnings.append(f'Item {item.id} sem receita e sem ingredientes parseaveis.')
            for token in tokens:
                supply = resolve_supply_from_text(token, warnings=warnings)
                if not supply:
                    continue
                rule = get_rule(menu.school, supply, item.meal_type)
                if not rule:
                    key = (str(supply.id), supply.unit)
                    meal_agg.setdefault(key, {
                        'supply_id': str(supply.id),
                        'supply_name': supply.name,
                        'unit': supply.unit,
                        'qty_needed_raw': None,
                        'qty_needed': None,
                        'stock_available': ZERO if include_stock else None,
                        'stock_shortage': None if include_stock else None,
                        'source': 'TEXT_PARSE',
                        'notes': 'Sem regra de consumo por aluno',
                    })
                    warnings.append(f'Sem regra para {supply.name} ({item.meal_type}) na escola {menu.school.name}.')
                    continue
                qty_needed_raw = _to_decimal(rule.qty_per_student) * students * waste_factor
                qty_needed = _round_decimal(qty_needed_raw, rounding)
                key = (str(supply.id), rule.unit)
                entry = meal_agg.setdefault(key, {
                    'supply_id': str(supply.id),
                    'supply_name': supply.name,
                    'unit': rule.unit,
                    'qty_needed_raw': ZERO,
                    'qty_needed': ZERO,
                    'stock_available': ZERO if include_stock else None,
                    'stock_shortage': ZERO if include_stock else None,
                    'source': 'RULE',
                    'notes': rule.notes or '',
                })
                entry['qty_needed_raw'] += qty_needed_raw
                entry['qty_needed'] += qty_needed

        ingredients = []
        for key, entry in sorted(meal_agg.items(), key=lambda kv: kv[1]['supply_name']):
            supply_id, unit = key
            if include_stock:
                supply_obj = Supply.objects.filter(id=supply_id).first()
                stock_qty = get_stock_available(menu.school, supply_obj) if supply_obj else ZERO
                if supply_obj and supply_obj.unit != unit:
                    converted = _convert_qty(stock_qty, supply_obj.unit, unit)
                    if converted is None:
                        warnings.append(f'Unidade incompatível para estoque de {entry["supply_name"]}: saldo {supply_obj.unit} vs calculo {unit}.')
                        stock_qty_effective = ZERO
                    else:
                        stock_qty_effective = converted
                else:
                    stock_qty_effective = stock_qty
                entry['stock_available'] = stock_qty_effective
                if entry['qty_needed'] is None:
                    entry['stock_shortage'] = None
                else:
                    entry['stock_shortage'] = max(ZERO, entry['qty_needed'] - stock_qty_effective)
            ingredients.append({
                'supply_id': entry['supply_id'],
                'supply_name': entry['supply_name'],
                'unit': entry['unit'],
                'qty_needed': _serialize_decimal(entry['qty_needed']) if entry['qty_needed'] is not None else None,
                'qty_needed_raw': _serialize_decimal(entry['qty_needed_raw']) if entry['qty_needed_raw'] is not None else None,
                'stock_available': _serialize_decimal(entry['stock_available']) if entry['stock_available'] is not None else None,
                'stock_shortage': _serialize_decimal(entry['stock_shortage']) if entry['stock_shortage'] is not None else None,
                'source': entry['source'],
                'notes': entry['notes'] or '',
            })
            # weekly totals only for resolvable numeric rows
            if entry['qty_needed'] is None:
                continue
            tkey = (entry['supply_id'], entry['unit'])
            total = totals_map.setdefault(tkey, {
                'supply_id': entry['supply_id'],
                'supply_name': entry['supply_name'],
                'unit': entry['unit'],
                'qty_needed': ZERO,
                'stock_available': ZERO if include_stock else None,
                'stock_shortage': ZERO if include_stock else None,
            })
            total['qty_needed'] += entry['qty_needed']
            if include_stock and entry['stock_available'] is not None:
                total['stock_available'] = max(total['stock_available'], entry['stock_available'])

        meal_result['ingredients'] = ingredients
        days_map[item.day_of_week].append(meal_result)

    totals_week = []
    for _, total in sorted(totals_map.items(), key=lambda kv: kv[1]['supply_name']):
        if include_stock and total['stock_available'] is not None:
            total['stock_shortage'] = max(ZERO, total['qty_needed'] - total['stock_available'])
        totals_week.append({
            'supply_id': total['supply_id'],
            'supply_name': total['supply_name'],
            'unit': total['unit'],
            'qty_needed': _serialize_decimal(total['qty_needed']),
            'stock_available': _serialize_decimal(total['stock_available']) if total['stock_available'] is not None else None,
            'stock_shortage': _serialize_decimal(total['stock_shortage']) if total['stock_shortage'] is not None else None,
        })

    days = [
        {'day_of_week': day, 'meals': meals}
        for day, meals in sorted(days_map.items(), key=lambda kv: kv[0])
    ]

    return {
        'menu_id': str(menu.id),
        'school_id': str(menu.school_id),
        'week_start': menu.week_start.isoformat(),
        'week_end': menu.week_end.isoformat(),
        'waste_percent': float(_to_decimal(waste_percent)),
        'include_stock': bool(include_stock),
        'warnings': list(dict.fromkeys(warnings)),
        'days': days,
        'totals_week': totals_week,
    }
