import uuid
from django.conf import settings
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0001_initial'),
        ('inventory', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Delivery',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('delivery_date', models.DateField()),
                ('notes', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('DRAFT', 'Rascunho'), ('SENT', 'Enviado'), ('CONFERRED', 'Conferido')], default='DRAFT', max_length=16)),
                ('conference_enabled', models.BooleanField(default=False)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('conference_submitted_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='created_deliveries', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deliveries', to='schools.school')),
            ],
        ),
        migrations.CreateModel(
            name='DeliveryItem',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('planned_quantity', models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(0.01)])),
                ('received_quantity', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('divergence_note', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('delivery', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.delivery')),
                ('supply', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='delivery_items', to='inventory.supply')),
            ],
        ),
        migrations.AddConstraint(
            model_name='deliveryitem',
            constraint=models.UniqueConstraint(fields=('delivery', 'supply'), name='unique_supply_per_delivery'),
        ),
    ]
