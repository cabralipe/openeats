from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from auditlog.models import AuditLog
from inventory.models import Delivery, DeliveryItem, Notification, SchoolStockBalance, StockBalance, StockMovement, Supply
from menus.models import MealServiceEntry, MealServiceReport, Menu, MenuItem
from schools.models import School

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user():
    User = get_user_model()
    user = User.objects.create(
        email='test@semed.local',
        name='Teste',
        role=User.Roles.SEMED_ADMIN,
        is_staff=True,
        is_superuser=True,
        is_active=True,
    )
    user.set_password('Test123!')
    user.save(update_fields=['password'])
    return user


@pytest.fixture
def nutritionist_user():
    User = get_user_model()
    user = User.objects.create(
        email='nutri@semed.local',
        name='Nutricionista',
        role=User.Roles.NUTRITIONIST,
        is_staff=False,
        is_superuser=False,
        is_active=True,
    )
    user.set_password('Nutri123!')
    user.save(update_fields=['password'])
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


def test_admin_can_crud_nutritionist(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    create_response = api_client.post('/api/users/nutritionists/', {
        'email': 'nova.nutri@semed.local',
        'password': 'SenhaForte123',
    }, format='json')
    assert create_response.status_code == 201
    assert create_response.data['role'] == 'NUTRITIONIST'
    nutri_id = create_response.data['id']

    list_response = api_client.get('/api/users/nutritionists/')
    assert list_response.status_code == 200
    if isinstance(list_response.data, dict) and 'results' in list_response.data:
        emails = [item['email'] for item in list_response.data['results']]
    else:
        emails = [item['email'] for item in list_response.data]
    assert 'nova.nutri@semed.local' in emails

    patch_response = api_client.patch(f'/api/users/nutritionists/{nutri_id}/', {
        'name': 'Nutri Atualizada',
        'is_active': True,
    }, format='json')
    assert patch_response.status_code == 200

    deactivate_response = api_client.post(f'/api/users/nutritionists/{nutri_id}/deactivate/', {}, format='json')
    assert deactivate_response.status_code == 200
    assert deactivate_response.data['is_active'] is False


def test_nutritionist_cannot_access_audit_logs(api_client, nutritionist_user):
    api_client.force_authenticate(user=nutritionist_user)
    response = api_client.get('/api/audit-logs/')
    assert response.status_code == 403


def test_nutritionist_mutation_is_audited(api_client, nutritionist_user):
    api_client.force_authenticate(user=nutritionist_user)
    response = api_client.post('/api/schools/', {
        'name': 'Escola Auditada',
        'address': 'Rua 1',
        'city': 'Maceio',
        'is_active': True,
    }, format='json')
    assert response.status_code == 201

    log = AuditLog.objects.filter(user=nutritionist_user, path='/api/schools/').first()
    assert log is not None
    assert log.method == 'POST'
    assert log.action_type == AuditLog.ActionTypes.CREATE
    assert isinstance(log.request_payload, dict)


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


def test_public_menu_current_falls_back_to_latest_published(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola Fallback')

    old_week_start = date.today() - timedelta(days=14)
    old_week_end = old_week_start + timedelta(days=4)
    old_menu = Menu.objects.create(
        school=school,
        week_start=old_week_start,
        week_end=old_week_end,
        status=Menu.Status.PUBLISHED,
        created_by=admin_user,
    )
    MenuItem.objects.create(
        menu=old_menu,
        day_of_week=MenuItem.DayOfWeek.MON,
        meal_type=MenuItem.MealType.LUNCH,
        description='Arroz',
    )

    api_client.force_authenticate(user=None)
    response = api_client.get(f'/public/schools/{school.public_slug}/menu/current/')
    assert response.status_code == 200
    assert response.data['id'] == str(old_menu.id)


def test_public_schools_lists_any_school_with_published_menu(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola Lista Publica')

    old_week_start = date.today() - timedelta(days=21)
    Menu.objects.create(
        school=school,
        week_start=old_week_start,
        week_end=old_week_start + timedelta(days=4),
        status=Menu.Status.PUBLISHED,
        created_by=admin_user,
    )

    api_client.force_authenticate(user=None)
    response = api_client.get('/public/schools/')
    assert response.status_code == 200
    assert any(entry['slug'] == school.public_slug for entry in response.data)


def test_dashboard_series(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get('/api/dashboard/series/')
    assert response.status_code == 200
    assert 'consumption_by_month' in response.data
    assert 'served_by_school_category' in response.data


def test_dashboard_counts_inactive_supplies_with_stock(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola Dashboard Estoque')
    Supply.objects.create(name='Ativo Cadastro', category='Mercearia', unit=Supply.Units.KG, is_active=True)
    Supply.objects.create(name='Inativo Sem Saldo', category='Mercearia', unit=Supply.Units.KG, is_active=False)
    inactive_school = Supply.objects.create(name='Inativo Saldo Escola', category='Mercearia', unit=Supply.Units.KG, is_active=False)
    inactive_central = Supply.objects.create(name='Inativo Saldo Central', category='Mercearia', unit=Supply.Units.KG, is_active=False)

    SchoolStockBalance.objects.create(school=school, supply=inactive_school, quantity='2.00', min_stock='0.00')
    StockBalance.objects.create(supply=inactive_central, quantity='1.00')

    response = api_client.get('/api/dashboard/')
    assert response.status_code == 200
    assert response.data['supplies_total'] == 3


def test_dashboard_clear_consumption_series_removes_only_stock_outflows(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola Consumo Grafico')
    school_active = School.objects.create(name='Escola Ativa')
    supply = Supply.objects.create(name='Leite', category='Laticinios', unit=Supply.Units.L, min_stock=0)

    StockMovement.objects.create(
        supply=supply,
        school=school,
        type=StockMovement.Types.OUT,
        quantity='12.00',
        movement_date=date.today(),
        created_by=admin_user,
    )
    StockMovement.objects.create(
        supply=supply,
        school=school_active,
        type=StockMovement.Types.OUT,
        quantity='7.00',
        movement_date=date.today(),
        created_by=admin_user,
    )
    StockMovement.objects.create(
        supply=supply,
        school=school,
        type=StockMovement.Types.IN,
        quantity='20.00',
        movement_date=date.today(),
        created_by=admin_user,
    )

    school.delete()  # Leaves stock movement.school as NULL because FK uses SET_NULL.

    response = api_client.post('/api/dashboard/series/clear-consumption/', {}, format='json')
    assert response.status_code == 200
    assert response.data['deleted_count'] == 1
    assert StockMovement.objects.filter(type=StockMovement.Types.OUT).count() == 1
    assert StockMovement.objects.filter(type=StockMovement.Types.OUT, school=school_active).count() == 1
    assert StockMovement.objects.filter(type=StockMovement.Types.IN).count() == 1


def test_menus_invalid_school_filter_returns_400(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get('/api/menus/?school=invalid-school-id')
    assert response.status_code == 400
    assert 'school' in response.data


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
    assert Notification.objects.filter(
        delivery=delivery,
        notification_type=Notification.NotificationType.DELIVERY_WITH_NOTE,
        is_alert=True,
    ).exists()

    balance = StockBalance.objects.get(supply=supply)
    assert float(balance.quantity) == 32.0


def test_deliveries_list_filters_by_conferred_status(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola Filtro')
    draft_delivery = Delivery.objects.create(
        school=school,
        delivery_date=date.today(),
        created_by=admin_user,
        status=Delivery.Status.DRAFT,
    )
    conferred_delivery = Delivery.objects.create(
        school=school,
        delivery_date=date.today(),
        created_by=admin_user,
        status=Delivery.Status.CONFERRED,
    )

    response = api_client.get('/api/deliveries/?status=CONFERRED')
    assert response.status_code == 200
    returned_ids = {entry['id'] for entry in response.data}
    assert str(conferred_delivery.id) in returned_ids
    assert str(draft_delivery.id) not in returned_ids


def test_copy_delivery_to_multiple_schools_creates_drafts(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    source_school = School.objects.create(name='Escola Origem')
    target_school_a = School.objects.create(name='Escola Destino A')
    target_school_b = School.objects.create(name='Escola Destino B')
    supply = Supply.objects.create(name='Macarrao', category='Graos', unit=Supply.Units.KG, min_stock=10)

    source_delivery = Delivery.objects.create(
        school=source_school,
        delivery_date=date.today(),
        notes='Copiar para outras escolas',
        responsible_name='Joao',
        responsible_phone='82999990000',
        created_by=admin_user,
        status=Delivery.Status.SENT,
        conference_enabled=True,
    )
    DeliveryItem.objects.create(delivery=source_delivery, supply=supply, planned_quantity='12.00')

    response = api_client.post(
        f'/api/deliveries/{source_delivery.id}/copy/',
        {'target_schools': [str(target_school_a.id), str(target_school_b.id)]},
        format='json',
    )

    assert response.status_code == 200
    assert response.data['count'] == 2

    copied_deliveries = Delivery.objects.filter(
        school_id__in=[target_school_a.id, target_school_b.id],
        delivery_date=source_delivery.delivery_date,
        notes=source_delivery.notes,
    )
    assert copied_deliveries.count() == 2
    assert all(delivery.status == Delivery.Status.DRAFT for delivery in copied_deliveries)
    assert all(delivery.conference_enabled is False for delivery in copied_deliveries)

    for delivery in copied_deliveries:
        copied_items = DeliveryItem.objects.filter(delivery=delivery)
        assert copied_items.count() == 1
        item = copied_items.first()
        assert str(item.supply_id) == str(supply.id)
        assert float(item.planned_quantity) == 12.0


def test_public_consumption_works_without_previous_delivery(api_client, admin_user):
    school = School.objects.create(name='Escola Consumo')
    supply = Supply.objects.create(name='Leite', category='Mercearia', unit=Supply.Units.L, min_stock=10)
    SchoolStockBalance.objects.create(school=school, supply=supply, quantity=20, min_stock=5)

    api_client.force_authenticate(user=None)
    response = api_client.post(
        f'/public/schools/{school.public_slug}/consumption/?token={school.public_token}',
        {
            'items': [
                {
                    'supply': str(supply.id),
                    'quantity': '3.00',
                    'movement_date': date.today().isoformat(),
                    'note': 'Consumo regular',
                },
            ],
        },
        format='json',
    )

    assert response.status_code == 200
    assert response.data['detail'] == 'Consumo registrado com sucesso.'

    school_balance = SchoolStockBalance.objects.get(school=school, supply=supply)
    assert float(school_balance.quantity) == 17.0


def test_public_consumption_lists_only_school_stock_items(api_client, admin_user):
    school = School.objects.create(name='Escola Consumo Lista')
    other_school = School.objects.create(name='Outra Escola')

    supply_with_stock = Supply.objects.create(name='Arroz', category='Graos', unit=Supply.Units.KG, min_stock=10)
    supply_zero_stock = Supply.objects.create(name='Feijao', category='Graos', unit=Supply.Units.KG, min_stock=10)
    supply_other_school = Supply.objects.create(name='Leite', category='Mercearia', unit=Supply.Units.L, min_stock=10)
    supply_inactive = Supply.objects.create(name='Macarrao', category='Graos', unit=Supply.Units.KG, min_stock=10, is_active=False)

    SchoolStockBalance.objects.create(school=school, supply=supply_with_stock, quantity=5, min_stock=1)
    SchoolStockBalance.objects.create(school=school, supply=supply_zero_stock, quantity=0, min_stock=1)
    SchoolStockBalance.objects.create(school=other_school, supply=supply_other_school, quantity=8, min_stock=1)
    SchoolStockBalance.objects.create(school=school, supply=supply_inactive, quantity=3, min_stock=1)

    api_client.force_authenticate(user=None)
    response = api_client.get(f'/public/schools/{school.public_slug}/consumption/?token={school.public_token}')
    assert response.status_code == 200

    ids = {entry['id'] for entry in response.data}
    assert str(supply_with_stock.id) in ids
    assert str(supply_zero_stock.id) not in ids
    assert str(supply_other_school.id) not in ids
    assert str(supply_inactive.id) not in ids


def test_public_consumption_rejects_item_without_school_stock(api_client, admin_user):
    school = School.objects.create(name='Escola Consumo Restrito')
    supply = Supply.objects.create(name='Farinha', category='Graos', unit=Supply.Units.KG, min_stock=5)
    SchoolStockBalance.objects.create(school=school, supply=supply, quantity=0, min_stock=1)

    api_client.force_authenticate(user=None)
    response = api_client.post(
        f'/public/schools/{school.public_slug}/consumption/?token={school.public_token}',
        {
            'items': [
                {
                    'supply': str(supply.id),
                    'quantity': '1.00',
                    'movement_date': date.today().isoformat(),
                    'note': 'Teste',
                },
            ],
        },
        format='json',
    )
    assert response.status_code == 403


def test_public_meal_service_get_and_submit(api_client, admin_user):
    school = School.objects.create(name='Escola Refeicoes')
    week_start = date.today() - timedelta(days=date.today().weekday())
    week_end = week_start + timedelta(days=4)
    menu = Menu.objects.create(
        school=school,
        week_start=week_start,
        week_end=week_end,
        status=Menu.Status.PUBLISHED,
        created_by=admin_user,
    )
    MenuItem.objects.create(
        menu=menu,
        day_of_week=MenuItem.DayOfWeek.MON,
        meal_type=MenuItem.MealType.BREAKFAST_1,
        description='Leite e pao',
    )
    MenuItem.objects.create(
        menu=menu,
        day_of_week=MenuItem.DayOfWeek.MON,
        meal_type=MenuItem.MealType.LUNCH,
        description='Arroz e frango',
    )

    service_date = week_start
    api_client.force_authenticate(user=None)
    response = api_client.get(
        f'/public/schools/{school.public_slug}/meal-service/?token={school.public_token}&date={service_date.isoformat()}'
    )
    assert response.status_code == 200
    assert len(response.data['categories']) == 2

    post_response = api_client.post(
        f'/public/schools/{school.public_slug}/meal-service/?token={school.public_token}',
        {
            'service_date': service_date.isoformat(),
            'items': [
                {'meal_type': MenuItem.MealType.BREAKFAST_1, 'served_count': 55},
                {'meal_type': MenuItem.MealType.LUNCH, 'served_count': 73},
            ],
        },
        format='json',
    )
    assert post_response.status_code == 200
    assert post_response.data['total_served'] == 128

    report = MealServiceReport.objects.get(school=school, service_date=service_date)
    assert MealServiceEntry.objects.filter(report=report).count() == 2
