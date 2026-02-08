from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from inventory.models import Delivery, DeliveryItem, StockBalance, StockMovement, Supply
from menus.models import Menu, MenuItem
from schools.models import School


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user():
    User = get_user_model()
    user = User.objects.create_user(
        email='test@semed.local',
        password='Test123!',
        name='Teste',
        is_staff=True,
        is_superuser=True,
    )
    return user


def test_create_school(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.post('/api/schools/', {
        'name': 'Escola Teste',
        'address': 'Centro',
        'city': 'Maceio',
        'is_active': True,
    }, format='json')
    assert response.status_code == 201
    assert response.data['public_slug']
    assert response.data['public_token']


def test_stock_movement_negative_balance(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    supply = Supply.objects.create(name='Arroz', category='Graos', unit=Supply.Units.KG, min_stock=10)
    StockBalance.objects.create(supply=supply, quantity=5)
    response = api_client.post('/api/stock/movements/', {
        'supply': str(supply.id),
        'type': StockMovement.Types.OUT,
        'quantity': 20,
        'movement_date': date.today().isoformat(),
    }, format='json')
    assert response.status_code == 400


def test_menu_publish_and_public_access(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola Central')
    week_start = date.today()
    week_end = week_start + timedelta(days=4)
    menu = Menu.objects.create(
        school=school,
        week_start=week_start,
        week_end=week_end,
        created_by=admin_user,
    )
    MenuItem.objects.create(menu=menu, day_of_week=MenuItem.DayOfWeek.MON, meal_type=MenuItem.MealType.LUNCH, description='Arroz e feijao')
    response = api_client.post(f'/api/menus/{menu.id}/publish/')
    assert response.status_code == 200
    assert response.data['status'] == Menu.Status.PUBLISHED

    api_client.force_authenticate(user=None)
    public_response = api_client.get(
        f'/public/schools/{school.public_slug}/menu/current/?token={school.public_token}'
    )
    assert public_response.status_code == 200
    assert public_response.data['school'] == str(school.id)


def test_dashboard_series(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get('/api/dashboard/series/')
    assert response.status_code == 200


def test_delivery_send_deducts_stock_and_enables_conference(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola Entrega')
    supply = Supply.objects.create(name='Arroz', category='Graos', unit=Supply.Units.KG, min_stock=10)
    StockBalance.objects.create(supply=supply, quantity=50)

    create_response = api_client.post('/api/deliveries/', {
        'school': str(school.id),
        'delivery_date': date.today().isoformat(),
        'notes': 'Entrega de rotina',
        'items': [
            {'supply': str(supply.id), 'planned_quantity': '12.00'},
        ],
    }, format='json')
    assert create_response.status_code == 201

    delivery_id = create_response.data['id']
    send_response = api_client.post(f'/api/deliveries/{delivery_id}/send/')
    assert send_response.status_code == 200
    assert send_response.data['status'] == Delivery.Status.SENT
    assert send_response.data['conference_enabled'] is True

    balance = StockBalance.objects.get(supply=supply)
    assert float(balance.quantity) == 38.0


def test_public_delivery_conference_submission(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola Conferencia')
    supply = Supply.objects.create(name='Feijao', category='Graos', unit=Supply.Units.KG, min_stock=8)
    StockBalance.objects.create(supply=supply, quantity=30)
    delivery = Delivery.objects.create(
        school=school,
        delivery_date=date.today(),
        notes='Conferir chegada',
        created_by=admin_user,
        status=Delivery.Status.SENT,
        conference_enabled=True,
    )
    item = DeliveryItem.objects.create(delivery=delivery, supply=supply, planned_quantity=10)

    api_client.force_authenticate(user=None)
    get_response = api_client.get(
        f'/public/schools/{school.public_slug}/delivery/current/?token={school.public_token}&delivery_id={delivery.id}'
    )
    assert get_response.status_code == 200

    post_response = api_client.post(
        f'/public/schools/{school.public_slug}/delivery/current/?token={school.public_token}&delivery_id={delivery.id}',
        {
            'items': [
                {'item_id': str(item.id), 'received_quantity': '8.00', 'note': 'faltou 2kg'},
            ]
        },
        format='json'
    )
    assert post_response.status_code == 200
    assert post_response.data['status'] == Delivery.Status.CONFERRED

    item.refresh_from_db()
    assert float(item.received_quantity) == 8.0
    assert item.divergence_note == 'faltou 2kg'

    balance = StockBalance.objects.get(supply=supply)
    assert float(balance.quantity) == 32.0
