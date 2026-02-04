from django.db import models
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models import Sum
from django.db.models.functions import TruncMonth
from inventory.models import StockBalance, StockMovement, Supply
from menus.models import Menu
from schools.models import School


class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        schools_total = School.objects.count()
        schools_active = School.objects.filter(is_active=True).count()
        supplies_total = Supply.objects.count()
        menus_published = Menu.objects.filter(status=Menu.Status.PUBLISHED).count()
        low_stock = StockBalance.objects.filter(quantity__lt=models.F('supply__min_stock')).count()
        return Response({
            'schools_total': schools_total,
            'schools_active': schools_active,
            'supplies_total': supplies_total,
            'low_stock': low_stock,
            'menus_published': menus_published,
        })


class DashboardSeriesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        movements = (
            StockMovement.objects.filter(type=StockMovement.Types.OUT)
            .annotate(month=TruncMonth('movement_date'))
            .values('month')
            .annotate(total=Sum('quantity'))
            .order_by('month')
        )
        series = [
            {
                'name': entry['month'].strftime('%b'),
                'value': float(entry['total'] or 0),
            }
            for entry in movements
        ]
        return Response({'consumption_by_month': series})
