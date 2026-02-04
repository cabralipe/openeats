from django.contrib import admin
from .models import School


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'is_active', 'public_slug')
    search_fields = ('name', 'city')
    list_filter = ('is_active',)
    readonly_fields = ('public_slug', 'public_token', 'created_at', 'updated_at')
