import uuid
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from schools.models import School


class Supply(models.Model):
    class Units(models.TextChoices):
        KG = 'kg', 'Kg'
        G = 'g', 'g'
        L = 'l', 'L'
        ML = 'ml', 'ml'
        UNIT = 'unit', 'Unit'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    unit = models.CharField(max_length=10, choices=Units.choices)
    min_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.name


class StockBalance(models.Model):
    supply = models.OneToOneField(Supply, on_delete=models.CASCADE, related_name='balance')
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self) -> str:
        return f"{self.supply.name} - {self.quantity}"


class SchoolStockBalance(models.Model):
    """Tracks stock balance for each supply at each school."""
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='stock_balances')
    supply = models.ForeignKey(Supply, on_delete=models.CASCADE, related_name='school_balances')
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    min_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text='Limite mínimo de estoque para esta escola')
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['school', 'supply'], name='unique_school_supply_balance'),
        ]

    @property
    def is_low_stock(self):
        return self.quantity < self.min_stock

    def __str__(self) -> str:
        return f"{self.school.name} - {self.supply.name}: {self.quantity}"


class StockMovement(models.Model):
    class Types(models.TextChoices):
        IN = 'IN', 'Entrada'
        OUT = 'OUT', 'Saida'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supply = models.ForeignKey(Supply, on_delete=models.CASCADE, related_name='movements')
    school = models.ForeignKey(School, on_delete=models.SET_NULL, related_name='stock_movements', null=True, blank=True)
    type = models.CharField(max_length=3, choices=Types.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    movement_date = models.DateField()
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.supply.name} - {self.type} {self.quantity}"


class Responsible(models.Model):
    """People who can send or receive deliveries."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=40, blank=True)
    position = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.name} - {self.position}" if self.position else self.name


class Delivery(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Rascunho'
        SENT = 'SENT', 'Enviado'
        CONFERRED = 'CONFERRED', 'Conferido'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='deliveries')
    delivery_date = models.DateField()
    # Sender (who delivers) - can select from registered responsibles or fill manually
    sender = models.ForeignKey(Responsible, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_deliveries')
    responsible_name = models.CharField(max_length=160, blank=True)  # kept for backward compat
    responsible_phone = models.CharField(max_length=40, blank=True)  # kept for backward compat
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    conference_enabled = models.BooleanField(default=False)
    sent_at = models.DateTimeField(blank=True, null=True)
    conference_submitted_at = models.DateTimeField(blank=True, null=True)
    # Sender signature (person who delivered)
    sender_signature = models.TextField(blank=True)
    sender_signed_by = models.CharField(max_length=255, blank=True)
    # Receiver signature (person at school who received)
    receiver_signature = models.TextField(blank=True)
    receiver_signed_by = models.CharField(max_length=255, blank=True)
    # Legacy fields (kept for backward compat, mapped to receiver)
    conference_signature = models.TextField(blank=True)
    conference_signed_by = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_deliveries')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Entrega {self.school.name} - {self.delivery_date}"


class DeliveryItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    delivery = models.ForeignKey(Delivery, on_delete=models.CASCADE, related_name='items')
    supply = models.ForeignKey(Supply, on_delete=models.PROTECT, related_name='delivery_items')
    planned_quantity = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    received_quantity = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    divergence_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['delivery', 'supply'], name='unique_supply_per_delivery'),
        ]

    def __str__(self) -> str:
        return f"{self.delivery_id} - {self.supply.name}"


class Notification(models.Model):
    """Notification for delivery-related events."""
    class NotificationType(models.TextChoices):
        DELIVERY_CONFERRED = 'DELIVERY_CONFERRED', 'Entrega Conferida'
        DELIVERY_WITH_NOTE = 'DELIVERY_WITH_NOTE', 'Entrega com Observação'
        DELIVERY_DIVERGENCE = 'DELIVERY_DIVERGENCE', 'Divergência na Entrega'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=255)
    message = models.TextField()
    delivery = models.ForeignKey(Delivery, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    is_read = models.BooleanField(default=False)
    is_alert = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.title} - {self.created_at}"


class Supplier(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    document = models.CharField(max_length=32, blank=True)
    contact_name = models.CharField(max_length=160, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class SupplierReceipt(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Rascunho'
        EXPECTED = 'EXPECTED', 'Aguardando Entrega'
        IN_CONFERENCE = 'IN_CONFERENCE', 'Em Conferencia'
        CONFERRED = 'CONFERRED', 'Conferida'
        CANCELLED = 'CANCELLED', 'Cancelada'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='receipts')
    school = models.ForeignKey(School, on_delete=models.SET_NULL, related_name='supplier_receipts', null=True, blank=True)
    expected_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(blank=True)
    sender_signature = models.TextField(blank=True)
    sender_signed_by = models.CharField(max_length=255, blank=True)
    receiver_signature = models.TextField(blank=True)
    receiver_signed_by = models.CharField(max_length=255, blank=True)
    conference_started_at = models.DateTimeField(blank=True, null=True)
    conference_finished_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_supplier_receipts')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-expected_date', '-created_at']

    def __str__(self) -> str:
        return f"Recebimento {self.supplier.name} - {self.expected_date}"


class SupplierReceiptItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    receipt = models.ForeignKey(SupplierReceipt, on_delete=models.CASCADE, related_name='items')
    supply = models.ForeignKey(Supply, on_delete=models.SET_NULL, related_name='supplier_receipt_items', null=True, blank=True)
    raw_name = models.CharField(max_length=255, blank=True)
    category = models.CharField(max_length=100, blank=True)
    unit = models.CharField(max_length=10, choices=Supply.Units.choices)
    expected_quantity = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    received_quantity = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(0)])
    divergence_note = models.TextField(blank=True)
    supply_created = models.ForeignKey(Supply, on_delete=models.SET_NULL, related_name='created_from_supplier_receipt_items', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['receipt', 'supply'], condition=models.Q(supply__isnull=False), name='unique_supply_per_supplier_receipt'),
        ]

    def __str__(self) -> str:
        supply_name = self.supply.name if self.supply else self.raw_name
        return f"{self.receipt_id} - {supply_name}"
