# Models de Insumo e Estoque

Fonte: `backend/inventory/models.py`

## `Supply` (Insumo)

```python
class Supply(models.Model):
    class Units(models.TextChoices):
        KG = 'kg', 'Kg'
        G = 'g', 'g'
        L = 'l', 'L'
        ML = 'ml', 'ml'
        UNIT = 'unit', 'Unit'

    class NovaClassification(models.TextChoices):
        IN_NATURA = 'IN_NATURA', 'In natura ou minimamente processados'
        CULINARIOS = 'CULINARIOS', 'Ingredientes culinários processados'
        PROCESSADOS = 'PROCESSADOS', 'Alimentos processados'
        ULTRAPROCESSADOS = 'ULTRAPROCESSADOS', 'Alimentos ultraprocessados'

    class NutritionalFunction(models.TextChoices):
        CONSTRUTORES = 'CONSTRUTORES', 'Alimentos Construtores'
        ENERGETICOS = 'ENERGETICOS', 'Alimentos Energéticos'
        REGULADORES = 'REGULADORES', 'Alimentos Reguladores'
        ENERGETICOS_EXTRAS = 'ENERGETICOS_EXTRAS', 'Alimentos Energéticos Extras'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, default='Outros', blank=True)
    unit = models.CharField(max_length=10, choices=Units.choices)
    nova_classification = models.CharField(
        max_length=20, choices=NovaClassification.choices, blank=True, default='',
    )
    nutritional_function = models.CharField(
        max_length=20, choices=NutritionalFunction.choices, blank=True, default='',
    )
    min_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.name
```

## `StockBalance` (Estoque Central por Insumo)

```python
class StockBalance(models.Model):
    supply = models.OneToOneField(Supply, on_delete=models.CASCADE, related_name='balance')
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self) -> str:
        return f"{self.supply.name} - {self.quantity}"
```

## `SchoolStockBalance` (Estoque por Escola e Insumo)

```python
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
```

## `StockMovement` (Movimentação de Estoque)

```python
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
```

