from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'user', 'action_type', 'method', 'status_code', 'action_route', 'ip_address')
    list_filter = ('action_type', 'method', 'status_code', 'created_at')
    search_fields = ('user__email', 'user__name', 'path', 'action_route', 'ip_address')
    readonly_fields = (
        'id', 'user', 'action_type', 'method', 'path', 'action_route',
        'ip_address', 'status_code', 'payload_before', 'payload_after',
        'request_payload', 'created_at',
    )
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
