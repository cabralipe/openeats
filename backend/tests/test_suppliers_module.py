from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from inventory.models import SchoolStockBalance, StockBalance, StockMovement, SupplierReceipt, SupplierReceiptItem, Supply
from schools.models import School

pytestmark = pytest.mark.django_db

SIGNATURE_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user():
    User = get_user_model()
    user = User.objects.create(
        email='supplier-admin@semed.local',
        name='Supplier Admin',
        is_staff=True,
        is_superuser=True,
    )
    user.set_password('Admin123!')
    user.save(update_fields=['password'])
    return user


def test_create_supplier(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.post('/api/suppliers/', {
        'name': 'Fornecedor Alfa',
        'document': '12.345.678/0001-99',
        'contact_name': 'Maria',
        'phone': '82999999999',
        'email': 'contato@alfa.com',
        'address': 'Rua Principal, 100',
        'is_active': True,
    }, format='json')
    assert response.status_code == 201
    assert response.data['name'] == 'Fornecedor Alfa'


def test_create_supplier_receipt_with_items(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    supplier_response = api_client.post('/api/suppliers/', {'name': 'Fornecedor Beta'}, format='json')
    supplier_id = supplier_response.data['id']

    school = School.objects.create(name='Escola Recebimento')
    supply = Supply.objects.create(name='Arroz', category='Graos', unit=Supply.Units.KG, min_stock=10)

    response = api_client.post('/api/supplier-receipts/', {
        'supplier': supplier_id,
        'school': str(school.id),
        'expected_date': date.today().isoformat(),
        'status': SupplierReceipt.Status.DRAFT,
        'notes': 'Recebimento semanal',
        'items': [
            {
                'supply': str(supply.id),
                'raw_name': '',
                'category': 'Graos',
                'unit': Supply.Units.KG,
                'expected_quantity': '30.00',
                'received_quantity': None,
                'divergence_note': '',
            },
            {
                'supply': None,
                'raw_name': 'Macarrao Espaguete',
                'category': 'Mercearia',
                'unit': Supply.Units.KG,
                'expected_quantity': '20.00',
                'received_quantity': None,
                'divergence_note': '',
            },
        ],
    }, format='json')

    assert response.status_code == 201
    assert len(response.data['items']) == 2
    receipt = SupplierReceipt.objects.get(id=response.data['id'])
    assert receipt.items.count() == 2


def test_filter_supplier_receipts(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    supplier_response = api_client.post('/api/suppliers/', {'name': 'Fornecedor Gama'}, format='json')
    supplier_id = supplier_response.data['id']
    school = School.objects.create(name='Escola Filtro')

    receipt = SupplierReceipt.objects.create(
        supplier_id=supplier_id,
        school=school,
        expected_date=date.today(),
        status=SupplierReceipt.Status.EXPECTED,
        created_by=admin_user,
    )
    SupplierReceiptItem.objects.create(
        receipt=receipt,
        raw_name='Item Teste',
        category='Mercearia',
        unit=Supply.Units.UNIT,
        expected_quantity='5.00',
    )

    response = api_client.get(f'/api/supplier-receipts/?supplier={supplier_id}&status={SupplierReceipt.Status.EXPECTED}')
    assert response.status_code == 200
    assert len(response.data) == 1


def test_supplier_receipt_submit_conference_updates_school_stock(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    supplier_response = api_client.post('/api/suppliers/', {'name': 'Fornecedor Delta'}, format='json')
    supplier_id = supplier_response.data['id']
    school = School.objects.create(name='Escola Conferencia Fornecedor')
    supply = Supply.objects.create(name='Farinha', category='Mercearia', unit=Supply.Units.KG, min_stock=5)

    receipt_response = api_client.post('/api/supplier-receipts/', {
        'supplier': supplier_id,
        'school': str(school.id),
        'expected_date': date.today().isoformat(),
        'status': SupplierReceipt.Status.EXPECTED,
        'items': [
            {
                'supply': str(supply.id),
                'raw_name': '',
                'category': 'Mercearia',
                'unit': Supply.Units.KG,
                'expected_quantity': '12.00',
            },
        ],
    }, format='json')
    assert receipt_response.status_code == 201
    receipt_id = receipt_response.data['id']
    item_id = receipt_response.data['items'][0]['id']

    start_response = api_client.post(f'/api/supplier-receipts/{receipt_id}/start_conference/')
    assert start_response.status_code == 200
    assert start_response.data['status'] == SupplierReceipt.Status.IN_CONFERENCE

    submit_response = api_client.post(f'/api/supplier-receipts/{receipt_id}/submit_conference/', {
        'items': [
            {
                'item_id': item_id,
                'received_quantity': '10.00',
                'note': 'entregue com pequena diferenca',
            },
        ],
        'sender_signature_data': SIGNATURE_DATA,
        'sender_signer_name': 'Entregador Teste',
        'receiver_signature_data': SIGNATURE_DATA,
        'receiver_signer_name': 'Recebedor Escola',
    }, format='json')
    assert submit_response.status_code == 200
    assert submit_response.data['status'] == SupplierReceipt.Status.CONFERRED

    school_balance = SchoolStockBalance.objects.get(school=school, supply=supply)
    assert float(school_balance.quantity) == 10.0
    movement = StockMovement.objects.get(supply=supply, school=school, type=StockMovement.Types.IN)
    assert float(movement.quantity) == 10.0


def test_supplier_receipt_submit_conference_updates_central_stock_when_no_school(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    supplier_response = api_client.post('/api/suppliers/', {'name': 'Fornecedor Central'}, format='json')
    supplier_id = supplier_response.data['id']
    supply = Supply.objects.create(name='Leite', category='Mercearia', unit=Supply.Units.L, min_stock=8)
    StockBalance.objects.create(supply=supply, quantity=3)

    receipt_response = api_client.post('/api/supplier-receipts/', {
        'supplier': supplier_id,
        'expected_date': date.today().isoformat(),
        'status': SupplierReceipt.Status.EXPECTED,
        'items': [
            {
                'supply': str(supply.id),
                'raw_name': '',
                'category': 'Mercearia',
                'unit': Supply.Units.L,
                'expected_quantity': '4.00',
            },
        ],
    }, format='json')
    assert receipt_response.status_code == 201
    receipt_id = receipt_response.data['id']
    item_id = receipt_response.data['items'][0]['id']

    submit_response = api_client.post(f'/api/supplier-receipts/{receipt_id}/submit_conference/', {
        'items': [
            {
                'item_id': item_id,
                'received_quantity': '4.00',
            },
        ],
        'sender_signature_data': SIGNATURE_DATA,
        'sender_signer_name': 'Entregador Central',
        'receiver_signature_data': SIGNATURE_DATA,
        'receiver_signer_name': 'Recebedor Central',
    }, format='json')
    assert submit_response.status_code == 200

    balance = StockBalance.objects.get(supply=supply)
    assert float(balance.quantity) == 7.0


def test_supplier_receipt_submit_conference_creates_supply_for_new_item(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    supplier_response = api_client.post('/api/suppliers/', {'name': 'Fornecedor Novo Item'}, format='json')
    supplier_id = supplier_response.data['id']

    receipt_response = api_client.post('/api/supplier-receipts/', {
        'supplier': supplier_id,
        'expected_date': date.today().isoformat(),
        'status': SupplierReceipt.Status.EXPECTED,
        'items': [
            {
                'supply': None,
                'raw_name': 'Item Sem Cadastro',
                'category': 'Mercearia',
                'unit': Supply.Units.UNIT,
                'expected_quantity': '2.00',
            },
        ],
    }, format='json')
    assert receipt_response.status_code == 201
    receipt_id = receipt_response.data['id']
    item_id = receipt_response.data['items'][0]['id']

    submit_response = api_client.post(f'/api/supplier-receipts/{receipt_id}/submit_conference/', {
        'items': [
            {
                'item_id': item_id,
                'received_quantity': '2.00',
            },
        ],
        'sender_signature_data': SIGNATURE_DATA,
        'sender_signer_name': 'Entregador Novo',
        'receiver_signature_data': SIGNATURE_DATA,
        'receiver_signer_name': 'Recebedor Novo',
    }, format='json')
    assert submit_response.status_code == 200
    assert submit_response.data['status'] == SupplierReceipt.Status.CONFERRED

    receipt = SupplierReceipt.objects.get(id=receipt_id)
    item = receipt.items.get(id=item_id)
    assert item.supply_created is not None
    assert item.supply_created.name == 'Item Sem Cadastro'

    balance = StockBalance.objects.get(supply=item.supply_created)
    assert float(balance.quantity) == 2.0
    movement = StockMovement.objects.get(supply=item.supply_created, type=StockMovement.Types.IN)
    assert float(movement.quantity) == 2.0


def test_supplier_receipt_submit_conference_requires_signatures(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    supplier_response = api_client.post('/api/suppliers/', {'name': 'Fornecedor Sem Assinatura'}, format='json')
    supplier_id = supplier_response.data['id']
    supply = Supply.objects.create(name='Açucar', category='Mercearia', unit=Supply.Units.KG, min_stock=2)

    receipt_response = api_client.post('/api/supplier-receipts/', {
        'supplier': supplier_id,
        'expected_date': date.today().isoformat(),
        'status': SupplierReceipt.Status.EXPECTED,
        'items': [
            {
                'supply': str(supply.id),
                'raw_name': '',
                'category': 'Mercearia',
                'unit': Supply.Units.KG,
                'expected_quantity': '3.00',
            },
        ],
    }, format='json')
    receipt_id = receipt_response.data['id']
    item_id = receipt_response.data['items'][0]['id']

    submit_response = api_client.post(f'/api/supplier-receipts/{receipt_id}/submit_conference/', {
        'items': [
            {
                'item_id': item_id,
                'received_quantity': '3.00',
            },
        ],
        'sender_signature_data': '',
        'sender_signer_name': '',
        'receiver_signature_data': SIGNATURE_DATA,
        'receiver_signer_name': 'Recebedor',
    }, format='json')
    assert submit_response.status_code == 400
