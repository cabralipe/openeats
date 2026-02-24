import uuid

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    class ActionTypes(models.TextChoices):
        CREATE = 'CREATE', 'Create'
        UPDATE = 'UPDATE', 'Update'
        DELETE = 'DELETE', 'Delete'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='audit_logs')
    action_type = models.CharField(max_length=16, choices=ActionTypes.choices)
    method = models.CharField(max_length=8)
    path = models.CharField(max_length=512)
    action_route = models.CharField(max_length=512, blank=True, default='')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    payload_before = models.JSONField(null=True, blank=True)
    payload_after = models.JSONField(null=True, blank=True)
    request_payload = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['action_type']),
            models.Index(fields=['method']),
        ]

    def __str__(self) -> str:
        return f'{self.user_id} {self.method} {self.path} ({self.created_at.isoformat()})'
