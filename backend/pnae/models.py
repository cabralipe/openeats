import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

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


class PnaeAcceptabilityTest(models.Model):
    class RespondentProfile(models.TextChoices):
        NOT_INFORMED = 'NOT_INFORMED', 'Nao informado'
        STUDENT = 'STUDENT', 'Aluno'
        PROFESSIONAL = 'PROFESSIONAL', 'Profissional'

    class Method(models.TextChoices):
        HEDONIC = 'HEDONIC', 'Escala hedônica'
        LUDIC = 'LUDIC', 'Cartelas lúdicas'
        REST_INGESTION = 'REST_INGESTION', 'Resto-ingestão'
        WITHIN_OUTSIDE = 'WITHIN_OUTSIDE', 'Dentro-fora do padrão'

    class Objective(models.TextChoices):
        NEW_OR_ATYPICAL = 'NEW_OR_ATYPICAL', 'Preparação/alimento novo ou atípico'
        RECURRING_MENU = 'RECURRING_MENU', 'Cardápio praticado frequentemente'
        PROCUREMENT_SAMPLE = 'PROCUREMENT_SAMPLE', 'Amostra para aquisição'

    class AnalysisScope(models.TextChoices):
        PREPARATION = 'PREPARATION', 'Preparação'
        MENU = 'MENU', 'Cardápio/refeição'
        PRODUCT = 'PRODUCT', 'Produto/amostra'

    class ServiceMode(models.TextChoices):
        CAFETERIA = 'CAFETERIA', 'Refeitório'
        CLASSROOM = 'CLASSROOM', 'Sala de aula'
        SELF_SERVICE = 'SELF_SERVICE', 'Autosserviço'
        PROCUREMENT_PANEL = 'PROCUREMENT_PANEL', 'Equipe de provadores'

    class AdhesionClassification(models.TextChoices):
        HIGH = 'HIGH', 'Alta'
        MEDIUM = 'MEDIUM', 'Média'
        LOW = 'LOW', 'Baixa'
        VERY_LOW = 'VERY_LOW', 'Muito baixa'
        NOT_INFORMED = 'NOT_INFORMED', 'Não informada'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='acceptability_tests')
    menu = models.ForeignKey(
        'menus.Menu',
        on_delete=models.SET_NULL,
        related_name='acceptability_tests',
        null=True,
        blank=True,
    )
    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.SET_NULL,
        related_name='acceptability_tests',
        null=True,
        blank=True,
    )
    previous_test = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        related_name='retests',
        null=True,
        blank=True,
    )
    method = models.CharField(max_length=20, choices=Method.choices)
    objective = models.CharField(max_length=24, choices=Objective.choices)
    analysis_scope = models.CharField(max_length=16, choices=AnalysisScope.choices)
    service_mode = models.CharField(max_length=20, choices=ServiceMode.choices)
    preparation_name = models.CharField(max_length=255)
    target_group = models.CharField(max_length=255, blank=True, default='')
    respondent_profile = models.CharField(
        max_length=16,
        choices=RespondentProfile.choices,
        default=RespondentProfile.NOT_INFORMED,
    )
    respondent_entries = models.JSONField(blank=True, default=list)
    classes_sampled = models.TextField(blank=True, default='')
    test_date = models.DateField(default=timezone.localdate)
    weekday_label = models.CharField(max_length=32, blank=True, default='')
    weather_context = models.CharField(max_length=120, blank=True, default='')
    serving_time = models.CharField(max_length=120, blank=True, default='')
    participants_count = models.PositiveIntegerField(default=0)
    eligible_students_count = models.PositiveIntegerField(null=True, blank=True)
    adhered_students_count = models.PositiveIntegerField(null=True, blank=True)
    loved_count = models.PositiveIntegerField(default=0)
    liked_count = models.PositiveIntegerField(default=0)
    indifferent_count = models.PositiveIntegerField(default=0)
    disliked_count = models.PositiveIntegerField(default=0)
    hated_count = models.PositiveIntegerField(default=0)
    within_count = models.PositiveIntegerField(default=0)
    outside_count = models.PositiveIntegerField(default=0)
    prepared_weight = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    leftover_weight = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    plate_waste_weight = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    non_edible_weight = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    distributed_weight = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    attempt_number = models.PositiveSmallIntegerField(default=1)
    minimum_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    rejection_index = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    acceptance_index = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    adhesion_index = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    adhesion_classification = models.CharField(
        max_length=16,
        choices=AdhesionClassification.choices,
        default=AdhesionClassification.NOT_INFORMED,
    )
    approved = models.BooleanField(default=False)
    next_retest_date = models.DateField(null=True, blank=True)
    recommendation = models.TextField(blank=True, default='')
    positive_feedback = models.TextField(blank=True, default='')
    negative_feedback = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_acceptability_tests',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-test_date', '-created_at']

    def __str__(self) -> str:
        return f'{self.preparation_name} - {self.school.name} ({self.test_date})'

    @staticmethod
    def _quantize(value: Decimal) -> Decimal:
        return value.quantize(Decimal('0.01'))

    def get_manual_threshold(self) -> Decimal:
        if self.method == self.Method.REST_INGESTION:
            return Decimal('90.00')
        return Decimal('85.00')

    def get_adhesion_classification(self) -> str:
        if self.adhesion_index <= 0:
            return self.AdhesionClassification.NOT_INFORMED
        if self.adhesion_index > 70:
            return self.AdhesionClassification.HIGH
        if self.adhesion_index >= 50:
            return self.AdhesionClassification.MEDIUM
        if self.adhesion_index >= 30:
            return self.AdhesionClassification.LOW
        return self.AdhesionClassification.VERY_LOW

    def calculate_results(self):
        threshold = self.get_manual_threshold()
        acceptance = Decimal('0.00')
        rejection = Decimal('0.00')
        distributed = Decimal(self.distributed_weight or 0)
        adhesion = Decimal('0.00')

        if self.respondent_entries and self.method in {self.Method.HEDONIC, self.Method.LUDIC, self.Method.WITHIN_OUTSIDE}:
            self.loved_count = 0
            self.liked_count = 0
            self.indifferent_count = 0
            self.disliked_count = 0
            self.hated_count = 0
            self.within_count = 0
            self.outside_count = 0

            for entry in self.respondent_entries:
                response_code = str(entry.get('response_code', '')).upper()
                if response_code == 'LOVED':
                    self.loved_count += 1
                elif response_code == 'LIKED':
                    self.liked_count += 1
                elif response_code == 'INDIFFERENT':
                    self.indifferent_count += 1
                elif response_code == 'DISLIKED':
                    self.disliked_count += 1
                elif response_code == 'HATED':
                    self.hated_count += 1
                elif response_code == 'WITHIN':
                    self.within_count += 1
                elif response_code == 'OUTSIDE':
                    self.outside_count += 1

        if self.method in {self.Method.HEDONIC, self.Method.LUDIC}:
            total_responses = (
                self.loved_count
                + self.liked_count
                + self.indifferent_count
                + self.disliked_count
                + self.hated_count
            )
            self.participants_count = total_responses
            if total_responses > 0:
                acceptance = (
                    Decimal(self.loved_count + self.liked_count) / Decimal(total_responses)
                ) * Decimal('100')
                rejection = Decimal('100') - acceptance
        elif self.method == self.Method.WITHIN_OUTSIDE:
            total_panel = self.within_count + self.outside_count
            self.participants_count = total_panel
            if total_panel > 0:
                acceptance = (Decimal(self.within_count) / Decimal(total_panel)) * Decimal('100')
                rejection = Decimal('100') - acceptance
        elif self.method == self.Method.REST_INGESTION:
            distributed = Decimal(self.prepared_weight or 0) - Decimal(self.leftover_weight or 0) - Decimal(self.non_edible_weight or 0)
            if distributed < 0:
                distributed = Decimal('0')
            self.distributed_weight = self._quantize(distributed)
            if distributed > 0:
                rejection = (Decimal(self.plate_waste_weight or 0) / distributed) * Decimal('100')
                acceptance = Decimal('100') - rejection

        if self.eligible_students_count and self.adhered_students_count is not None and self.eligible_students_count > 0:
            adhesion = (Decimal(self.adhered_students_count) / Decimal(self.eligible_students_count)) * Decimal('100')

        self.minimum_threshold = threshold
        self.acceptance_index = self._quantize(max(Decimal('0'), acceptance))
        self.rejection_index = self._quantize(max(Decimal('0'), rejection))
        self.adhesion_index = self._quantize(max(Decimal('0'), adhesion))
        self.adhesion_classification = self.get_adhesion_classification()
        self.approved = self.acceptance_index >= threshold

        if self.approved:
            if self.method == self.Method.WITHIN_OUTSIDE:
                self.recommendation = 'Produto aprovado no teste sensorial e apto para aquisição.'
            else:
                self.recommendation = 'Preparação aceita de acordo com o ponto de corte do manual e apta para permanência/inserção no cardápio.'
            self.next_retest_date = None
            return

        if self.attempt_number < 3:
            self.next_retest_date = self.test_date + timedelta(days=60)
            self.recommendation = 'Resultado abaixo do ponto de corte. Realizar novo teste com intervalo mínimo de um bimestre.'
        else:
            self.next_retest_date = None
            if self.method == self.Method.WITHIN_OUTSIDE:
                self.recommendation = 'Produto reprovado após três tentativas. Não deve ser adquirido.'
            else:
                self.recommendation = 'Preparação reprovada após três tentativas. Não deve ser inserida ou permanecer no cardápio.'

    def save(self, *args, **kwargs):
        if self.previous_test_id and self.attempt_number <= 1:
            self.attempt_number = min((self.previous_test.attempt_number or 1) + 1, 3)
        if self.test_date:
            self.weekday_label = self.test_date.strftime('%A')
        self.calculate_results()
        super().save(*args, **kwargs)
