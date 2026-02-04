from django.contrib import admin

from .models import Delivery, DeliveryItem, Supply, StockBalance, StockMovement


@admin.register(Supply)
class SupplyAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'unit', 'min_stock', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('name',)


@admin.register(StockBalance)
class StockBalanceAdmin(admin.ModelAdmin):
    list_display = ('supply', 'quantity')
    search_fields = ('supply__name',)


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('supply', 'type', 'quantity', 'movement_date', 'created_by', 'created_at')
    list_filter = ('type', 'movement_date')
    search_fields = ('supply__name', 'note')


class DeliveryItemInline(admin.TabularInline):
    model = DeliveryItem
    extra = 0


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ('school', 'delivery_date', 'responsible_name', 'responsible_phone', 'status', 'conference_enabled', 'sent_at', 'conference_submitted_at')
    list_filter = ('status', 'conference_enabled', 'delivery_date')
    search_fields = ('school__name', 'notes')
    inlines = [DeliveryItemInline]
