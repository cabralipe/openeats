from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from inventory.models import Supply, SchoolStockBalance, StockMovement, Supplier, Delivery
from schools.models import School
from menus.models import Menu
from django.utils import timezone
import datetime

class DashboardActivityTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User(email='admin@test.com')
        self.user.set_password('password')
        self.user.save()
        self.client.force_authenticate(user=self.user)
        self.school = School.objects.create(name="Escola Teste", city="Cidade Teste")
        self.supply = Supply.objects.create(name="Arroz", category="Alimentos", unit="kg", min_stock=10)

    def test_recent_activities_and_month_summary(self):
        # 1. Create a published menu (Recent Activity 1)
        Menu.objects.create(
            school=self.school,
            week_start=timezone.now().date(),
            week_end=timezone.now().date() + datetime.timedelta(days=5),
            status=Menu.Status.PUBLISHED,
            published_at=timezone.now(),
            created_by=self.user
        )

        # 2. Create a Low Stock alert (Recent Activity 2)
        # Create a school stock balance with quantity < min_stock
        SchoolStockBalance.objects.create(
            school=self.school,
            supply=self.supply,
            quantity=5, # Less than min_stock 20
            min_stock=20
        )

        # 3. Create a New Supplier (Recent Activity 3)
        Supplier.objects.create(name="Fornecedor Teste")

        # 4. Create Stock Outflow (Meals Served)
        StockMovement.objects.create(
            supply=self.supply,
            school=self.school,
            type=StockMovement.Types.OUT,
            quantity=100,
            movement_date=timezone.now().date(),
            created_by=self.user
        )

        # 5. Create Delivery (Deliveries Realized)
        Delivery.objects.create(
            school=self.school,
            delivery_date=timezone.now().date(),
            status=Delivery.Status.SENT,
            created_by=self.user
        )

        url = reverse('dashboard')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        
        # Verify Month Summary
        self.assertEqual(data['month_summary']['meals_served'], 100)
        self.assertEqual(data['month_summary']['deliveries_realized'], 1)

        # Verify Recent Activities
        activities = data['recent_activities']
        self.assertGreaterEqual(len(activities), 3)
        
        types = [a['type'] for a in activities]
        self.assertIn('MENU_PUBLISHED', types)
        self.assertIn('LOW_STOCK', types)
        self.assertIn('new_supplier', types) # Note: I used 'new_supplier' lowercase in view

        print("\n✅ Verification Passed: Dashboard API returns correct dynamic data.")
