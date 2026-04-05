from django.contrib import admin

from .models import EducationModality, EducationStage, Municipality, School


@admin.register(Municipality)
class MunicipalityAdmin(admin.ModelAdmin):
    list_display = ('name', 'state', 'code', 'is_active', 'created_at')
    list_filter = ('state', 'is_active')
    search_fields = ('name', 'state', 'code')
    ordering = ('name', 'state')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(EducationModality)
class EducationModalityAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_active', 'created_at')
    search_fields = ('name', 'code')
    list_filter = ('is_active',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(EducationStage)
class EducationStageAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'age_range_start', 'age_range_end', 'is_active')
    search_fields = ('name', 'code')
    list_filter = ('is_active',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ('name', 'municipality', 'city', 'is_active', 'public_slug')
    search_fields = ('name', 'city', 'municipality__name', 'public_slug')
    list_filter = ('municipality', 'is_active', 'education_stages', 'education_modalities')
    readonly_fields = ('public_slug', 'public_token', 'created_at', 'updated_at')
    filter_horizontal = ('education_stages', 'education_modalities')
    autocomplete_fields = ('municipality',)
