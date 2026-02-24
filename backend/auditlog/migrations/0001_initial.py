from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('action_type', models.CharField(choices=[('CREATE', 'Create'), ('UPDATE', 'Update'), ('DELETE', 'Delete')], max_length=16)),
                ('method', models.CharField(max_length=8)),
                ('path', models.CharField(max_length=512)),
                ('action_route', models.CharField(blank=True, default='', max_length=512)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('status_code', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('payload_before', models.JSONField(blank=True, null=True)),
                ('payload_after', models.JSONField(blank=True, null=True)),
                ('request_payload', models.JSONField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['created_at'], name='auditlog_aud_created_5f5082_idx'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['user', 'created_at'], name='auditlog_aud_user_id_019e1f_idx'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['action_type'], name='auditlog_aud_action__3199b9_idx'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['method'], name='auditlog_aud_method_f07c53_idx'),
        ),
    ]
