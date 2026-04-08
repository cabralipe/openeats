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

export interface PnaeAcceptabilityTest {
  id: string;
  school: string;
  school_name: string;
  municipality_name?: string;
  menu?: string | null;
  menu_name?: string;
  recipe?: string | null;
  recipe_name?: string;
  previous_test?: string | null;
  previous_test_preparation_name?: string;
  method: 'HEDONIC' | 'LUDIC' | 'REST_INGESTION' | 'WITHIN_OUTSIDE';
  method_display?: string;
  objective: 'NEW_OR_ATYPICAL' | 'RECURRING_MENU' | 'PROCUREMENT_SAMPLE';
  objective_display?: string;
  analysis_scope: 'PREPARATION' | 'MENU' | 'PRODUCT';
  analysis_scope_display?: string;
  service_mode: 'CAFETERIA' | 'CLASSROOM' | 'SELF_SERVICE' | 'PROCUREMENT_PANEL';
  service_mode_display?: string;
  preparation_name: string;
  target_group?: string;
  respondent_profile?: 'NOT_INFORMED' | 'STUDENT' | 'PROFESSIONAL';
  respondent_profile_display?: string;
  respondent_entries?: Array<{
    respondent_type: 'STUDENT' | 'PROFESSIONAL';
    label?: string;
    group_label?: string;
    response_code: 'LOVED' | 'LIKED' | 'INDIFFERENT' | 'DISLIKED' | 'HATED' | 'WITHIN' | 'OUTSIDE';
  }>;
  classes_sampled?: string;
  test_date: string;
  weekday_label?: string;
  weather_context?: string;
  serving_time?: string;
  participants_count: number;
  eligible_students_count?: number | null;
  adhered_students_count?: number | null;
  loved_count: number;
  liked_count: number;
  indifferent_count: number;
  disliked_count: number;
  hated_count: number;
  within_count: number;
  outside_count: number;
  prepared_weight: string | number;
  leftover_weight: string | number;
  plate_waste_weight: string | number;
  non_edible_weight: string | number;
  distributed_weight: string | number;
  attempt_number: number;
  minimum_threshold: string | number;
  rejection_index: string | number;
  acceptance_index: string | number;
  adhesion_index: string | number;
  adhesion_classification?: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW' | 'NOT_INFORMED';
  adhesion_classification_display?: string;
  approved: boolean;
  next_retest_date?: string | null;
  recommendation?: string;
  positive_feedback?: string;
  negative_feedback?: string;
  notes?: string;
  guidance_alerts?: string[];
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PnaeAcceptabilityDashboard {
  total_tests: number;
  approved_tests: number;
  failed_tests: number;
  pending_retest: number;
  low_adhesion_tests: number;
  tests_by_method: Record<string, number>;
  latest_tests: PnaeAcceptabilityTest[];
}

export interface PnaeAcceptanceScenarioDefinition {
  id: string;
  title: string;
  description: string;
}

export interface PnaeAcceptanceScenarioResult extends PnaeAcceptanceScenarioDefinition {
  status: 'PASSED' | 'FAILED';
  duration_ms: number;
  details: string[];
  error?: string;
}

export interface PnaeAcceptanceSuiteCatalog {
  suite_id: string;
  suite_name: string;
  execution_mode: string;
  rolled_back: boolean;
  scenarios: PnaeAcceptanceScenarioDefinition[];
}

export interface PnaeAcceptanceSuiteRun extends PnaeAcceptanceSuiteCatalog {
  executed_at: string;
  executed_by?: {
    id: string;
    name: string;
    email: string;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration_ms: number;
    status: 'PASSED' | 'FAILED';
  };
  results: PnaeAcceptanceScenarioResult[];
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
  can_reopen?: boolean;
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

export interface SchoolConsumptionItem {
  id: string;
  school: string;
  school_name: string;
  supply: {
    id: string;
    name: string;
    category: string;
    unit: string;
    min_stock: number;
    is_active: boolean;
  };
  quantity: number;
  min_stock: number;
  is_low_stock: boolean;
  status: string;
  last_updated?: string;
}

export interface SchoolConsumptionPayload {
  school: {
    id: string;
    name: string;
    municipality_name?: string;
  };
  summary: {
    available_items: number;
    low_stock: number;
    normal_stock: number;
  };
  items: SchoolConsumptionItem[];
}

export interface SchoolMealServiceCategory {
  meal_type: string;
  meal_label: string;
  items: string[];
}

export interface SchoolMealServicePayload {
  school: string;
  school_name: string;
  service_date: string;
  weekday: string;
  menu: {
    id: string;
    week_start: string;
    week_end: string;
  } | null;
  categories: SchoolMealServiceCategory[];
  existing_entries: Record<string, number>;
}
