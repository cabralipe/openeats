from django.contrib import admin

from .models import MealServiceEntry, MealServiceReport, Menu, MenuItem


class MenuItemInline(admin.TabularInline):
    model = MenuItem
    extra = 0


@admin.register(Menu)
class MenuAdmin(admin.ModelAdmin):
    list_display = ('school', 'week_start', 'week_end', 'status')
    list_filter = ('status', 'week_start')
    search_fields = ('school__name',)
    inlines = [MenuItemInline]


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('menu', 'day_of_week', 'meal_type')
    list_filter = ('day_of_week', 'meal_type')


class MealServiceEntryInline(admin.TabularInline):
    model = MealServiceEntry
    extra = 0


@admin.register(MealServiceReport)
class MealServiceReportAdmin(admin.ModelAdmin):
    list_display = ('school', 'service_date', 'menu', 'submitted_at')
    list_filter = ('service_date', 'school')
    search_fields = ('school__name',)
    inlines = [MealServiceEntryInline]


@admin.register(MealServiceEntry)
class MealServiceEntryAdmin(admin.ModelAdmin):
    list_display = ('report', 'meal_type', 'served_count')
    list_filter = ('meal_type',)
