from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import User

class ProfileUpdateTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create(
            email='test@example.com',
            name='Old Name'
        )
        self.user.set_password('password123')
        self.user.save()
        self.client.force_authenticate(user=self.user)
        self.url = reverse('auth-me')

    def test_update_profile_name(self):
        data = {'name': 'New Name'}
        response = self.client.patch(self.url, data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, 'New Name')

    def test_update_profile_partial(self):
        # Ensure other fields aren't required
        data = {'name': 'Another Name'}
        response = self.client.patch(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Another Name')
