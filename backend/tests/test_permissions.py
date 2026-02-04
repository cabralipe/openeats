import pytest
from django.db.utils import IntegrityError
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
        email='admin@semed.local',
        password='Admin123!',
        name='Admin',
        is_staff=True,
        is_superuser=True,
    )


def test_auth_required_for_schools(api_client):
    response = api_client.get('/api/schools/')
    assert response.status_code in [401, 403]


def test_public_requires_token(api_client):
    school = School.objects.create(name='Escola Publica')
    response = api_client.get(f'/public/schools/{school.public_slug}/menu/current/')
    assert response.status_code == 403


def test_unique_menu_constraint(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    school = School.objects.create(name='Escola Unica')
    Menu.objects.create(school=school, week_start='2026-02-02', week_end='2026-02-06', created_by=admin_user)
    with pytest.raises(IntegrityError):
        Menu.objects.create(school=school, week_start='2026-02-02', week_end='2026-02-06', created_by=admin_user)
