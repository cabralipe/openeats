import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0001_initial'),
        ('inventory', '0009_schoolstockbalance_min_stock_notification'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Supplier',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('document', models.CharField(blank=True, max_length=32)),
                ('contact_name', models.CharField(blank=True, max_length=160)),
                ('phone', models.CharField(blank=True, max_length=40)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('address', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='SupplierReceipt',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('expected_date', models.DateField()),
                ('status', models.CharField(choices=[('DRAFT', 'Rascunho'), ('EXPECTED', 'Aguardando Entrega'), ('IN_CONFERENCE', 'Em Conferencia'), ('CONFERRED', 'Conferida'), ('CANCELLED', 'Cancelada')], default='DRAFT', max_length=20)),
                ('notes', models.TextField(blank=True)),
                ('sender_signature', models.TextField(blank=True)),
                ('sender_signed_by', models.CharField(blank=True, max_length=255)),
                ('receiver_signature', models.TextField(blank=True)),
                ('receiver_signed_by', models.CharField(blank=True, max_length=255)),
                ('conference_started_at', models.DateTimeField(blank=True, null=True)),
                ('conference_finished_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='created_supplier_receipts', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='supplier_receipts', to='schools.school')),
                ('supplier', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='receipts', to='inventory.supplier')),
            ],
            options={
                'ordering': ['-expected_date', '-created_at'],
            },
        ),
        migrations.CreateModel(
            name='SupplierReceiptItem',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('raw_name', models.CharField(blank=True, max_length=255)),
                ('category', models.CharField(blank=True, max_length=100)),
                ('unit', models.CharField(choices=[('kg', 'Kg'), ('g', 'g'), ('l', 'L'), ('ml', 'ml'), ('unit', 'Unit')], max_length=10)),
                ('expected_quantity', models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(0)])),
                ('received_quantity', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True, validators=[django.core.validators.MinValueValidator(0)])),
                ('divergence_note', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('receipt', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.supplierreceipt')),
                ('supply', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='supplier_receipt_items', to='inventory.supply')),
                ('supply_created', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_from_supplier_receipt_items', to='inventory.supply')),
            ],
        ),
        migrations.AddConstraint(
            model_name='supplierreceiptitem',
            constraint=models.UniqueConstraint(condition=models.Q(('supply__isnull', False)), fields=('receipt', 'supply'), name='unique_supply_per_supplier_receipt'),
        ),
    ]
