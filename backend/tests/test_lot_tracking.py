from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from inventory.models import (
    Delivery,
    DeliveryItem,
    DeliveryItemLot,
    LotBalanceCentral,
    LotBalanceSchool,
    Notification,
    SchoolStockBalance,
    StockBalance,
    StockMovement,
    Supplier,
    SupplierReceipt,
    SupplierReceiptItem,
    SupplierReceiptItemLot,
    Supply,
    SupplyLot,
)
from inventory.services.lots import fefo_suggestion_service
from schools.models import School


pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user():
    User = get_user_model()
    user = User.objects.create(
        email='lots@semed.local',
        name='Lots Admin',
        role=User.Roles.SEMED_ADMIN,
        is_staff=True,
        is_superuser=True,
        is_active=True,
    )
    user.set_password('Test123!')
    user.save(update_fields=['password'])
    return user


@pytest.fixture
def school():
    return School.objects.create(name='Escola Lotes')


@pytest.fixture
def supply():
    return Supply.objects.create(
        name='Arroz Agulhinha',
        category='Graos',
        unit=Supply.Units.KG,
        min_stock=0,
        storage_instructions='Manter em local seco e ventilado.',
    )


@pytest.fixture
def supplier():
    return Supplier.objects.create(name='Fornecedor Teste')


def _sig():
    return 'data:image/png;base64,AAAA'


def _auth(client, user):
    client.force_authenticate(user=user)
    return client


def test_fefo_suggestion_orders_by_expiry_and_composes(supply):
    today = date.today()
    lot1 = SupplyLot.objects.create(supply=supply, lot_code='L2', expiry_date=today + timedelta(days=10))
    lot2 = SupplyLot.objects.create(supply=supply, lot_code='L1', expiry_date=today + timedelta(days=5))
    lot3 = SupplyLot.objects.create(supply=supply, lot_code='L3', expiry_date=today + timedelta(days=20), status=SupplyLot.Status.BLOCKED)
    LotBalanceCentral.objects.create(lot=lot1, quantity=Decimal('4'))
    LotBalanceCentral.objects.create(lot=lot2, quantity=Decimal('3'))
    LotBalanceCentral.objects.create(lot=lot3, quantity=Decimal('100'))

    allocations = fefo_suggestion_service(supply=supply, qty=Decimal('6'), from_central=True)
    assert [(a.lot.lot_code, a.quantity) for a in allocations] == [('L1', Decimal('3')), ('L2', Decimal('3'))]


def test_supplier_receipt_conference_creates_lots_and_updates_central_balances(api_client, admin_user, supply, supplier):
    client = _auth(api_client, admin_user)
    receipt = SupplierReceipt.objects.create(
        supplier=supplier,
        expected_date=date.today(),
        created_by=admin_user,
    )
    item = SupplierReceiptItem.objects.create(
        receipt=receipt,
        supply=supply,
        unit=supply.unit,
        expected_quantity=Decimal('10'),
    )

    response = client.post(
        f'/api/supplier-receipts/{receipt.id}/submit_conference/',
        {
            'items': [{
                'item_id': str(item.id),
                'received_quantity': '10.00',
                'note': '',
                'lots': [
                    {'lot_code': 'A1', 'expiry_date': (date.today() + timedelta(days=60)).isoformat(), 'received_quantity': '6.00'},
                    {'lot_code': 'A2', 'expiry_date': (date.today() + timedelta(days=90)).isoformat(), 'received_quantity': '4.00'},
                ],
            }],
            'sender_signature_data': _sig(),
            'sender_signer_name': 'Fornecedor',
            'receiver_signature_data': _sig(),
            'receiver_signer_name': 'SEMED',
        },
        format='json',
    )

    assert response.status_code == 200, response.data
    assert SupplierReceiptItemLot.objects.filter(receipt_item=item).count() == 2
    assert SupplyLot.objects.filter(supply=supply, lot_code='A1').exists()
    assert StockBalance.objects.get(supply=supply).quantity == Decimal('10.00')
    assert LotBalanceCentral.objects.filter(lot__supply=supply).count() == 2
    assert StockMovement.objects.filter(supply=supply, type=StockMovement.Types.IN).count() >= 1


def test_delivery_send_debits_aggregate_and_lot(api_client, admin_user, school, supply):
    client = _auth(api_client, admin_user)
    StockBalance.objects.create(supply=supply, quantity=Decimal('10'))
    lot = SupplyLot.objects.create(supply=supply, lot_code='CENT1', expiry_date=date.today() + timedelta(days=30))
    LotBalanceCentral.objects.create(lot=lot, quantity=Decimal('10'))

    delivery = Delivery.objects.create(school=school, delivery_date=date.today(), created_by=admin_user)
    item = DeliveryItem.objects.create(delivery=delivery, supply=supply, planned_quantity=Decimal('6'))

    suggest = client.post(f'/api/deliveries/{delivery.id}/suggest_item_lots/', {'item_id': str(item.id)}, format='json')
    assert suggest.status_code == 200, suggest.data

    response = client.post(f'/api/deliveries/{delivery.id}/send/', {}, format='json')
    assert response.status_code == 200, response.data
    item.refresh_from_db()
    assert DeliveryItemLot.objects.filter(delivery_item=item).count() == 1
    assert StockBalance.objects.get(supply=supply).quantity == Decimal('4')
    assert LotBalanceCentral.objects.get(lot=lot).quantity == Decimal('4')


def test_public_delivery_conference_updates_school_and_lot_and_adjusts_central(api_client, admin_user, school, supply):
    client = _auth(api_client, admin_user)
    StockBalance.objects.create(supply=supply, quantity=Decimal('10'))
    lot = SupplyLot.objects.create(supply=supply, lot_code='LCONF', expiry_date=date.today() + timedelta(days=45))
    LotBalanceCentral.objects.create(lot=lot, quantity=Decimal('10'))

    delivery = Delivery.objects.create(school=school, delivery_date=date.today(), created_by=admin_user)
    item = DeliveryItem.objects.create(delivery=delivery, supply=supply, planned_quantity=Decimal('6'))
    client.post(f'/api/deliveries/{delivery.id}/suggest_item_lots/', {'item_id': str(item.id)}, format='json')
    send_resp = client.post(f'/api/deliveries/{delivery.id}/send/', {}, format='json')
    assert send_resp.status_code == 200, send_resp.data

    item_lot = DeliveryItemLot.objects.get(delivery_item=item)
    public_client = APIClient()
    conf_resp = public_client.post(
        f'/public/schools/{school.public_slug}/delivery/current/?token={school.public_token}&delivery_id={delivery.id}',
        {
            'items': [{
                'item_id': str(item.id),
                'received_quantity': '4.00',
                'note': 'faltou 2kg',
                'lots': [{
                    'delivery_item_lot': str(item_lot.id),
                    'received_quantity': '4.00',
                    'note': 'faltou parte do lote',
                }],
            }],
            'sender_signature_data': _sig(),
            'sender_signer_name': 'Motorista',
            'receiver_signature_data': _sig(),
            'receiver_signer_name': 'Escola',
        },
        format='json',
    )

    assert conf_resp.status_code == 200, conf_resp.data
    assert SchoolStockBalance.objects.get(school=school, supply=supply).quantity == Decimal('4.00')
    assert LotBalanceSchool.objects.get(school=school, lot=lot).quantity == Decimal('4.00')
    assert StockBalance.objects.get(supply=supply).quantity == Decimal('6.00')
    assert LotBalanceCentral.objects.get(lot=lot).quantity == Decimal('6.00')


def test_public_consumption_debits_school_lots_by_fefo(api_client, admin_user, school, supply):
    today = date.today()
    SchoolStockBalance.objects.create(school=school, supply=supply, quantity=Decimal('7.00'))
    lot_early = SupplyLot.objects.create(supply=supply, lot_code='C1', expiry_date=today + timedelta(days=5))
    lot_late = SupplyLot.objects.create(supply=supply, lot_code='C2', expiry_date=today + timedelta(days=20))
    LotBalanceSchool.objects.create(school=school, lot=lot_early, quantity=Decimal('2.00'))
    LotBalanceSchool.objects.create(school=school, lot=lot_late, quantity=Decimal('5.00'))
    StockMovement.objects.create(
        supply=supply,
        school=school,
        type=StockMovement.Types.IN,
        quantity=Decimal('1.00'),
        movement_date=today,
        created_by=admin_user,
    )

    public_client = APIClient()
    resp = public_client.post(
        f'/public/schools/{school.public_slug}/consumption/?token={school.public_token}',
        {'items': [{'supply': str(supply.id), 'quantity': '6.00', 'movement_date': today.isoformat(), 'note': 'uso cozinha'}]},
        format='json',
    )
    assert resp.status_code == 200, resp.data
    assert SchoolStockBalance.objects.get(school=school, supply=supply).quantity == Decimal('1.00')
    lot_early.refresh_from_db()
    lot_late.refresh_from_db()
    assert LotBalanceSchool.objects.get(school=school, lot=lot_early).quantity == Decimal('0.00')
    assert LotBalanceSchool.objects.get(school=school, lot=lot_late).quantity == Decimal('1.00')


def test_expiry_command_marks_expired_and_blocks_fefo(supply):
    expired_lot = SupplyLot.objects.create(
        supply=supply,
        lot_code='VX1',
        expiry_date=date.today() - timedelta(days=1),
        status=SupplyLot.Status.ACTIVE,
    )
    LotBalanceCentral.objects.create(lot=expired_lot, quantity=Decimal('3.00'))

    call_command('check_lot_expiry')
    expired_lot.refresh_from_db()
    assert expired_lot.status == SupplyLot.Status.EXPIRED
    assert Notification.objects.filter(notification_type=Notification.NotificationType.LOT_EXPIRED).exists()

    with pytest.raises(ValidationError):
        fefo_suggestion_service(supply=supply, qty=Decimal('1.00'), from_central=True)

