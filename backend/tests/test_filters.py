import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from menus.models import Menu
from schools.models import School


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user():
    User = get_user_model()
    return User.objects.create_user(
        email='filter@semed.local',
        password='Filter123!',
        name='Filtro',
        is_staff=True,
    )


def test_school_filters(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    School.objects.create(name='Escola A', city='Maceio', is_active=True)
    School.objects.create(name='Escola B', city='Recife', is_active=False)

    response = api_client.get('/api/schools/?city=Maceio&is_active=true')
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['name'] == 'Escola A'


def test_menu_filters(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola Filtros')
    Menu.objects.create(school=school, week_start='2026-02-02', week_end='2026-02-06', status=Menu.Status.DRAFT, created_by=admin_user)
    Menu.objects.create(school=school, week_start='2026-02-09', week_end='2026-02-13', status=Menu.Status.PUBLISHED, created_by=admin_user)

    response = api_client.get('/api/menus/?status=PUBLISHED&date_from=2026-02-05&date_to=2026-02-20')
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['status'] == Menu.Status.PUBLISHED
