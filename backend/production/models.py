import unicodedata
import uuid

from django.core.validators import MinValueValidator
from django.db import models

from inventory.models import Supply
from schools.models import School


def normalize_alias_text(value: str) -> str:
    text = unicodedata.normalize('NFKD', (value or '').strip().lower())
    return ''.join(ch for ch in text if not unicodedata.combining(ch))


class SupplyAlias(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supply = models.ForeignKey(Supply, on_delete=models.PROTECT, related_name='aliases')
    alias = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['alias']

    def save(self, *args, **kwargs):
        self.alias = normalize_alias_text(self.alias)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f'{self.alias} -> {self.supply.name}'


class SupplyConsumptionRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='consumption_rules')
    supply = models.ForeignKey(Supply, on_delete=models.PROTECT, related_name='consumption_rules')
    meal_type = models.CharField(max_length=30, blank=True, default='')
    qty_per_student = models.DecimalField(max_digits=12, decimal_places=4, validators=[MinValueValidator(0)])
    unit = models.CharField(max_length=10, choices=Supply.Units.choices)
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['school', 'supply', 'meal_type'],
                name='unique_rule_school_supply_meal',
            ),
        ]
        ordering = ['school__name', 'supply__name', 'meal_type']

    def __str__(self) -> str:
        return f'{self.school.name} / {self.supply.name} / {self.meal_type or "DEFAULT"}'


class PublicCalculatorLink(models.Model):
    class AllowedScope(models.TextChoices):
        MENU_WEEK = 'MENU_WEEK', 'Menu semanal'
        MENU_DAY = 'MENU_DAY', 'Menu por dia'
        RECIPE_ONLY = 'RECIPE_ONLY', 'Somente receita'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='public_calculator_links')
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    is_active = models.BooleanField(default=True)
    allowed_scope = models.CharField(
        max_length=20,
        choices=AllowedScope.choices,
        default=AllowedScope.MENU_WEEK,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.school.name} - {self.token}'

