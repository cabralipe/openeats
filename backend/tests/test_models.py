from django.contrib.auth import get_user_model

from schools.models import School


def test_school_slug_generated():
    school = School.objects.create(name='Escola Nova')
    assert school.public_slug.startswith('escola-nova')
    assert school.public_token


def test_user_email_as_username():
    User = get_user_model()
    user = User.objects.create_user(email='user@semed.local', password='Senha123!', name='User')
    assert user.username is None
    assert user.email == 'user@semed.local'
