from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth import get_user_model

User = get_user_model()

admin.site.site_header = 'NutriSemed Admin'
admin.site.site_title = 'NutriSemed Admin'
admin.site.index_title = 'Painel administrativo da plataforma'


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    model = User
    list_display = ('email', 'name', 'role', 'municipality', 'is_active', 'is_staff', 'date_joined')
    list_filter = ('role', 'municipality', 'is_active', 'is_staff', 'is_superuser')
    search_fields = ('email', 'name', 'crn', 'municipality__name')
    ordering = ('email',)
    readonly_fields = ('last_login', 'date_joined')
    autocomplete_fields = ('municipality',)
    filter_horizontal = ('groups', 'user_permissions')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('name', 'crn', 'function_role', 'municipality')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'email', 'name', 'crn', 'function_role', 'municipality',
                'password1', 'password2', 'role', 'is_active', 'is_staff',
            ),
        }),
    )
