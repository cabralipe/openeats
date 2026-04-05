from django.contrib import admin

from .models import PublicCalculatorLink, SupplyAlias, SupplyConsumptionRule


@admin.register(SupplyAlias)
class SupplyAliasAdmin(admin.ModelAdmin):
    list_display = ('alias', 'supply', 'created_at')
    search_fields = ('alias', 'supply__name')
    autocomplete_fields = ('supply',)
    readonly_fields = ('created_at',)


@admin.register(SupplyConsumptionRule)
class SupplyConsumptionRuleAdmin(admin.ModelAdmin):
    list_display = ('school', 'supply', 'meal_type', 'qty_per_student', 'unit', 'active')
    list_filter = ('active', 'school__municipality', 'school', 'unit', 'meal_type')
    search_fields = ('school__name', 'supply__name', 'notes')
    autocomplete_fields = ('school', 'supply')


@admin.register(PublicCalculatorLink)
class PublicCalculatorLinkAdmin(admin.ModelAdmin):
    list_display = ('school', 'allowed_scope', 'is_active', 'token', 'created_at', 'updated_at')
    list_filter = ('allowed_scope', 'is_active', 'school__municipality', 'school')
    search_fields = ('school__name', 'token')
    autocomplete_fields = ('school',)
    readonly_fields = ('id', 'token', 'created_at', 'updated_at')
