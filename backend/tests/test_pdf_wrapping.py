from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from inventory.models import Supply, SchoolStockBalance, StockMovement, Supplier, Delivery, SupplierReceipt, DeliveryItem
from schools.models import School
import datetime
from django.utils import timezone

from inventory.models import Supply, SchoolStockBalance, StockMovement, Supplier, Delivery, SupplierReceipt, DeliveryItem, SupplierReceiptItem
from rest_framework.test import APIRequestFactory
from rest_framework.request import Request
from inventory.views import StockExportPdfView, DeliveryExportPdfView, ConsumptionExportPdfView, SupplierReceiptExportPdfView

class PdfDirectViewTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User(email='admin@test.com')
        self.user.set_password('password')
        self.user.save()
        self.factory = APIRequestFactory()
        
        self.school = School.objects.create(name="Escola Teste", city="Cidade Teste")
        self.supply = Supply.objects.create(name="Item Longo " * 5, category="Cat Longa " * 3, unit="kg", min_stock=10)
        StockMovement.objects.create(
            supply=self.supply, school=self.school, type=StockMovement.Types.OUT, quantity=10, 
            movement_date=timezone.now().date(), note="Note " * 10,
            created_by=self.user
        )

    def test_stock_export(self):
        view = StockExportPdfView()
        request = self.factory.get('/?low_stock=false')
        request = Request(request)
        request.user = self.user
        view.request = request
        response = view.list(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')

    def test_consumption_export(self):
        view = ConsumptionExportPdfView()
        request = self.factory.get('/')
        request = Request(request)
        request.user = self.user
        view.request = request
        response = view.list(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        
    def test_delivery_export(self):
        # Create delivery with items
        delivery = Delivery.objects.create(school=self.school, delivery_date=timezone.now().date(), status=Delivery.Status.SENT, created_by=self.user)
        DeliveryItem.objects.create(delivery=delivery, supply=self.supply, planned_quantity=10, divergence_note="Note "*5)
        
        view = DeliveryExportPdfView()
        request = self.factory.get('/')
        request = Request(request)
        request.user = self.user
        view.request = request
        response = view.list(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        
    def test_supplier_receipt_export(self):
        supplier = Supplier.objects.create(name="Fornecedor Teste")
        receipt = SupplierReceipt.objects.create(
            supplier=supplier, school=self.school, status=SupplierReceipt.Status.CONFERRED, 
            expected_date=timezone.now().date(), created_by=self.user
        )
        SupplierReceiptItem.objects.create(
            receipt=receipt, supply=self.supply, expected_quantity=10, received_quantity=10, unit="kg",
            divergence_note="Obs de recebimento"
        )
        
        view = SupplierReceiptExportPdfView()
        request = self.factory.get('/')
        request = Request(request)
        request.user = self.user
        view.request = request
        response = view.list(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')

