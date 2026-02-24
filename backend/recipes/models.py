import uuid

from django.core.validators import MinValueValidator
from django.db import models

from inventory.models import Supply


class Recipe(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=50, blank=True, default='')
    servings_base = models.PositiveIntegerField(default=100)
    instructions = models.TextField(blank=True, default='')
    tags = models.JSONField(blank=True, default=dict)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class RecipeIngredient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='ingredients')
    supply = models.ForeignKey(Supply, on_delete=models.PROTECT, related_name='recipe_ingredients')
    qty_base = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    unit = models.CharField(max_length=10, choices=Supply.Units.choices)
    optional = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default='')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['recipe', 'supply'], name='unique_recipe_supply_ingredient'),
        ]
        ordering = ['supply__name']

    def __str__(self) -> str:
        return f'{self.recipe.name} - {self.supply.name}'

