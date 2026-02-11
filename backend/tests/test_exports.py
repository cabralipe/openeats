import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from inventory.models import StockBalance, Supplier, SupplierReceipt, SupplierReceiptItem, Supply
from menus.models import Menu, MenuItem
from schools.models import School

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user():
    User = get_user_model()
    user = User.objects.create(
        email='export@semed.local',
        name='Export',
        is_staff=True,
    )
    user.set_password('Export123!')
    user.save(update_fields=['password'])
    return user


def test_export_stock_csv(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    supply = Supply.objects.create(name='Arroz', category='Graos', unit=Supply.Units.KG, min_stock=10)
    StockBalance.objects.create(supply=supply, quantity=20)
    response = api_client.get('/api/exports/stock/')
    assert response.status_code == 200
    assert response['Content-Type'].startswith('text/csv')


def test_export_menus_csv(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola Export')
    menu = Menu.objects.create(school=school, week_start='2026-02-02', week_end='2026-02-06', created_by=admin_user)
    MenuItem.objects.create(menu=menu, day_of_week=MenuItem.DayOfWeek.MON, meal_type=MenuItem.MealType.LUNCH, description='Arroz')
    response = api_client.get('/api/exports/menus/')
    assert response.status_code == 200
    assert response['Content-Type'].startswith('text/csv')


def test_export_menu_pdf(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola PDF')
    Menu.objects.create(school=school, week_start='2026-02-02', week_end='2026-02-06', created_by=admin_user)
    response = api_client.get(f'/api/exports/menus/pdf/?school={school.id}&week_start=2026-02-02')
    assert response.status_code == 200
    assert response['Content-Type'].startswith('application/pdf')


def test_export_supplier_receipts_pdf(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola Recebimento PDF')
    supplier = Supplier.objects.create(name='Fornecedor PDF')
    supply = Supply.objects.create(name='Feijao', category='Graos', unit=Supply.Units.KG, min_stock=5)
    receipt = SupplierReceipt.objects.create(
        supplier=supplier,
        school=school,
        expected_date='2026-02-10',
        status=SupplierReceipt.Status.EXPECTED,
        created_by=admin_user,
    )
    SupplierReceiptItem.objects.create(
        receipt=receipt,
        supply=supply,
        unit=Supply.Units.KG,
        expected_quantity='15.00',
    )

    response = api_client.get('/api/exports/supplier-receipts/pdf/')
    assert response.status_code == 200
    assert response['Content-Type'].startswith('application/pdf')
