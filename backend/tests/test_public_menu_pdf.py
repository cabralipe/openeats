from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from schools.models import School
from menus.models import Menu, MenuItem
from django.utils import timezone
from datetime import timedelta

class PublicMenuPdfTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User(email='admin@test.com')
        self.user.set_password('password')
        self.user.save()
        
        self.school = School.objects.create(name="Escola Publica", city="Cidade Teste", public_slug="escola-publica")
        
        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=4)
        
        self.menu = Menu.objects.create(
            school=self.school,
            name="Cardapio Teste",
            week_start=week_start,
            week_end=week_end,
            status=Menu.Status.PUBLISHED,
            created_by=self.user
        )
        
        MenuItem.objects.create(
            menu=self.menu,
            day_of_week=MenuItem.DayOfWeek.MON,
            meal_type=MenuItem.MealType.LUNCH,
            meal_name="Arroz e Feijao",
            description="Delicioso",
            portion_text="100g"
        )

    def test_public_menu_pdf_generation(self):
        url = reverse('public-menu-pdf', kwargs={'slug': self.school.public_slug})
        response = self.client.get(url, {'week_start': self.menu.week_start})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(len(response.content) > 0)

    def test_public_menu_pdf_requires_week_start(self):
        url = reverse('public-menu-pdf', kwargs={'slug': self.school.public_slug})
        response = self.client.get(url) # Missing week_start
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN) # PermissionDenied because week_start is mandatory

    def test_public_menu_pdf_invalid_slug(self):
        url = reverse('public-menu-pdf', kwargs={'slug': 'invalid-slug'})
        response = self.client.get(url, {'week_start': self.menu.week_start})
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
