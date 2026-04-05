export interface School {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'pending';
  image?: string;
  publicSlug?: string;
  publicToken?: string;
  address?: string;
  city?: string;
  municipality?: string | null;
  municipality_name?: string;
  municipality_state?: string;
  education_stages?: string[];
  education_modalities?: string[];
  education_stage_details?: EducationStage[];
  education_modality_details?: EducationModality[];
}

export interface EducationStage {
  id: string;
  name: string;
  code: string;
  age_range_start?: number | null;
  age_range_end?: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EducationModality {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NutritionistUser {
  id: string;
  name: string;
  email: string;
  crn?: string;
  function_role?: string;
  role: string;
  role_display?: string;
  municipality?: string | null;
  municipality_name?: string;
  is_active: boolean;
}

export interface PnaeAnnualPlanSummary {
  id: string;
  school: string;
  school_name: string;
  municipality_name?: string;
  year: number;
  title: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  responsible_nutritionist_name?: string;
  submitted_at?: string | null;
  approved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PnaeAnnualGoal {
  id: string;
  plan: string;
  title: string;
  description?: string;
  indicator?: string;
  target_value?: string | number | null;
  current_value?: string | number | null;
  due_date?: string | null;
  order?: number;
}

export interface PnaeAnnualAction {
  id: string;
  plan: string;
  title: string;
  description?: string;
  responsible_sector?: string;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  order?: number;
}

export interface PnaeAnnualScheduleEntry {
  id: string;
  plan: string;
  month: number;
  activity: string;
  expected_result?: string;
  order?: number;
}

export interface PnaeAnnualBudgetItem {
  id: string;
  plan: string;
  category: string;
  description?: string;
  funding_source?: string;
  estimated_amount?: string | number;
  executed_amount?: string | number;
  order?: number;
}

export interface PnaeAnnualEvaluationTool {
  id: string;
  plan: string;
  name: string;
  description?: string;
  frequency?: string;
  target_audience?: string;
  order?: number;
}

export interface PnaeAnnualPlanItem {
  id: string;
  plan: string;
  education_stage: string;
  education_stage_name: string;
  education_modality: string;
  education_modality_name: string;
  month: number;
  meal_type: string;
  recipe?: string | null;
  recipe_name?: string;
  servings_planned: number;
  weekly_frequency: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PnaeAnnualPlanWorkflowEvent {
  id: string;
  action: string;
  action_display?: string;
  from_status?: string;
  to_status: string;
  to_status_display?: string;
  comment?: string;
  actor?: string | null;
  actor_name?: string;
  created_at?: string;
}

export interface PnaeAnnualPlanMonthlyExecution {
  id: string;
  plan: string;
  month: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETED' | 'BLOCKED';
  status_display?: string;
  progress_percent: number;
  planned_servings: number;
  executed_servings: number;
  execution_notes?: string;
  deviation_notes?: string;
  evidence_links?: string[];
  last_updated_by?: string | null;
  last_updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PnaeOperationalMonthOverview {
  month: number;
  month_label: string;
  projected_items: number;
  projected_occurrences: number;
  projected_servings: number;
  estimated_cost: number;
  supplies_with_shortage: number;
  supplies_uncovered_centrally: number;
}

export interface PnaeOperationalProjectionItem {
  id: string;
  month: number;
  education_stage_name: string;
  education_modality_name: string;
  meal_type: string;
  meal_type_display: string;
  recipe_id?: string | null;
  recipe_name?: string;
  weekly_frequency: number;
  monthly_occurrences: number;
  projected_servings: number;
  estimated_cost: number;
  notes?: string;
}

export interface PnaeOperationalProcurementItem {
  supply_id: string;
  supply_name: string;
  unit: string;
  qty_needed: number;
  estimated_cost: number;
  school_stock_available: number;
  central_stock_available: number;
  school_shortage: number;
  central_shortage: number;
}

export interface PnaeOperationalMenuProjectionItem {
  date: string;
  day_of_week: string;
  week_start: string;
  week_end: string;
  meal_type: string;
  meal_type_display: string;
  recipe_id?: string | null;
  recipe_name?: string;
  education_stage_name: string;
  education_modality_name: string;
  servings_planned: number;
  plan_item_id: string;
}

export interface PnaeOperationalSummary {
  selected_month: number;
  selected_month_label: string;
  monthly_overview: PnaeOperationalMonthOverview[];
  annual_summary: {
    projected_items: number;
    projected_occurrences: number;
    projected_servings: number;
    estimated_cost: number;
    supplies_with_shortage: number;
    supplies_uncovered_centrally: number;
  };
  detail: {
    month: number;
    month_label: string;
    summary: PnaeOperationalMonthOverview;
    items: PnaeOperationalProjectionItem[];
    menu_projection: PnaeOperationalMenuProjectionItem[];
    procurement: PnaeOperationalProcurementItem[];
    warnings: string[];
  };
}

export interface PnaeDashboardSummary {
  plans_by_status: Record<string, number>;
  overdue_goals: number;
  delayed_actions: number;
  budget_estimated: number;
  budget_executed: number;
  schools_covered: number;
  stages_covered: number;
  modalities_covered: number;
  monthly_execution_open: number;
}

export interface PnaeAnnualPlanDetail extends PnaeAnnualPlanSummary {
  justification: string;
  diagnosis_summary: string;
  general_objectives: string;
  operational_strategy: string;
  execution_locations: string;
  executing_agency: string;
  financial_schedule_notes: string;
  notes: string;
  last_review_comment?: string;
  created_by?: string;
  created_by_name?: string;
  responsible_nutritionist?: string | null;
  submitted_by?: string | null;
  submitted_by_name?: string;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_by_name?: string;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_by_name?: string;
  rejected_at?: string | null;
  can_edit?: boolean;
  can_submit?: boolean;
  can_approve?: boolean;
  items: PnaeAnnualPlanItem[];
  goals: PnaeAnnualGoal[];
  actions: PnaeAnnualAction[];
  schedule_entries: PnaeAnnualScheduleEntry[];
  budget_items: PnaeAnnualBudgetItem[];
  evaluation_tools: PnaeAnnualEvaluationTool[];
  workflow_events: PnaeAnnualPlanWorkflowEvent[];
  monthly_executions: PnaeAnnualPlanMonthlyExecution[];
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  status: 'critical' | 'adequate' | 'warning';
  nova_classification?: string;
  nova_classification_display?: string;
  nutritional_function?: string;
  nutritional_function_display?: string;
}

export interface MenuItem {
  day: string;
  date: string;
  lunch: string;
  snack: string;
  image: string;
}

export interface ConsumptionEntry {
  id: string;
  date: string;
  meal: string;
  type: string;
  served: number;
  repetitions: number;
}
