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


class Delivery(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Rascunho'
        SENT = 'SENT', 'Enviado'
        CONFERRED = 'CONFERRED', 'Conferido'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='deliveries')
    delivery_date = models.DateField()
    responsible_name = models.CharField(max_length=160, blank=True)
    responsible_phone = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    conference_enabled = models.BooleanField(default=False)
    sent_at = models.DateTimeField(blank=True, null=True)
    conference_submitted_at = models.DateTimeField(blank=True, null=True)
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
