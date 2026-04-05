from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from menus.models import MenuItem

from .models import (
    PnaeAnnualAction,
    PnaeAnnualBudgetItem,
    PnaeAnnualEvaluationTool,
    PnaeAnnualGoal,
    PnaeAnnualPlan,
    PnaeAnnualPlanItem,
    PnaeAnnualPlanMonthlyExecution,
    PnaeAnnualPlanWorkflowEvent,
    PnaeAnnualScheduleEntry,
)
from .services import ensure_plan_editable


class PlanEditableValidationMixin:
    def validate_plan_mutability(self, plan):
        try:
            ensure_plan_editable(plan)
        except ValueError as exc:
            raise serializers.ValidationError({'plan': str(exc)}) from exc


class PnaeAnnualGoalSerializer(PlanEditableValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = PnaeAnnualGoal
        fields = [
            'id', 'plan', 'title', 'description', 'indicator',
            'target_value', 'current_value', 'due_date', 'order',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        plan = attrs.get('plan') or getattr(self.instance, 'plan', None)
        if plan:
            self.validate_plan_mutability(plan)
        return attrs


class PnaeAnnualActionSerializer(PlanEditableValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = PnaeAnnualAction
        fields = [
            'id', 'plan', 'title', 'description', 'responsible_sector',
            'start_date', 'end_date', 'status', 'order',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        plan = attrs.get('plan') or getattr(self.instance, 'plan', None)
        if plan:
            self.validate_plan_mutability(plan)
        return attrs


class PnaeAnnualScheduleEntrySerializer(PlanEditableValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = PnaeAnnualScheduleEntry
        fields = ['id', 'plan', 'month', 'activity', 'expected_result', 'order']
        read_only_fields = ['id']

    def validate(self, attrs):
        plan = attrs.get('plan') or getattr(self.instance, 'plan', None)
        if plan:
            self.validate_plan_mutability(plan)
        return attrs


class PnaeAnnualBudgetItemSerializer(PlanEditableValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = PnaeAnnualBudgetItem
        fields = [
            'id', 'plan', 'category', 'description', 'funding_source',
            'estimated_amount', 'executed_amount', 'order',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        plan = attrs.get('plan') or getattr(self.instance, 'plan', None)
        if plan:
            self.validate_plan_mutability(plan)
        return attrs


class PnaeAnnualEvaluationToolSerializer(PlanEditableValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = PnaeAnnualEvaluationTool
        fields = ['id', 'plan', 'name', 'description', 'frequency', 'target_audience', 'order']
        read_only_fields = ['id']

    def validate(self, attrs):
        plan = attrs.get('plan') or getattr(self.instance, 'plan', None)
        if plan:
            self.validate_plan_mutability(plan)
        return attrs


class PnaeAnnualPlanItemSerializer(PlanEditableValidationMixin, serializers.ModelSerializer):
    education_stage_name = serializers.CharField(source='education_stage.name', read_only=True)
    education_modality_name = serializers.CharField(source='education_modality.name', read_only=True)
    recipe_name = serializers.CharField(source='recipe.name', read_only=True)

    class Meta:
        model = PnaeAnnualPlanItem
        fields = [
            'id', 'plan', 'education_stage', 'education_stage_name',
            'education_modality', 'education_modality_name', 'month', 'meal_type',
            'recipe', 'recipe_name', 'servings_planned', 'weekly_frequency',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'education_stage_name', 'education_modality_name',
            'recipe_name', 'created_at', 'updated_at',
        ]

    def validate_meal_type(self, value):
        if value not in dict(MenuItem.MealType.choices):
            raise serializers.ValidationError('meal_type invalido.')
        return value

    def validate(self, attrs):
        plan = attrs.get('plan') or getattr(self.instance, 'plan', None)
        stage = attrs.get('education_stage') or getattr(self.instance, 'education_stage', None)
        modality = attrs.get('education_modality') or getattr(self.instance, 'education_modality', None)
        if plan:
            self.validate_plan_mutability(plan)
        if plan and stage and not plan.school.education_stages.filter(pk=stage.pk).exists():
            raise serializers.ValidationError({'education_stage': 'A etapa nao esta vinculada a escola do plano.'})
        if plan and modality and not plan.school.education_modalities.filter(pk=modality.pk).exists():
            raise serializers.ValidationError({'education_modality': 'A modalidade nao esta vinculada a escola do plano.'})
        return attrs


class PnaeAnnualPlanWorkflowEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.name', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    to_status_display = serializers.CharField(source='get_to_status_display', read_only=True)

    class Meta:
        model = PnaeAnnualPlanWorkflowEvent
        fields = [
            'id', 'action', 'action_display', 'from_status', 'to_status',
            'to_status_display', 'comment', 'actor', 'actor_name', 'created_at',
        ]
        read_only_fields = fields


class PnaeAnnualPlanMonthlyExecutionSerializer(serializers.ModelSerializer):
    last_updated_by_name = serializers.CharField(source='last_updated_by.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PnaeAnnualPlanMonthlyExecution
        fields = [
            'id', 'plan', 'month', 'status', 'status_display', 'progress_percent',
            'planned_servings', 'executed_servings', 'execution_notes',
            'deviation_notes', 'evidence_links', 'last_updated_by',
            'last_updated_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'planned_servings', 'last_updated_by', 'last_updated_by_name',
            'created_at', 'updated_at', 'status_display',
        ]

    def validate_evidence_links(self, value):
        if value in (None, ''):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError('evidence_links deve ser uma lista de URLs ou descricoes.')
        return [str(item).strip() for item in value if str(item).strip()]


class PnaeAnnualPlanSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    municipality_name = serializers.CharField(source='school.municipality.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    responsible_nutritionist_name = serializers.CharField(source='responsible_nutritionist.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.name', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.name', read_only=True)
    rejected_by_name = serializers.CharField(source='rejected_by.name', read_only=True)
    items = PnaeAnnualPlanItemSerializer(many=True, read_only=True)
    goals = PnaeAnnualGoalSerializer(many=True, read_only=True)
    actions = PnaeAnnualActionSerializer(many=True, read_only=True)
    schedule_entries = PnaeAnnualScheduleEntrySerializer(many=True, read_only=True)
    budget_items = PnaeAnnualBudgetItemSerializer(many=True, read_only=True)
    evaluation_tools = PnaeAnnualEvaluationToolSerializer(many=True, read_only=True)
    workflow_events = PnaeAnnualPlanWorkflowEventSerializer(many=True, read_only=True)
    monthly_executions = PnaeAnnualPlanMonthlyExecutionSerializer(many=True, read_only=True)
    can_edit = serializers.SerializerMethodField()
    can_submit = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()

    class Meta:
        model = PnaeAnnualPlan
        fields = [
            'id', 'school', 'school_name', 'municipality_name', 'year', 'title',
            'justification', 'diagnosis_summary', 'general_objectives',
            'operational_strategy', 'execution_locations', 'executing_agency',
            'financial_schedule_notes', 'status', 'notes', 'last_review_comment',
            'created_by', 'created_by_name', 'responsible_nutritionist',
            'responsible_nutritionist_name', 'submitted_by', 'submitted_by_name',
            'submitted_at', 'approved_by', 'approved_by_name', 'approved_at',
            'rejected_by', 'rejected_by_name', 'rejected_at', 'created_at',
            'updated_at', 'items', 'goals', 'actions', 'schedule_entries',
            'budget_items', 'evaluation_tools', 'workflow_events',
            'monthly_executions', 'can_edit', 'can_submit', 'can_approve',
        ]
        read_only_fields = [
            'id', 'created_by', 'created_by_name', 'responsible_nutritionist_name',
            'approved_by_name', 'submitted_by_name', 'rejected_by_name',
            'submitted_by', 'submitted_at', 'approved_by', 'approved_at',
            'rejected_by', 'rejected_at', 'created_at', 'updated_at',
            'workflow_events', 'monthly_executions', 'can_edit', 'can_submit',
            'can_approve', 'municipality_name',
        ]
        validators = [
            UniqueTogetherValidator(
                queryset=PnaeAnnualPlan.objects.all(),
                fields=['school', 'year'],
                message='Ja existe um plano PNAE para esta escola no ano informado. Edite o plano existente ou escolha outro ano.',
            )
        ]

    def validate_status(self, value):
        if value not in {PnaeAnnualPlan.Status.DRAFT, PnaeAnnualPlan.Status.ARCHIVED}:
            raise serializers.ValidationError('Use as acoes de workflow para submeter, aprovar ou reprovar o plano.')
        return value

    def validate_responsible_nutritionist(self, value):
        if value is not None and getattr(value, 'role', None) != 'NUTRITIONIST':
            raise serializers.ValidationError('O responsavel tecnico deve ser um usuario nutricionista.')
        return value

    def validate(self, attrs):
        school = attrs.get('school') or getattr(self.instance, 'school', None)
        nutritionist = attrs.get('responsible_nutritionist') or getattr(self.instance, 'responsible_nutritionist', None)
        if self.instance:
            try:
                ensure_plan_editable(self.instance)
            except ValueError as exc:
                raise serializers.ValidationError({'status': str(exc)}) from exc
        if school and nutritionist and nutritionist.municipality_id and school.municipality_id:
            if nutritionist.municipality_id != school.municipality_id:
                raise serializers.ValidationError({
                    'responsible_nutritionist': 'O nutricionista responsavel deve pertencer ao mesmo municipio da escola.',
                })
        return attrs

    def get_can_edit(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        return bool(user and getattr(user, 'can_manage_pnae', False) and not obj.is_locked)

    def get_can_submit(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        return bool(
            user
            and getattr(user, 'can_submit_pnae', False)
            and obj.status in {PnaeAnnualPlan.Status.DRAFT, PnaeAnnualPlan.Status.REJECTED}
            and not obj.is_locked
        )

    def get_can_approve(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        return bool(user and getattr(user, 'can_approve_pnae', False) and obj.status == PnaeAnnualPlan.Status.IN_REVIEW)


class PnaeAnnualPlanSummarySerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    municipality_name = serializers.CharField(source='school.municipality.name', read_only=True)
    responsible_nutritionist_name = serializers.CharField(source='responsible_nutritionist.name', read_only=True)

    class Meta:
        model = PnaeAnnualPlan
        fields = [
            'id', 'school', 'school_name', 'municipality_name', 'year', 'title',
            'status', 'responsible_nutritionist_name', 'submitted_at',
            'approved_at', 'created_at', 'updated_at',
        ]


class PnaeWorkflowActionSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default='')


class PnaeOperationalSummaryRequestSerializer(serializers.Serializer):
    month = serializers.IntegerField(min_value=1, max_value=12, required=False)
