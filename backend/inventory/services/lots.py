from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import F, Q
from rest_framework.exceptions import ValidationError

from inventory.models import (
    DeliveryItem,
    DeliveryItemLot,
    LotBalanceCentral,
    LotBalanceSchool,
    SchoolStockBalance,
    StockBalance,
    SupplierReceiptItem,
    Supply,
    SupplyLot,
)


ZERO = Decimal('0')


@dataclass
class LotAllocation:
    lot: SupplyLot
    quantity: Decimal


def _as_decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value or 0))


def refresh_expired_lot_status(lot: SupplyLot, today: date | None = None) -> SupplyLot:
    """Marks ACTIVE lots as EXPIRED when expiry date has passed."""
    today = today or date.today()
    if lot.status == SupplyLot.Status.ACTIVE and lot.expiry_date < today:
        lot.status = SupplyLot.Status.EXPIRED
        lot.save(update_fields=['status', 'updated_at'])
    return lot


def get_or_create_supply_lot(
    *,
    supply: Supply,
    lot_code: str,
    expiry_date: date,
    manufacture_date: date | None = None,
    supplier=None,
    invoice_ref: str = '',
) -> SupplyLot:
    lot_code = (lot_code or '').strip()
    if not lot_code:
        raise ValidationError('lot_code obrigatorio.')
    lot, created = SupplyLot.objects.get_or_create(
        supply=supply,
        lot_code=lot_code,
        expiry_date=expiry_date,
        defaults={
            'manufacture_date': manufacture_date,
            'supplier': supplier,
            'invoice_ref': invoice_ref or '',
            'storage_instructions_snapshot': supply.storage_instructions or '',
            'status': SupplyLot.Status.ACTIVE,
        },
    )
    # Keep immutable snapshot on creation; only fill empty metadata when absent.
    update_fields: list[str] = []
    if not created:
        if manufacture_date and not lot.manufacture_date:
            lot.manufacture_date = manufacture_date
            update_fields.append('manufacture_date')
        if supplier and not lot.supplier_id:
            lot.supplier = supplier
            update_fields.append('supplier')
        if invoice_ref and not lot.invoice_ref:
            lot.invoice_ref = invoice_ref
            update_fields.append('invoice_ref')
        if update_fields:
            update_fields.append('updated_at')
            lot.save(update_fields=update_fields)
    return refresh_expired_lot_status(lot)


def _validate_lot_usable(lot: SupplyLot):
    refresh_expired_lot_status(lot)
    if lot.status in [SupplyLot.Status.BLOCKED, SupplyLot.Status.EXPIRED, SupplyLot.Status.DISCARDED]:
        raise ValidationError(f'Lote {lot.lot_code} indisponivel para movimentacao ({lot.status}).')


def credit_lot_central(lot: SupplyLot, quantity) -> LotBalanceCentral:
    qty = _as_decimal(quantity)
    if qty < 0:
        raise ValidationError('Quantidade de credito por lote deve ser >= 0.')
    _validate_lot_usable(lot) if qty > 0 else None
    balance, _ = LotBalanceCentral.objects.select_for_update().get_or_create(lot=lot, defaults={'quantity': ZERO})
    balance.quantity = _as_decimal(balance.quantity) + qty
    balance.save(update_fields=['quantity', 'updated_at'])
    return balance


def debit_lot_central(lot: SupplyLot, quantity) -> LotBalanceCentral:
    qty = _as_decimal(quantity)
    if qty < 0:
        raise ValidationError('Quantidade de debito por lote deve ser >= 0.')
    _validate_lot_usable(lot) if qty > 0 else None
    balance, _ = LotBalanceCentral.objects.select_for_update().get_or_create(lot=lot, defaults={'quantity': ZERO})
    if _as_decimal(balance.quantity) - qty < 0:
        raise ValidationError(f'Saldo insuficiente no lote central {lot.lot_code}.')
    balance.quantity = _as_decimal(balance.quantity) - qty
    balance.save(update_fields=['quantity', 'updated_at'])
    return balance


def credit_lot_school(*, school, lot: SupplyLot, quantity) -> LotBalanceSchool:
    qty = _as_decimal(quantity)
    if qty < 0:
        raise ValidationError('Quantidade de credito por lote deve ser >= 0.')
    _validate_lot_usable(lot) if qty > 0 else None
    balance, _ = LotBalanceSchool.objects.select_for_update().get_or_create(
        school=school,
        lot=lot,
        defaults={'quantity': ZERO},
    )
    balance.quantity = _as_decimal(balance.quantity) + qty
    balance.save(update_fields=['quantity', 'updated_at'])
    return balance


def debit_lot_school(*, school, lot: SupplyLot, quantity) -> LotBalanceSchool:
    qty = _as_decimal(quantity)
    if qty < 0:
        raise ValidationError('Quantidade de debito por lote deve ser >= 0.')
    _validate_lot_usable(lot) if qty > 0 else None
    balance, _ = LotBalanceSchool.objects.select_for_update().get_or_create(
        school=school,
        lot=lot,
        defaults={'quantity': ZERO},
    )
    if _as_decimal(balance.quantity) - qty < 0:
        raise ValidationError(f'Saldo insuficiente no lote {lot.lot_code} da escola.')
    balance.quantity = _as_decimal(balance.quantity) - qty
    balance.save(update_fields=['quantity', 'updated_at'])
    return balance


def fefo_suggestion_service(*, supply: Supply, qty, from_central: bool = True, school=None) -> list[LotAllocation]:
    """Return FEFO lot allocations for a requested quantity without persisting."""
    requested = _as_decimal(qty)
    if requested <= 0:
        return []

    today = date.today()
    if from_central:
        balances = (
            LotBalanceCentral.objects.select_related('lot', 'lot__supply')
            .filter(
                lot__supply=supply,
                quantity__gt=0,
                lot__status=SupplyLot.Status.ACTIVE,
            )
            .filter(Q(lot__expiry_date__gte=today))
            .order_by('lot__expiry_date', 'lot__lot_code', 'lot__created_at')
        )
    else:
        if school is None:
            raise ValidationError('school obrigatorio para FEFO da escola.')
        balances = (
            LotBalanceSchool.objects.select_related('lot', 'lot__supply')
            .filter(
                school=school,
                lot__supply=supply,
                quantity__gt=0,
                lot__status=SupplyLot.Status.ACTIVE,
            )
            .filter(Q(lot__expiry_date__gte=today))
            .order_by('lot__expiry_date', 'lot__lot_code', 'lot__created_at')
        )

    remaining = requested
    allocations: list[LotAllocation] = []
    for balance in balances:
        available = _as_decimal(balance.quantity)
        if available <= 0:
            continue
        take = min(available, remaining)
        if take > 0:
            allocations.append(LotAllocation(lot=balance.lot, quantity=take))
            remaining -= take
        if remaining <= 0:
            break

    if remaining > 0:
        origin = 'central' if from_central else 'escola'
        raise ValidationError(f'Saldo por lote insuficiente para {supply.name} no estoque {origin}.')
    return allocations


def replace_delivery_item_lot_plan(delivery_item: DeliveryItem, allocations: list[LotAllocation]) -> list[DeliveryItemLot]:
    """Replace planned lot composition for a delivery item."""
    if delivery_item.delivery.status != delivery_item.delivery.Status.DRAFT:
        raise ValidationError('Somente entregas em rascunho podem ter lotes planejados alterados.')
    DeliveryItemLot.objects.filter(delivery_item=delivery_item).delete()
    rows = [
        DeliveryItemLot(
            delivery_item=delivery_item,
            lot=allocation.lot,
            planned_quantity=allocation.quantity,
        )
        for allocation in allocations
        if _as_decimal(allocation.quantity) > 0
    ]
    if rows:
        DeliveryItemLot.objects.bulk_create(rows)
    return list(DeliveryItemLot.objects.filter(delivery_item=delivery_item).select_related('lot'))


def regenerate_delivery_item_lot_plan_fefo(delivery_item: DeliveryItem) -> list[DeliveryItemLot]:
    allocations = fefo_suggestion_service(supply=delivery_item.supply, qty=delivery_item.planned_quantity, from_central=True)
    return replace_delivery_item_lot_plan(delivery_item, allocations)


def ensure_delivery_item_lot_plan(delivery_item: DeliveryItem) -> list[DeliveryItemLot]:
    lots = list(DeliveryItemLot.objects.select_related('lot').filter(delivery_item=delivery_item))
    if not lots and _as_decimal(delivery_item.planned_quantity) > 0:
        lots = regenerate_delivery_item_lot_plan_fefo(delivery_item)
    planned_sum = sum((_as_decimal(row.planned_quantity) for row in lots), ZERO)
    if planned_sum != _as_decimal(delivery_item.planned_quantity):
        raise ValidationError(f'Soma dos lotes planejados difere da quantidade planejada de {delivery_item.supply.name}.')
    return lots


def ensure_aggregate_balance_consistency_for_credit(*, supply: Supply, quantity, school=None):
    """Optional helper to keep aggregate balances in sync in custom flows."""
    qty = _as_decimal(quantity)
    if school is None:
        balance, _ = StockBalance.objects.select_for_update().get_or_create(supply=supply, defaults={'quantity': ZERO})
        balance.quantity = _as_decimal(balance.quantity) + qty
        balance.save(update_fields=['quantity'])
        return balance
    school_balance, _ = SchoolStockBalance.objects.select_for_update().get_or_create(
        school=school, supply=supply, defaults={'quantity': ZERO, 'min_stock': ZERO}
    )
    school_balance.quantity = _as_decimal(school_balance.quantity) + qty
    school_balance.save(update_fields=['quantity', 'last_updated'])
    return school_balance
