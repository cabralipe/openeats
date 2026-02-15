import uuid
from django.conf import settings
from django.db import models

from schools.models import School


class Menu(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Rascunho'
        PUBLISHED = 'PUBLISHED', 'Publicado'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='menus')
    name = models.CharField(max_length=160, blank=True, default='')
    week_start = models.DateField()
    week_end = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    published_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['school', 'week_start'], name='unique_menu_per_school_week')
        ]

    def __str__(self) -> str:
        return self.name or f"{self.school.name} - {self.week_start}"


class MenuItem(models.Model):
    class DayOfWeek(models.TextChoices):
        MON = 'MON', 'Segunda'
        TUE = 'TUE', 'Terca'
        WED = 'WED', 'Quarta'
        THU = 'THU', 'Quinta'
        FRI = 'FRI', 'Sexta'

    class MealType(models.TextChoices):
        BREAKFAST_1 = 'BREAKFAST1', 'Desjejum'
        SNACK_1 = 'SNACK1', 'Lanche'
        LUNCH = 'LUNCH', 'Almoco'
        SNACK_2 = 'SNACK2', 'Lanche'
        BREAKFAST_2 = 'BREAKFAST2', 'Desjejum'
        DINNER_COFFEE = 'DINNER_COFFEE', 'Cafe da noite'
        BREAKFAST = 'BREAKFAST', 'Cafe (legado)'
        SNACK = 'SNACK', 'Lanche (legado)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE, related_name='items')
    day_of_week = models.CharField(max_length=3, choices=DayOfWeek.choices)
    meal_type = models.CharField(max_length=16, choices=MealType.choices)
    meal_name = models.CharField(max_length=120, blank=True)
    portion_text = models.CharField(max_length=120, blank=True)
    image_url = models.URLField(blank=True)
    image_data = models.TextField(blank=True)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.menu} - {self.day_of_week} {self.meal_type}"


class MealServiceReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='meal_service_reports')
    menu = models.ForeignKey(Menu, on_delete=models.SET_NULL, related_name='meal_service_reports', null=True, blank=True)
    service_date = models.DateField()
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['school', 'service_date'], name='unique_meal_service_report_per_school_day')
        ]
        ordering = ['-service_date', '-submitted_at']

    def __str__(self) -> str:
        return f"{self.school.name} - {self.service_date}"


class MealServiceEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(MealServiceReport, on_delete=models.CASCADE, related_name='entries')
    meal_type = models.CharField(max_length=16, choices=MenuItem.MealType.choices)
    meal_label = models.CharField(max_length=120, blank=True)
    served_count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['report', 'meal_type'], name='unique_meal_service_entry_per_category')
        ]
        ordering = ['meal_type']

    def __str__(self) -> str:
        return f"{self.report_id} - {self.meal_type}: {self.served_count}"
