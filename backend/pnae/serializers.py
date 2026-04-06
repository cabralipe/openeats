from datetime import timedelta

from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from menus.models import MenuItem

from .models import (
    PnaeAcceptabilityTest,
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


class PnaeAcceptabilityTestSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    municipality_name = serializers.CharField(source='school.municipality.name', read_only=True)
    menu_name = serializers.CharField(source='menu.name', read_only=True)
    recipe_name = serializers.CharField(source='recipe.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    objective_display = serializers.CharField(source='get_objective_display', read_only=True)
    analysis_scope_display = serializers.CharField(source='get_analysis_scope_display', read_only=True)
    service_mode_display = serializers.CharField(source='get_service_mode_display', read_only=True)
    adhesion_classification_display = serializers.CharField(source='get_adhesion_classification_display', read_only=True)
    respondent_profile_display = serializers.CharField(source='get_respondent_profile_display', read_only=True)
    previous_test_preparation_name = serializers.CharField(source='previous_test.preparation_name', read_only=True)
    guidance_alerts = serializers.SerializerMethodField()

    class Meta:
        model = PnaeAcceptabilityTest
        fields = [
            'id',
            'school',
            'school_name',
            'municipality_name',
            'menu',
            'menu_name',
            'recipe',
            'recipe_name',
            'previous_test',
            'previous_test_preparation_name',
            'method',
            'method_display',
            'objective',
            'objective_display',
            'analysis_scope',
            'analysis_scope_display',
            'service_mode',
            'service_mode_display',
            'preparation_name',
            'target_group',
            'respondent_profile',
            'respondent_profile_display',
            'respondent_entries',
            'classes_sampled',
            'test_date',
            'weekday_label',
            'weather_context',
            'serving_time',
            'participants_count',
            'eligible_students_count',
            'adhered_students_count',
            'loved_count',
            'liked_count',
            'indifferent_count',
            'disliked_count',
            'hated_count',
            'within_count',
            'outside_count',
            'prepared_weight',
            'leftover_weight',
            'plate_waste_weight',
            'non_edible_weight',
            'distributed_weight',
            'attempt_number',
            'minimum_threshold',
            'rejection_index',
            'acceptance_index',
            'adhesion_index',
            'adhesion_classification',
            'adhesion_classification_display',
            'approved',
            'next_retest_date',
            'recommendation',
            'positive_feedback',
            'negative_feedback',
            'notes',
            'guidance_alerts',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'school_name',
            'municipality_name',
            'menu_name',
            'recipe_name',
            'previous_test_preparation_name',
            'weekday_label',
            'distributed_weight',
            'attempt_number',
            'minimum_threshold',
            'rejection_index',
            'acceptance_index',
            'adhesion_index',
            'adhesion_classification',
            'adhesion_classification_display',
            'approved',
            'next_retest_date',
            'recommendation',
            'guidance_alerts',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'method_display',
            'objective_display',
            'analysis_scope_display',
            'service_mode_display',
            'respondent_profile_display',
        ]

    def get_guidance_alerts(self, obj):
        alerts = []
        if obj.method in {PnaeAcceptabilityTest.Method.HEDONIC, PnaeAcceptabilityTest.Method.LUDIC, PnaeAcceptabilityTest.Method.REST_INGESTION}:
            if obj.participants_count and not 100 <= obj.participants_count <= 500:
                alerts.append('O manual recomenda normalmente amostras entre 100 e 500 participantes, ajustadas à realidade da escola.')
        if obj.method == PnaeAcceptabilityTest.Method.WITHIN_OUTSIDE and obj.participants_count and not 10 <= obj.participants_count <= 15:
            alerts.append('Para o teste dentro-fora do padrão, o manual recomenda equipe entre 10 e 15 provadores.')
        if obj.method == PnaeAcceptabilityTest.Method.REST_INGESTION and obj.analysis_scope != PnaeAcceptabilityTest.AnalysisScope.MENU:
            alerts.append('Resto-ingestão é indicado para avaliação do cardápio/refeição como um todo.')
        if obj.adhesion_classification == PnaeAcceptabilityTest.AdhesionClassification.LOW:
            alerts.append('Índice de adesão classificado como baixo pelo referencial do manual.')
        if obj.adhesion_classification == PnaeAcceptabilityTest.AdhesionClassification.VERY_LOW:
            alerts.append('Índice de adesão classificado como muito baixo pelo referencial do manual.')
        return alerts

    def validate(self, attrs):
        instance = self.instance
        method = attrs.get('method') or getattr(instance, 'method', None)
        analysis_scope = attrs.get('analysis_scope') or getattr(instance, 'analysis_scope', None)
        objective = attrs.get('objective') or getattr(instance, 'objective', None)
        previous_test = attrs.get('previous_test') or getattr(instance, 'previous_test', None)
        school = attrs.get('school') or getattr(instance, 'school', None)
        test_date = attrs.get('test_date') or getattr(instance, 'test_date', None)
        preparation_name = attrs.get('preparation_name') or getattr(instance, 'preparation_name', '')
        eligible_students_count = attrs.get('eligible_students_count')
        adhered_students_count = attrs.get('adhered_students_count')
        respondent_profile = attrs.get('respondent_profile') or getattr(
            instance,
            'respondent_profile',
            PnaeAcceptabilityTest.RespondentProfile.NOT_INFORMED,
        )
        respondent_entries = attrs.get('respondent_entries')
        if instance:
            if eligible_students_count is None:
                eligible_students_count = instance.eligible_students_count
            if adhered_students_count is None:
                adhered_students_count = instance.adhered_students_count
            if respondent_entries is None:
                respondent_entries = instance.respondent_entries

        sanitized_entries = []
        if respondent_entries:
            if method == PnaeAcceptabilityTest.Method.REST_INGESTION:
                raise serializers.ValidationError({
                    'respondent_entries': 'Resto-ingestao deve ser registrado por pesagem, nao por respostas individuais.',
                })
            if not isinstance(respondent_entries, list):
                raise serializers.ValidationError({'respondent_entries': 'Informe uma lista de respostas individuais.'})
            valid_response_codes = (
                {'LOVED', 'LIKED', 'INDIFFERENT', 'DISLIKED', 'HATED'}
                if method in {PnaeAcceptabilityTest.Method.HEDONIC, PnaeAcceptabilityTest.Method.LUDIC}
                else {'WITHIN', 'OUTSIDE'}
            )
            for index, entry in enumerate(respondent_entries, start=1):
                if not isinstance(entry, dict):
                    raise serializers.ValidationError({'respondent_entries': f'Entrada {index} invalida.'})
                response_code = str(entry.get('response_code', '')).upper().strip()
                if response_code not in valid_response_codes:
                    raise serializers.ValidationError({
                        'respondent_entries': f'Resposta invalida na linha {index} para o metodo selecionado.',
                    })
                entry_profile = str(entry.get('respondent_type', respondent_profile)).upper().strip()
                if entry_profile not in {
                    PnaeAcceptabilityTest.RespondentProfile.STUDENT,
                    PnaeAcceptabilityTest.RespondentProfile.PROFESSIONAL,
                }:
                    raise serializers.ValidationError({
                        'respondent_entries': f'Perfil do participante invalido na linha {index}.',
                    })
                sanitized_entries.append({
                    'respondent_type': entry_profile,
                    'label': str(entry.get('label', '')).strip(),
                    'group_label': str(entry.get('group_label', '')).strip(),
                    'response_code': response_code,
                })
            attrs['respondent_entries'] = sanitized_entries

        if method == PnaeAcceptabilityTest.Method.REST_INGESTION and analysis_scope != PnaeAcceptabilityTest.AnalysisScope.MENU:
            raise serializers.ValidationError({
                'analysis_scope': 'Resto-ingestão deve avaliar o cardápio/refeição como um todo. Para preparação isolada, use escala hedônica.',
            })

        if method == PnaeAcceptabilityTest.Method.WITHIN_OUTSIDE:
            if analysis_scope != PnaeAcceptabilityTest.AnalysisScope.PRODUCT:
                raise serializers.ValidationError({
                    'analysis_scope': 'O teste dentro-fora do padrão deve ser usado para produto/amostra.',
                })
            if objective != PnaeAcceptabilityTest.Objective.PROCUREMENT_SAMPLE:
                raise serializers.ValidationError({
                    'objective': 'O teste dentro-fora do padrão deve ser vinculado à avaliação de amostra para aquisição.',
                })

        if method in {PnaeAcceptabilityTest.Method.HEDONIC, PnaeAcceptabilityTest.Method.LUDIC}:
            total_responses = len(sanitized_entries) if sanitized_entries else sum(
                int(attrs.get(field, getattr(instance, field, 0) if instance else 0) or 0)
                for field in ['loved_count', 'liked_count', 'indifferent_count', 'disliked_count', 'hated_count']
            )
            if total_responses <= 0:
                raise serializers.ValidationError('Informe ao menos uma resposta da escala hedônica/cartela lúdica.')

        if method == PnaeAcceptabilityTest.Method.WITHIN_OUTSIDE:
            if sanitized_entries:
                within = sum(1 for entry in sanitized_entries if entry['response_code'] == 'WITHIN')
                outside = sum(1 for entry in sanitized_entries if entry['response_code'] == 'OUTSIDE')
            else:
                within = int(attrs.get('within_count', getattr(instance, 'within_count', 0) if instance else 0) or 0)
                outside = int(attrs.get('outside_count', getattr(instance, 'outside_count', 0) if instance else 0) or 0)
            if within + outside <= 0:
                raise serializers.ValidationError('Informe os julgamentos dentro/fora do padrão.')

        if method == PnaeAcceptabilityTest.Method.REST_INGESTION:
            prepared = attrs.get('prepared_weight', getattr(instance, 'prepared_weight', 0) if instance else 0)
            plate_waste = attrs.get('plate_waste_weight', getattr(instance, 'plate_waste_weight', 0) if instance else 0)
            if prepared is None or prepared <= 0:
                raise serializers.ValidationError({'prepared_weight': 'Informe o peso da refeição preparada para o teste.'})
            if plate_waste is None:
                raise serializers.ValidationError({'plate_waste_weight': 'Informe o peso do resto rejeitado.'})

        if eligible_students_count is not None and adhered_students_count is not None and adhered_students_count > eligible_students_count:
            raise serializers.ValidationError({
                'adhered_students_count': 'O número de aderentes não pode ser maior que o total elegível.',
            })

        if previous_test:
            if school and previous_test.school_id != school.id:
                raise serializers.ValidationError({'previous_test': 'O reteste deve pertencer à mesma escola.'})
            if method and previous_test.method != method:
                raise serializers.ValidationError({'previous_test': 'O reteste deve manter o mesmo método do teste anterior.'})
            if preparation_name and previous_test.preparation_name.strip().lower() != preparation_name.strip().lower():
                raise serializers.ValidationError({'previous_test': 'O reteste deve referenciar a mesma preparação/produto.'})
            if previous_test.approved:
                raise serializers.ValidationError({'previous_test': 'Não é necessário retestar um registro já aprovado.'})
            if previous_test.attempt_number >= 3:
                raise serializers.ValidationError({'previous_test': 'O manual limita a sequência a três tentativas.'})
            if test_date and previous_test.test_date and test_date < previous_test.test_date + timedelta(days=60):
                raise serializers.ValidationError({'test_date': 'O reteste deve respeitar intervalo mínimo de um bimestre.'})

        return attrs
