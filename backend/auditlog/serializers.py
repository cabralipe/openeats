from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'user',
            'user_email',
            'user_name',
            'action_type',
            'method',
            'path',
            'action_route',
            'ip_address',
            'status_code',
            'payload_before',
            'payload_after',
            'request_payload',
            'created_at',
        ]
