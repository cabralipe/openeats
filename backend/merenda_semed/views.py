from django.db import models
from django.db import DatabaseError
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django.utils.timesince import timesince
from inventory.models import Delivery, SchoolStockBalance, StockBalance, StockMovement, Supplier, Supply
from menus.models import MealServiceEntry, Menu, MenuItem
from schools.models import School


class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # 1. Basic Counts
        schools_total = 0
        schools_active = 0
        supplies_total = 0
        menus_published = 0
        try:
            schools_total = School.objects.count()
            schools_active = School.objects.filter(is_active=True).count()
            supplies_total = Supply.objects.filter(is_active=True).count()
            menus_published = Menu.objects.filter(status=Menu.Status.PUBLISHED).count()
        except DatabaseError:
            # Keep endpoint alive even if one optional dashboard source is unavailable.
            pass
        
        # Low stock based on School Stock Balances
        low_stock_school = 0
        try:
            low_stock_school = SchoolStockBalance.objects.filter(
                quantity__lt=models.F('min_stock'),
                min_stock__gt=0
            ).count()
        except DatabaseError:
            pass
        # Fallback to general One-to-One StockBalance if no school specific entries are used widely yet,
        # but the requirement was "Estoque de Feijão Baixo - Escola Municipal...".
        # So we surely want SchoolStockBalance for the "Recent Activity". 
        # For the COUNTER, let's keep it consistent:
        low_stock = low_stock_school

        # 2. Month Summary
        today = timezone.localdate()
        current_month_start = today.replace(day=1)
        
        # Meals served approx. = Stock Outflows
        meals_served = 0
        try:
            meals_served = StockMovement.objects.filter(
                type=StockMovement.Types.OUT,
                movement_date__gte=current_month_start,
                school__isnull=False,
            ).aggregate(total=Sum('quantity'))['total'] or 0
        except DatabaseError:
            meals_served = 0

        # Deliveries realized
        deliveries_count = 0
        try:
            deliveries_count = Delivery.objects.filter(
                status__in=[Delivery.Status.SENT, Delivery.Status.CONFERRED],
                delivery_date__gte=current_month_start
            ).count()
        except DatabaseError:
            deliveries_count = 0

        # 3. Recent Activity (Mix of: Published Menus, Low Stock Alerts, New Suppliers)
        # We'll fetch top 5 of each and merge/sort in python for simplicity, then take top 5 overall.
        
        # A) Recent Menus
        recent_menus = []
        try:
            recent_menus = list(
                Menu.objects.filter(status=Menu.Status.PUBLISHED).select_related('school').order_by('-published_at')[:5]
            )
        except DatabaseError:
            recent_menus = []
        
        # B) Low Stock (School Balances)
        # We want "Last Updated" low stocks? Or just current low stocks? 
        # The prompt shows "Estoque de Feijão Baixo ... 4h atrás". 
        # SchoolStockBalance has 'last_updated'.
        recent_low_stock = []
        try:
            recent_low_stock = list(
                SchoolStockBalance.objects.filter(
                    quantity__lt=models.F('min_stock'),
                    min_stock__gt=0
                ).select_related('school', 'supply').order_by('-last_updated')[:5]
            )
        except DatabaseError:
            recent_low_stock = []

        # C) New Suppliers (or maybe Deliveries?)
        # Prompt says "Novo Fornecedor Cadastrado".
        recent_suppliers = []
        try:
            recent_suppliers = list(Supplier.objects.order_by('-created_at')[:5])
        except DatabaseError:
            recent_suppliers = []

        activities = []
        
        for menu in recent_menus:
            published_at = menu.published_at or menu.updated_at or menu.created_at
            activities.append({
                'type': 'MENU_PUBLISHED',
                'title': menu.name or 'Cardápio Publicado',
                'subtitle': f"Publicado {timesince(published_at)} atrás",
                'timestamp': published_at,
                'icon': 'upload_file',
                'iconBg': 'bg-primary-100 dark:bg-primary-900/30',
                'iconColor': 'text-primary-500',
            })

        for balance in recent_low_stock:
            activities.append({
                'type': 'LOW_STOCK',
                'title': f"Estoque Baixo: {balance.supply.name}",
                'subtitle': f"{balance.school.name} • {timesince(balance.last_updated)} atrás",
                'timestamp': balance.last_updated,
                'icon': 'low_priority',
                'iconBg': 'bg-warning-100 dark:bg-warning-900/30',
                'iconColor': 'text-warning-500',
            })

        for supplier in recent_suppliers:
            activities.append({
                'type': 'new_supplier',
                'title': 'Novo Fornecedor Cadastrado',
                'subtitle': f"{supplier.name} • {timesince(supplier.created_at)} atrás",
                'timestamp': supplier.created_at,
                'icon': 'person_add',
                'iconBg': 'bg-success-100 dark:bg-success-900/30',
                'iconColor': 'text-success-500',
            })

        # Sort combined list by timestamp desc
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        recent_activities = activities[:5]

        return Response({
            'schools_total': schools_total,
            'schools_active': schools_active,
            'supplies_total': supplies_total,
            'low_stock': low_stock,
            'menus_published': menus_published,
            'month_summary': {
                'meals_served': meals_served,
                'deliveries_realized': deliveries_count,
            },
            'recent_activities': recent_activities,
        })


class DashboardSeriesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            movements = (
                StockMovement.objects.filter(
                    type=StockMovement.Types.OUT,
                    school__isnull=False,
                )
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
                if entry.get('month') is not None
            ]
        except DatabaseError:
            series = []

        try:
            served = (
                MealServiceEntry.objects.select_related('report__school')
                .values('report__school__id', 'report__school__name', 'meal_type')
                .annotate(total=Sum('served_count'))
                .order_by('report__school__name', 'meal_type')
            )
            labels = dict(MenuItem.MealType.choices)
            served_by_school_category = [
                {
                    'school_id': str(item['report__school__id']),
                    'school_name': item['report__school__name'],
                    'meal_type': item['meal_type'],
                    'meal_label': labels.get(item['meal_type'], item['meal_type']),
                    'value': int(item['total'] or 0),
                }
                for item in served
                if item.get('report__school__id') is not None
            ]
        except DatabaseError:
            served_by_school_category = []

        return Response({
            'consumption_by_month': series,
            'served_by_school_category': served_by_school_category,
        })


class DashboardClearConsumptionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        deleted_count, _ = StockMovement.objects.filter(
            type=StockMovement.Types.OUT,
            school__isnull=True,
        ).delete()
        return Response(
            {
                'detail': 'Consumos órfãos do gráfico mensal removidos com sucesso.',
                'deleted_count': deleted_count,
            },
            status=status.HTTP_200_OK,
        )
