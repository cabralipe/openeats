from django.contrib import admin

from .models import (
    Delivery,
    DeliveryItem,
    DeliveryItemLot,
    DeliveryNutritionistSignature,
    LotBalanceCentral,
    LotBalanceSchool,
    Notification,
    Responsible,
    SchoolStockBalance,
    Supplier,
    SupplierReceipt,
    SupplierReceiptItem,
    SupplierReceiptItemLot,
    Supply,
    SupplyLot,
    StockBalance,
    StockMovement,
)


class DeliveryItemLotInline(admin.TabularInline):
    model = DeliveryItemLot
    extra = 0
    autocomplete_fields = ('lot',)


class DeliveryItemInline(admin.TabularInline):
    model = DeliveryItem
    extra = 0
    autocomplete_fields = ('supply',)


class DeliveryNutritionistSignatureInline(admin.TabularInline):
    model = DeliveryNutritionistSignature
    extra = 0
    readonly_fields = ('created_at',)


class SupplierReceiptItemLotInline(admin.TabularInline):
    model = SupplierReceiptItemLot
    extra = 0
    autocomplete_fields = ('supply',)
    readonly_fields = ('created_at',)


class SupplierReceiptItemInline(admin.TabularInline):
    model = SupplierReceiptItem
    extra = 0
    autocomplete_fields = ('supply', 'supply_created')
    readonly_fields = ('created_at',)


@admin.register(Supply)
class SupplyAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'category', 'unit', 'nova_classification',
        'nutritional_function', 'min_stock', 'is_active',
    )
    list_filter = ('category', 'unit', 'nova_classification', 'nutritional_function', 'is_active')
    search_fields = ('name', 'category', 'storage_instructions')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(StockBalance)
class StockBalanceAdmin(admin.ModelAdmin):
    list_display = ('supply', 'quantity')
    search_fields = ('supply__name',)
    autocomplete_fields = ('supply',)


@admin.register(SchoolStockBalance)
class SchoolStockBalanceAdmin(admin.ModelAdmin):
    list_display = ('school', 'supply', 'quantity', 'min_stock', 'is_low_stock', 'last_updated')
    list_filter = ('school__municipality', 'school')
    search_fields = ('school__name', 'supply__name')
    autocomplete_fields = ('school', 'supply')
    readonly_fields = ('last_updated',)


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('supply', 'school', 'type', 'quantity', 'movement_date', 'created_by', 'created_at')
    list_filter = ('type', 'movement_date', 'school__municipality', 'school')
    search_fields = ('supply__name', 'school__name', 'note', 'created_by__email')
    autocomplete_fields = ('supply', 'school', 'created_by')
    readonly_fields = ('created_at',)
    date_hierarchy = 'movement_date'


@admin.register(Responsible)
class ResponsibleAdmin(admin.ModelAdmin):
    list_display = ('name', 'position', 'phone', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'position', 'phone')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'document', 'contact_name', 'phone', 'email', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'document', 'contact_name', 'phone', 'email')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = (
        'school', 'delivery_date', 'sender', 'status',
        'conference_enabled', 'sent_at', 'conference_submitted_at',
    )
    list_filter = ('status', 'conference_enabled', 'delivery_date', 'school__municipality', 'school')
    search_fields = (
        'school__name', 'notes', 'sender__name',
        'responsible_name', 'responsible_phone', 'sender_signed_by', 'receiver_signed_by',
    )
    autocomplete_fields = ('school', 'sender', 'created_by')
    readonly_fields = ('created_at', 'updated_at', 'sent_at', 'conference_submitted_at')
    inlines = [DeliveryItemInline, DeliveryNutritionistSignatureInline]
    date_hierarchy = 'delivery_date'


@admin.register(DeliveryItem)
class DeliveryItemAdmin(admin.ModelAdmin):
    list_display = ('delivery', 'supply', 'planned_quantity', 'received_quantity', 'created_at')
    list_filter = ('delivery__school__municipality', 'delivery__school', 'delivery__status')
    search_fields = ('delivery__school__name', 'supply__name', 'divergence_note')
    autocomplete_fields = ('delivery', 'supply')
    readonly_fields = ('created_at',)
    inlines = [DeliveryItemLotInline]


@admin.register(DeliveryNutritionistSignature)
class DeliveryNutritionistSignatureAdmin(admin.ModelAdmin):
    list_display = ('delivery', 'name', 'crn', 'function_role', 'created_at')
    search_fields = ('delivery__school__name', 'name', 'crn', 'function_role')
    autocomplete_fields = ('delivery',)
    readonly_fields = ('created_at',)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'notification_type', 'school', 'delivery', 'is_read', 'is_alert', 'created_at')
    list_filter = ('notification_type', 'is_read', 'is_alert', 'school__municipality', 'school')
    search_fields = ('title', 'message', 'school__name', 'delivery__id')
    autocomplete_fields = ('school', 'delivery')
    readonly_fields = ('created_at',)


@admin.register(SupplierReceipt)
class SupplierReceiptAdmin(admin.ModelAdmin):
    list_display = (
        'supplier', 'school', 'expected_date', 'status',
        'conference_started_at', 'conference_finished_at', 'created_by',
    )
    list_filter = ('status', 'expected_date', 'school__municipality', 'school', 'supplier')
    search_fields = (
        'supplier__name', 'school__name', 'notes',
        'sender_signed_by', 'receiver_signed_by', 'created_by__email',
    )
    autocomplete_fields = ('supplier', 'school', 'created_by')
    readonly_fields = ('created_at', 'updated_at', 'conference_started_at', 'conference_finished_at')
    inlines = [SupplierReceiptItemInline]
    date_hierarchy = 'expected_date'


@admin.register(SupplierReceiptItem)
class SupplierReceiptItemAdmin(admin.ModelAdmin):
    list_display = (
        'receipt', 'item_name', 'category', 'unit',
        'expected_quantity', 'received_quantity', 'supply_created', 'created_at',
    )
    list_filter = ('receipt__school__municipality', 'receipt__school', 'category', 'unit')
    search_fields = ('receipt__supplier__name', 'supply__name', 'raw_name', 'category', 'divergence_note')
    autocomplete_fields = ('receipt', 'supply', 'supply_created')
    readonly_fields = ('created_at',)
    inlines = [SupplierReceiptItemLotInline]

    @admin.display(description='Item')
    def item_name(self, obj):
        return obj.supply.name if obj.supply else obj.raw_name


@admin.register(SupplierReceiptItemLot)
class SupplierReceiptItemLotAdmin(admin.ModelAdmin):
    list_display = ('receipt_item', 'supply', 'lot_code', 'manufacture_date', 'expiry_date', 'received_quantity')
    list_filter = ('supply', 'expiry_date')
    search_fields = ('lot_code', 'receipt_item__receipt__supplier__name', 'supply__name')
    autocomplete_fields = ('receipt_item', 'supply')
    readonly_fields = ('created_at',)


@admin.register(SupplyLot)
class SupplyLotAdmin(admin.ModelAdmin):
    list_display = ('supply', 'lot_code', 'supplier', 'manufacture_date', 'expiry_date', 'status', 'invoice_ref')
    list_filter = ('status', 'expiry_date', 'supplier')
    search_fields = ('supply__name', 'lot_code', 'invoice_ref', 'supplier__name')
    autocomplete_fields = ('supply', 'supplier')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'expiry_date'


@admin.register(LotBalanceCentral)
class LotBalanceCentralAdmin(admin.ModelAdmin):
    list_display = ('lot', 'supply_name', 'quantity', 'updated_at')
    search_fields = ('lot__supply__name', 'lot__lot_code')
    autocomplete_fields = ('lot',)
    readonly_fields = ('updated_at',)

    @admin.display(description='Insumo')
    def supply_name(self, obj):
        return obj.lot.supply.name


@admin.register(LotBalanceSchool)
class LotBalanceSchoolAdmin(admin.ModelAdmin):
    list_display = ('school', 'lot', 'supply_name', 'quantity', 'updated_at')
    list_filter = ('school__municipality', 'school')
    search_fields = ('school__name', 'lot__supply__name', 'lot__lot_code')
    autocomplete_fields = ('school', 'lot')
    readonly_fields = ('updated_at',)

    @admin.display(description='Insumo')
    def supply_name(self, obj):
        return obj.lot.supply.name


@admin.register(DeliveryItemLot)
class DeliveryItemLotAdmin(admin.ModelAdmin):
    list_display = ('delivery_item', 'lot', 'planned_quantity', 'received_quantity', 'created_at')
    list_filter = ('delivery_item__delivery__school__municipality', 'delivery_item__delivery__school')
    search_fields = ('delivery_item__delivery__school__name', 'lot__lot_code', 'lot__supply__name', 'divergence_note')
    autocomplete_fields = ('delivery_item', 'lot')
    readonly_fields = ('created_at',)
