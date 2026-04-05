import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from menus.models import MenuItem
from recipes.models import Recipe
from schools.models import EducationModality, EducationStage, School


class PnaeAnnualPlan(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Rascunho'
        IN_REVIEW = 'IN_REVIEW', 'Em revisao'
        APPROVED = 'APPROVED', 'Aprovado'
        REJECTED = 'REJECTED', 'Reprovado'
        ARCHIVED = 'ARCHIVED', 'Arquivado'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='pnae_annual_plans')
    year = models.PositiveSmallIntegerField(validators=[MinValueValidator(2000), MaxValueValidator(2100)])
    title = models.CharField(max_length=255, blank=True, default='')
    justification = models.TextField(blank=True, default='')
    diagnosis_summary = models.TextField(blank=True, default='')
    general_objectives = models.TextField(blank=True, default='')
    operational_strategy = models.TextField(blank=True, default='')
    execution_locations = models.TextField(blank=True, default='')
    executing_agency = models.CharField(max_length=255, blank=True, default='')
    financial_schedule_notes = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_pnae_annual_plans')
    responsible_nutritionist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='responsible_pnae_annual_plans',
        null=True,
        blank=True,
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='submitted_pnae_annual_plans',
        null=True,
        blank=True,
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='approved_pnae_annual_plans',
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='rejected_pnae_annual_plans',
        null=True,
        blank=True,
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    last_review_comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', 'school__name', '-created_at']
        constraints = [
            models.UniqueConstraint(fields=['school', 'year'], name='unique_pnae_annual_plan_per_school_year'),
        ]

    def __str__(self) -> str:
        return self.title or f'{self.school.name} - {self.year}'

    @property
    def is_locked(self) -> bool:
        return self.status in {self.Status.APPROVED, self.Status.ARCHIVED}


class PnaeAnnualGoal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(PnaeAnnualPlan, on_delete=models.CASCADE, related_name='goals')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    indicator = models.CharField(max_length=255, blank=True, default='')
    target_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    current_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'title']

    def __str__(self) -> str:
        return self.title


class PnaeAnnualAction(models.Model):
    class Status(models.TextChoices):
        PLANNED = 'PLANNED', 'Planejada'
        IN_PROGRESS = 'IN_PROGRESS', 'Em andamento'
        COMPLETED = 'COMPLETED', 'Concluida'
        CANCELLED = 'CANCELLED', 'Cancelada'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(PnaeAnnualPlan, on_delete=models.CASCADE, related_name='actions')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    responsible_sector = models.CharField(max_length=160, blank=True, default='')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'title']

    def __str__(self) -> str:
        return self.title


class PnaeAnnualScheduleEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(PnaeAnnualPlan, on_delete=models.CASCADE, related_name='schedule_entries')
    month = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    activity = models.CharField(max_length=255)
    expected_result = models.CharField(max_length=255, blank=True, default='')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['month', 'order', 'activity']

    def __str__(self) -> str:
        return f'{self.plan.year}/{self.month:02d} - {self.activity}'


class PnaeAnnualBudgetItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(PnaeAnnualPlan, on_delete=models.CASCADE, related_name='budget_items')
    category = models.CharField(max_length=120)
    description = models.TextField(blank=True, default='')
    funding_source = models.CharField(max_length=160, blank=True, default='')
    estimated_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    executed_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'category']

    def __str__(self) -> str:
        return self.category


class PnaeAnnualEvaluationTool(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(PnaeAnnualPlan, on_delete=models.CASCADE, related_name='evaluation_tools')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    frequency = models.CharField(max_length=120, blank=True, default='')
    target_audience = models.CharField(max_length=160, blank=True, default='')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self) -> str:
        return self.name


class PnaeAnnualPlanItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(PnaeAnnualPlan, on_delete=models.CASCADE, related_name='items')
    education_stage = models.ForeignKey(EducationStage, on_delete=models.PROTECT, related_name='pnae_plan_items')
    education_modality = models.ForeignKey(EducationModality, on_delete=models.PROTECT, related_name='pnae_plan_items')
    month = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    meal_type = models.CharField(max_length=16, choices=MenuItem.MealType.choices)
    recipe = models.ForeignKey(Recipe, on_delete=models.SET_NULL, null=True, blank=True, related_name='pnae_plan_items')
    servings_planned = models.PositiveIntegerField(default=0)
    weekly_frequency = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(7)])
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['month', 'education_stage__name', 'meal_type']
        constraints = [
            models.UniqueConstraint(
                fields=['plan', 'education_stage', 'education_modality', 'month', 'meal_type'],
                name='unique_pnae_plan_item_scope',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.plan_id} - {self.month}/{self.education_stage.name} - {self.get_meal_type_display()}'


class PnaeAnnualPlanWorkflowEvent(models.Model):
    class Action(models.TextChoices):
        CREATED = 'CREATED', 'Criado'
        SUBMITTED = 'SUBMITTED', 'Submetido para revisao'
        APPROVED = 'APPROVED', 'Aprovado'
        REJECTED = 'REJECTED', 'Reprovado'
        REOPENED = 'REOPENED', 'Reaberto'
        ARCHIVED = 'ARCHIVED', 'Arquivado'
        UPDATED = 'UPDATED', 'Atualizado'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(PnaeAnnualPlan, on_delete=models.CASCADE, related_name='workflow_events')
    action = models.CharField(max_length=20, choices=Action.choices)
    from_status = models.CharField(max_length=20, choices=PnaeAnnualPlan.Status.choices, blank=True, default='')
    to_status = models.CharField(max_length=20, choices=PnaeAnnualPlan.Status.choices)
    comment = models.TextField(blank=True, default='')
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='pnae_workflow_events',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.plan_id} - {self.action} - {self.to_status}'


class PnaeAnnualPlanMonthlyExecution(models.Model):
    class Status(models.TextChoices):
        NOT_STARTED = 'NOT_STARTED', 'Nao iniciada'
        IN_PROGRESS = 'IN_PROGRESS', 'Em andamento'
        PARTIAL = 'PARTIAL', 'Parcial'
        COMPLETED = 'COMPLETED', 'Concluida'
        BLOCKED = 'BLOCKED', 'Bloqueada'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(PnaeAnnualPlan, on_delete=models.CASCADE, related_name='monthly_executions')
    month = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_STARTED)
    progress_percent = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    planned_servings = models.PositiveIntegerField(default=0)
    executed_servings = models.PositiveIntegerField(default=0)
    execution_notes = models.TextField(blank=True, default='')
    deviation_notes = models.TextField(blank=True, default='')
    evidence_links = models.JSONField(blank=True, default=list)
    last_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='updated_pnae_monthly_executions',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['month']
        constraints = [
            models.UniqueConstraint(fields=['plan', 'month'], name='unique_pnae_monthly_execution_per_plan_month'),
        ]

    def __str__(self) -> str:
        return f'{self.plan_id} - {self.month:02d}'
