import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


def test_jwt_login_and_access(api_client):
    User = get_user_model()
    User.objects.create_user(email='jwt@semed.local', password='Jwt123!', name='JWT User')

    token_response = api_client.post('/api/auth/token/', {
        'email': 'jwt@semed.local',
        'password': 'Jwt123!',
    }, format='json')
    assert token_response.status_code == 200
    access = token_response.data['access']

    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
    me_response = api_client.get('/api/auth/me/')
    assert me_response.status_code == 200
    assert me_response.data['email'] == 'jwt@semed.local'
