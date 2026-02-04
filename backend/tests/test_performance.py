import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from inventory.models import StockBalance, Supply
from schools.models import School


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user():
    User = get_user_model()
    return User.objects.create_user(
        email='perf@semed.local',
        password='Perf123!',
        name='Performance',
        is_staff=True,
    )


@pytest.mark.django_db
def test_list_schools_performance(benchmark, api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    School.objects.bulk_create([
        School(name=f'Escola {idx}', city='Maceio') for idx in range(200)
    ])

    def run():
        response = api_client.get('/api/schools/')
        assert response.status_code == 200

    benchmark(run)


@pytest.mark.django_db
def test_list_stock_performance(benchmark, api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    supplies = Supply.objects.bulk_create([
        Supply(name=f'Insumo {idx}', category='Graos', unit=Supply.Units.KG, min_stock=10)
        for idx in range(200)
    ])
    StockBalance.objects.bulk_create([
        StockBalance(supply=supply, quantity=20) for supply in supplies
    ])

    def run():
        response = api_client.get('/api/stock/')
        assert response.status_code == 200

    benchmark(run)
