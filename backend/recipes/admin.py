from django.contrib import admin

from .models import Recipe, RecipeIngredient


class RecipeIngredientInline(admin.TabularInline):
    model = RecipeIngredient
    extra = 0
    autocomplete_fields = ('supply',)


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'servings_base', 'active', 'technical_sheet_code', 'updated_at')
    search_fields = ('name', 'technical_sheet_code', 'category')
    list_filter = ('active', 'category')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [RecipeIngredientInline]


@admin.register(RecipeIngredient)
class RecipeIngredientAdmin(admin.ModelAdmin):
    list_display = ('recipe', 'supply', 'qty_base', 'unit', 'net_weight', 'unit_cost', 'optional')
    list_filter = ('optional', 'unit')
    search_fields = ('recipe__name', 'supply__name', 'notes')
    autocomplete_fields = ('recipe', 'supply')
