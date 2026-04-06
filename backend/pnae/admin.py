from django.contrib import admin

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


class PnaeAnnualPlanItemInline(admin.TabularInline):
    model = PnaeAnnualPlanItem
    extra = 0
    autocomplete_fields = ('education_stage', 'education_modality', 'recipe')


class PnaeAnnualGoalInline(admin.TabularInline):
    model = PnaeAnnualGoal
    extra = 0


class PnaeAnnualActionInline(admin.TabularInline):
    model = PnaeAnnualAction
    extra = 0


class PnaeAnnualPlanWorkflowEventInline(admin.TabularInline):
    model = PnaeAnnualPlanWorkflowEvent
    extra = 0
    readonly_fields = ('action', 'from_status', 'to_status', 'comment', 'actor', 'created_at')
    can_delete = False


class PnaeAnnualPlanMonthlyExecutionInline(admin.TabularInline):
    model = PnaeAnnualPlanMonthlyExecution
    extra = 0
    readonly_fields = ('created_at', 'updated_at')


class PnaeAnnualScheduleEntryInline(admin.TabularInline):
    model = PnaeAnnualScheduleEntry
    extra = 0


class PnaeAnnualBudgetItemInline(admin.TabularInline):
    model = PnaeAnnualBudgetItem
    extra = 0


class PnaeAnnualEvaluationToolInline(admin.TabularInline):
    model = PnaeAnnualEvaluationTool
    extra = 0


@admin.register(PnaeAnnualPlan)
class PnaeAnnualPlanAdmin(admin.ModelAdmin):
    list_display = ('school', 'year', 'status', 'responsible_nutritionist', 'created_by', 'submitted_at', 'approved_at')
    list_filter = ('status', 'year', 'school', 'school__municipality')
    search_fields = ('school__name', 'title', 'notes', 'justification', 'diagnosis_summary')
    autocomplete_fields = (
        'school',
        'created_by',
        'responsible_nutritionist',
        'submitted_by',
        'approved_by',
        'rejected_by',
    )
    readonly_fields = ('created_at', 'updated_at', 'submitted_at', 'approved_at', 'rejected_at')
    inlines = [
        PnaeAnnualPlanItemInline,
        PnaeAnnualGoalInline,
        PnaeAnnualActionInline,
        PnaeAnnualPlanMonthlyExecutionInline,
        PnaeAnnualPlanWorkflowEventInline,
        PnaeAnnualScheduleEntryInline,
        PnaeAnnualBudgetItemInline,
        PnaeAnnualEvaluationToolInline,
    ]


@admin.register(PnaeAnnualPlanItem)
class PnaeAnnualPlanItemAdmin(admin.ModelAdmin):
    list_display = ('plan', 'month', 'education_stage', 'education_modality', 'meal_type', 'recipe', 'servings_planned')
    list_filter = ('month', 'meal_type', 'education_stage', 'education_modality', 'plan__school__municipality')
    search_fields = ('plan__school__name', 'recipe__name', 'notes')
    autocomplete_fields = ('plan', 'education_stage', 'education_modality', 'recipe')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(PnaeAnnualGoal)
class PnaeAnnualGoalAdmin(admin.ModelAdmin):
    list_display = ('title', 'plan', 'indicator', 'target_value', 'current_value', 'due_date', 'order')
    list_filter = ('plan__year', 'plan__school__municipality', 'plan__school')
    search_fields = ('title', 'description', 'indicator', 'plan__school__name')
    autocomplete_fields = ('plan',)


@admin.register(PnaeAnnualAction)
class PnaeAnnualActionAdmin(admin.ModelAdmin):
    list_display = ('title', 'plan', 'responsible_sector', 'status', 'start_date', 'end_date', 'order')
    list_filter = ('status', 'plan__year', 'plan__school__municipality', 'plan__school')
    search_fields = ('title', 'description', 'responsible_sector', 'plan__school__name')
    autocomplete_fields = ('plan',)


@admin.register(PnaeAnnualScheduleEntry)
class PnaeAnnualScheduleEntryAdmin(admin.ModelAdmin):
    list_display = ('activity', 'plan', 'month', 'expected_result', 'order')
    list_filter = ('month', 'plan__year', 'plan__school__municipality', 'plan__school')
    search_fields = ('activity', 'expected_result', 'plan__school__name')
    autocomplete_fields = ('plan',)


@admin.register(PnaeAnnualBudgetItem)
class PnaeAnnualBudgetItemAdmin(admin.ModelAdmin):
    list_display = ('category', 'plan', 'funding_source', 'estimated_amount', 'executed_amount', 'order')
    list_filter = ('plan__year', 'plan__school__municipality', 'plan__school')
    search_fields = ('category', 'description', 'funding_source', 'plan__school__name')
    autocomplete_fields = ('plan',)


@admin.register(PnaeAnnualEvaluationTool)
class PnaeAnnualEvaluationToolAdmin(admin.ModelAdmin):
    list_display = ('name', 'plan', 'frequency', 'target_audience', 'order')
    list_filter = ('plan__year', 'plan__school__municipality', 'plan__school')
    search_fields = ('name', 'description', 'frequency', 'target_audience', 'plan__school__name')
    autocomplete_fields = ('plan',)


@admin.register(PnaeAnnualPlanWorkflowEvent)
class PnaeAnnualPlanWorkflowEventAdmin(admin.ModelAdmin):
    list_display = ('plan', 'action', 'from_status', 'to_status', 'actor', 'created_at')
    list_filter = ('action', 'to_status', 'plan__year', 'plan__school__municipality', 'plan__school')
    search_fields = ('plan__school__name', 'comment', 'actor__email', 'actor__name')
    autocomplete_fields = ('plan', 'actor')
    readonly_fields = ('created_at',)


@admin.register(PnaeAnnualPlanMonthlyExecution)
class PnaeAnnualPlanMonthlyExecutionAdmin(admin.ModelAdmin):
    list_display = (
        'plan',
        'month',
        'status',
        'progress_percent',
        'planned_servings',
        'executed_servings',
        'last_updated_by',
        'updated_at',
    )
    list_filter = ('status', 'month', 'plan__year', 'plan__school__municipality', 'plan__school')
    search_fields = ('plan__school__name', 'execution_notes', 'deviation_notes', 'last_updated_by__email')
    autocomplete_fields = ('plan', 'last_updated_by')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(PnaeAcceptabilityTest)
class PnaeAcceptabilityTestAdmin(admin.ModelAdmin):
    list_display = (
        'test_date',
        'school',
        'preparation_name',
        'method',
        'analysis_scope',
        'acceptance_index',
        'minimum_threshold',
        'approved',
        'attempt_number',
    )
    list_filter = (
        'method',
        'objective',
        'analysis_scope',
        'service_mode',
        'approved',
        'school__municipality',
        'school',
    )
    search_fields = ('preparation_name', 'school__name', 'target_group', 'notes')
    autocomplete_fields = ('school', 'menu', 'recipe', 'previous_test', 'created_by')
    readonly_fields = (
        'weekday_label',
        'participants_count',
        'distributed_weight',
        'attempt_number',
        'minimum_threshold',
        'rejection_index',
        'acceptance_index',
        'adhesion_index',
        'adhesion_classification',
        'approved',
        'next_retest_date',
        'recommendation',
        'created_at',
        'updated_at',
    )
    date_hierarchy = 'test_date'
