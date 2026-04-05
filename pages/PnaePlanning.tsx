import React, { useEffect, useMemo, useState } from "react";
import {
  approvePnaePlan,
  createEducationModality,
  createEducationStage,
  createPnaePlan,
  createPnaePlanAction,
  createPnaePlanBudgetItem,
  createPnaePlanEvaluationTool,
  createPnaePlanGoal,
  createPnaePlanItem,
  createPnaePlanMonthlyExecution,
  createPnaePlanScheduleEntry,
  deleteEducationModality,
  deleteEducationStage,
  deletePnaePlan,
  deletePnaePlanAction,
  deletePnaePlanBudgetItem,
  deletePnaePlanEvaluationTool,
  deletePnaePlanGoal,
  deletePnaePlanItem,
  deletePnaePlanScheduleEntry,
  getEducationModalities,
  getEducationStages,
  getMe,
  getNutritionists,
  getPnaeDashboard,
  getPnaeOperationalSummary,
  getPnaePlan,
  getPnaePlans,
  getRecipes,
  getSchools,
  generatePnaeDeliveryDraft,
  generatePnaeMenuDrafts,
  rejectPnaePlan,
  submitPnaePlanReview,
  updateEducationModality,
  updateEducationStage,
  updatePnaePlan,
  updatePnaePlanAction,
  updatePnaePlanBudgetItem,
  updatePnaePlanEvaluationTool,
  updatePnaePlanGoal,
  updatePnaePlanItem,
  updatePnaePlanMonthlyExecution,
  updatePnaePlanScheduleEntry,
} from "../api";
import {
  EducationModality,
  EducationStage,
  NutritionistUser,
  PnaeAnnualAction,
  PnaeAnnualBudgetItem,
  PnaeAnnualEvaluationTool,
  PnaeAnnualGoal,
  PnaeAnnualPlanMonthlyExecution,
  PnaeAnnualPlanDetail,
  PnaeAnnualPlanItem,
  PnaeAnnualPlanSummary,
  PnaeAnnualScheduleEntry,
  PnaeDashboardSummary,
  PnaeOperationalSummary,
  School,
} from "../types";

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  role_display?: string;
};

type RecipeOption = {
  id: string;
  name: string;
  category?: string;
};

type StageForm = {
  name: string;
  code: string;
  age_range_start: string;
  age_range_end: string;
  is_active: boolean;
};

type ModalityForm = {
  name: string;
  code: string;
  is_active: boolean;
};

type PlanForm = {
  school: string;
  year: string;
  title: string;
  status: "DRAFT" | "ARCHIVED";
  responsible_nutritionist: string;
  justification: string;
  diagnosis_summary: string;
  general_objectives: string;
  operational_strategy: string;
  execution_locations: string;
  executing_agency: string;
  financial_schedule_notes: string;
  notes: string;
};

type GoalForm = {
  title: string;
  description: string;
  indicator: string;
  target_value: string;
  current_value: string;
  due_date: string;
  order: string;
};

type ActionForm = {
  title: string;
  description: string;
  responsible_sector: string;
  start_date: string;
  end_date: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  order: string;
};

type ItemForm = {
  education_stage: string;
  education_modality: string;
  month: string;
  meal_type: string;
  recipe: string;
  servings_planned: string;
  weekly_frequency: string;
  notes: string;
};

type ScheduleEntryForm = {
  month: string;
  activity: string;
  expected_result: string;
  order: string;
};

type BudgetItemForm = {
  category: string;
  description: string;
  funding_source: string;
  estimated_amount: string;
  executed_amount: string;
  order: string;
};

type EvaluationToolForm = {
  name: string;
  description: string;
  frequency: string;
  target_audience: string;
  order: string;
};

type ExecutionForm = {
  month: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "PARTIAL" | "COMPLETED" | "BLOCKED";
  progress_percent: string;
  executed_servings: string;
  execution_notes: string;
  deviation_notes: string;
  evidence_links: string;
};

const VIEWER_ROLES = new Set([
  "SEMED_ADMIN",
  "MUNICIPAL_MANAGER",
  "NUTRITIONIST",
  "SCHOOL_FEEDING_COORDINATOR",
  "SCHOOL_DIRECTOR",
  "CAE_COUNCILOR",
]);

const MANAGER_ROLES = new Set([
  "SEMED_ADMIN",
  "MUNICIPAL_MANAGER",
  "NUTRITIONIST",
  "SCHOOL_FEEDING_COORDINATOR",
]);

const PLAN_STATUS_OPTIONS: Array<{
  value: PnaeAnnualPlanSummary["status"];
  label: string;
  tone: string;
}> = [
  {
    value: "DRAFT",
    label: "Rascunho",
    tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  {
    value: "IN_REVIEW",
    label: "Em revisao",
    tone: "bg-warning-100 text-warning-700 dark:bg-warning-900/20 dark:text-warning-300",
  },
  {
    value: "APPROVED",
    label: "Aprovado",
    tone: "bg-success-100 text-success-700 dark:bg-success-900/20 dark:text-success-300",
  },
  {
    value: "REJECTED",
    label: "Reprovado",
    tone: "bg-danger-100 text-danger-700 dark:bg-danger-900/20 dark:text-danger-300",
  },
  {
    value: "ARCHIVED",
    label: "Arquivado",
    tone: "bg-secondary-100 text-secondary-700 dark:bg-secondary-900/20 dark:text-secondary-300",
  },
];

const PLAN_FORM_STATUS_OPTIONS: Array<{
  value: PlanForm["status"];
  label: string;
}> = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "ARCHIVED", label: "Arquivado" },
];

const EXECUTION_STATUS_OPTIONS: Array<{
  value: ExecutionForm["status"];
  label: string;
}> = [
  { value: "NOT_STARTED", label: "Nao iniciada" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "COMPLETED", label: "Concluida" },
  { value: "BLOCKED", label: "Bloqueada" },
];

const ACTION_STATUS_OPTIONS: Array<{
  value: ActionForm["status"];
  label: string;
}> = [
  { value: "PLANNED", label: "Planejada" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "COMPLETED", label: "Concluida" },
  { value: "CANCELLED", label: "Cancelada" },
];

const MEAL_TYPE_OPTIONS = [
  { value: "BREAKFAST1", label: "Desjejum 1" },
  { value: "SNACK1", label: "Lanche 1" },
  { value: "LUNCH", label: "Almoco" },
  { value: "SNACK2", label: "Lanche 2" },
  { value: "BREAKFAST2", label: "Desjejum 2" },
  { value: "DINNER_COFFEE", label: "Cafe da noite" },
  { value: "BREAKFAST", label: "Cafe (legado)" },
  { value: "SNACK", label: "Lanche (legado)" },
];

const MONTH_OPTIONS = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Marco" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const PLAN_STEP_LABELS = [
  "Dados gerais",
  "Diretrizes tecnicas",
  "Execucao e financeiro",
];
const GOAL_STEP_LABELS = ["Meta", "Indicadores"];
const ACTION_STEP_LABELS = ["Acao", "Execucao"];
const ITEM_STEP_LABELS = ["Publico", "Oferta", "Planejamento"];
const SCHEDULE_STEP_LABELS = ["Atividade", "Resultado"];
const BUDGET_STEP_LABELS = ["Categoria", "Valores"];
const EVALUATION_STEP_LABELS = ["Instrumento", "Aplicacao"];

const emptyStageForm = (): StageForm => ({
  name: "",
  code: "",
  age_range_start: "",
  age_range_end: "",
  is_active: true,
});
const emptyModalityForm = (): ModalityForm => ({
  name: "",
  code: "",
  is_active: true,
});
const emptyPlanForm = (): PlanForm => ({
  school: "",
  year: String(new Date().getFullYear()),
  title: "",
  status: "DRAFT",
  responsible_nutritionist: "",
  justification: "",
  diagnosis_summary: "",
  general_objectives: "",
  operational_strategy: "",
  execution_locations: "",
  executing_agency: "",
  financial_schedule_notes: "",
  notes: "",
});
const emptyGoalForm = (): GoalForm => ({
  title: "",
  description: "",
  indicator: "",
  target_value: "",
  current_value: "",
  due_date: "",
  order: "0",
});
const emptyActionForm = (): ActionForm => ({
  title: "",
  description: "",
  responsible_sector: "",
  start_date: "",
  end_date: "",
  status: "PLANNED",
  order: "0",
});
const emptyItemForm = (): ItemForm => ({
  education_stage: "",
  education_modality: "",
  month: "1",
  meal_type: "LUNCH",
  recipe: "",
  servings_planned: "0",
  weekly_frequency: "1",
  notes: "",
});
const emptyScheduleEntryForm = (): ScheduleEntryForm => ({
  month: "1",
  activity: "",
  expected_result: "",
  order: "0",
});
const emptyBudgetItemForm = (): BudgetItemForm => ({
  category: "",
  description: "",
  funding_source: "",
  estimated_amount: "",
  executed_amount: "",
  order: "0",
});
const emptyEvaluationToolForm = (): EvaluationToolForm => ({
  name: "",
  description: "",
  frequency: "",
  target_audience: "",
  order: "0",
});
const emptyExecutionForm = (): ExecutionForm => ({
  month: String(new Date().getMonth() + 1),
  status: "NOT_STARTED",
  progress_percent: "0",
  executed_servings: "0",
  execution_notes: "",
  deviation_notes: "",
  evidence_links: "",
});

const parseErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim() ? error.message : fallback;
const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "-";
const formatDate = (value?: string | null) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "-";
const formatCurrency = (value?: string | number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
const getPlanStatusMeta = (status: string) =>
  PLAN_STATUS_OPTIONS.find((option) => option.value === status) ||
  PLAN_STATUS_OPTIONS[0];
const getMealTypeLabel = (mealType: string) =>
  MEAL_TYPE_OPTIONS.find((option) => option.value === mealType)?.label ||
  mealType;

const normalizeSchool = (school: any): School => ({
  id: school.id,
  name: school.name,
  address: school.address || "",
  city: school.city || "",
  municipality: school.municipality || null,
  municipality_name: school.municipality_name || "",
  municipality_state: school.municipality_state || "",
  location:
    [school.address, school.municipality_name || school.city]
      .filter(Boolean)
      .join(" - ") || "Sem endereco",
  status: school.is_active ? "active" : "pending",
  publicSlug: school.public_slug,
  publicToken: school.public_token,
  education_stages: Array.isArray(school.education_stages)
    ? school.education_stages
    : [],
  education_modalities: Array.isArray(school.education_modalities)
    ? school.education_modalities
    : [],
  education_stage_details: Array.isArray(school.education_stage_details)
    ? school.education_stage_details
    : [],
  education_modality_details: Array.isArray(school.education_modality_details)
    ? school.education_modality_details
    : [],
});

const normalizePlanToForm = (plan: PnaeAnnualPlanDetail): PlanForm => ({
  school: plan.school,
  year: String(plan.year),
  title: plan.title || "",
  status: plan.status === "ARCHIVED" ? "ARCHIVED" : "DRAFT",
  responsible_nutritionist: plan.responsible_nutritionist || "",
  justification: plan.justification || "",
  diagnosis_summary: plan.diagnosis_summary || "",
  general_objectives: plan.general_objectives || "",
  operational_strategy: plan.operational_strategy || "",
  execution_locations: plan.execution_locations || "",
  executing_agency: plan.executing_agency || "",
  financial_schedule_notes: plan.financial_schedule_notes || "",
  notes: plan.notes || "",
});

const normalizeGoalToForm = (goal: PnaeAnnualGoal): GoalForm => ({
  title: goal.title || "",
  description: goal.description || "",
  indicator: goal.indicator || "",
  target_value:
    goal.target_value === null || goal.target_value === undefined
      ? ""
      : String(goal.target_value),
  current_value:
    goal.current_value === null || goal.current_value === undefined
      ? ""
      : String(goal.current_value),
  due_date: goal.due_date || "",
  order: String(goal.order ?? 0),
});

const normalizeActionToForm = (action: PnaeAnnualAction): ActionForm => ({
  title: action.title || "",
  description: action.description || "",
  responsible_sector: action.responsible_sector || "",
  start_date: action.start_date || "",
  end_date: action.end_date || "",
  status: (action.status as ActionForm["status"]) || "PLANNED",
  order: String(action.order ?? 0),
});

const normalizeItemToForm = (item: PnaeAnnualPlanItem): ItemForm => ({
  education_stage: item.education_stage || "",
  education_modality: item.education_modality || "",
  month: String(item.month || 1),
  meal_type: item.meal_type || "LUNCH",
  recipe: item.recipe || "",
  servings_planned: String(item.servings_planned ?? 0),
  weekly_frequency: String(item.weekly_frequency ?? 1),
  notes: item.notes || "",
});

const normalizeScheduleEntryToForm = (
  entry: PnaeAnnualScheduleEntry,
): ScheduleEntryForm => ({
  month: String(entry.month || 1),
  activity: entry.activity || "",
  expected_result: entry.expected_result || "",
  order: String(entry.order ?? 0),
});

const normalizeBudgetItemToForm = (
  item: PnaeAnnualBudgetItem,
): BudgetItemForm => ({
  category: item.category || "",
  description: item.description || "",
  funding_source: item.funding_source || "",
  estimated_amount:
    item.estimated_amount === null || item.estimated_amount === undefined
      ? ""
      : String(item.estimated_amount),
  executed_amount:
    item.executed_amount === null || item.executed_amount === undefined
      ? ""
      : String(item.executed_amount),
  order: String(item.order ?? 0),
});

const normalizeEvaluationToolToForm = (
  tool: PnaeAnnualEvaluationTool,
): EvaluationToolForm => ({
  name: tool.name || "",
  description: tool.description || "",
  frequency: tool.frequency || "",
  target_audience: tool.target_audience || "",
  order: String(tool.order ?? 0),
});

const normalizeExecutionToForm = (
  execution: PnaeAnnualPlanMonthlyExecution,
): ExecutionForm => ({
  month: String(execution.month || 1),
  status: execution.status || "NOT_STARTED",
  progress_percent: String(execution.progress_percent ?? 0),
  executed_servings: String(execution.executed_servings ?? 0),
  execution_notes: execution.execution_notes || "",
  deviation_notes: execution.deviation_notes || "",
  evidence_links: Array.isArray(execution.evidence_links)
    ? execution.evidence_links.join("\n")
    : "",
});

type ModalShellProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
  closeOnOverlayClick?: boolean;
};

const ModalShell: React.FC<ModalShellProps> = ({
  title,
  subtitle,
  onClose,
  children,
  maxWidthClass = "max-w-4xl",
  closeOnOverlayClick = false,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm animate-fade-in md:items-center md:p-6"
    onClick={closeOnOverlayClick ? onClose : undefined}
  >
    <div
      className={`relative my-auto flex max-h-[calc(100dvh-1.5rem)] min-h-0 w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-slide-up dark:bg-slate-900 md:max-h-[calc(100dvh-3rem)] md:rounded-2xl md:animate-scale-in ${maxWidthClass}`}
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 md:px-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
          {subtitle ? (
            <p className="text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-slate-400">
            close
          </span>
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto px-5 py-5 md:px-6">
        {children}
      </div>
    </div>
  </div>
);

const ModalSteps: React.FC<{
  labels: string[];
  currentStep: number;
  onSelect: (step: number) => void;
}> = ({ labels, currentStep, onSelect }) => (
  <div
    className={`grid gap-3 ${labels.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}
  >
    {labels.map((label, index) => {
      const isActive = index === currentStep;
      const isCompleted = index < currentStep;
      return (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(index)}
          className={`rounded-2xl border p-4 text-left transition ${
            isActive
              ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/10"
              : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                isActive || isCompleted
                  ? "bg-primary-500 text-white"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {label}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Etapa {index + 1} de {labels.length}
              </p>
            </div>
          </div>
        </button>
      );
    })}
  </div>
);

const ModalStepActions: React.FC<{
  step: number;
  totalSteps: number;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  saving: boolean;
  submitLabel: string;
}> = ({ step, totalSteps, onCancel, onBack, onNext, saving, submitLabel }) => (
  <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
    <button type="button" onClick={onCancel} className="btn-secondary">
      Cancelar
    </button>
    <div className="flex flex-col gap-2 sm:flex-row">
      {step > 0 ? (
        <button type="button" onClick={onBack} className="btn-secondary">
          Voltar
        </button>
      ) : null}
      {step < totalSteps - 1 ? (
        <button type="button" onClick={onNext} className="btn-primary">
          Continuar
        </button>
      ) : (
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Salvando..." : submitLabel}
        </button>
      )}
    </div>
  </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
    {children}
  </label>
);

const StatCard: React.FC<{ label: string; value: React.ReactNode; icon: string }> = ({
  label,
  value,
  icon,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
          {value}
        </p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-500 dark:bg-primary-900/20">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
    </div>
  </div>
);

const PnaePlanning: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [nutritionists, setNutritionists] = useState<NutritionistUser[]>([]);
  const [stages, setStages] = useState<EducationStage[]>([]);
  const [modalities, setModalities] = useState<EducationModality[]>([]);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [plans, setPlans] = useState<PnaeAnnualPlanSummary[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isBootstrapping, setBootstrapping] = useState(true);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingOperational, setLoadingOperational] = useState(false);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dashboardSummary, setDashboardSummary] =
    useState<PnaeDashboardSummary | null>(null);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showModalityModal, setShowModalityModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planStep, setPlanStep] = useState(0);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalStep, setGoalStep] = useState(0);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionStep, setActionStep] = useState(0);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemStep, setItemStep] = useState(0);
  const [showScheduleEntryModal, setShowScheduleEntryModal] = useState(false);
  const [scheduleEntryStep, setScheduleEntryStep] = useState(0);
  const [showBudgetItemModal, setShowBudgetItemModal] = useState(false);
  const [budgetItemStep, setBudgetItemStep] = useState(0);
  const [showEvaluationToolModal, setShowEvaluationToolModal] = useState(false);
  const [evaluationToolStep, setEvaluationToolStep] = useState(0);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [editingStage, setEditingStage] = useState<EducationStage | null>(null);
  const [editingModality, setEditingModality] =
    useState<EducationModality | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<PnaeAnnualGoal | null>(null);
  const [editingAction, setEditingAction] = useState<PnaeAnnualAction | null>(
    null,
  );
  const [editingItem, setEditingItem] = useState<PnaeAnnualPlanItem | null>(
    null,
  );
  const [editingScheduleEntry, setEditingScheduleEntry] =
    useState<PnaeAnnualScheduleEntry | null>(null);
  const [editingBudgetItem, setEditingBudgetItem] =
    useState<PnaeAnnualBudgetItem | null>(null);
  const [editingEvaluationTool, setEditingEvaluationTool] =
    useState<PnaeAnnualEvaluationTool | null>(null);
  const [editingExecution, setEditingExecution] =
    useState<PnaeAnnualPlanMonthlyExecution | null>(null);
  const [detailPlan, setDetailPlan] = useState<PnaeAnnualPlanDetail | null>(
    null,
  );
  const [operationalSummary, setOperationalSummary] =
    useState<PnaeOperationalSummary | null>(null);
  const [selectedOperationalMonth, setSelectedOperationalMonth] = useState("");
  const [stageForm, setStageForm] = useState<StageForm>(emptyStageForm);
  const [modalityForm, setModalityForm] =
    useState<ModalityForm>(emptyModalityForm);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [goalForm, setGoalForm] = useState<GoalForm>(emptyGoalForm);
  const [actionForm, setActionForm] = useState<ActionForm>(emptyActionForm);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [scheduleEntryForm, setScheduleEntryForm] = useState<ScheduleEntryForm>(
    emptyScheduleEntryForm,
  );
  const [budgetItemForm, setBudgetItemForm] =
    useState<BudgetItemForm>(emptyBudgetItemForm);
  const [evaluationToolForm, setEvaluationToolForm] =
    useState<EvaluationToolForm>(emptyEvaluationToolForm);
  const [executionForm, setExecutionForm] =
    useState<ExecutionForm>(emptyExecutionForm);
  const [savingStage, setSavingStage] = useState(false);
  const [savingModality, setSavingModality] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [savingScheduleEntry, setSavingScheduleEntry] = useState(false);
  const [savingBudgetItem, setSavingBudgetItem] = useState(false);
  const [savingEvaluationTool, setSavingEvaluationTool] = useState(false);
  const [savingExecution, setSavingExecution] = useState(false);

  const canViewPnae = currentUser ? VIEWER_ROLES.has(currentUser.role) : false;
  const canManagePnae = currentUser ? MANAGER_ROLES.has(currentUser.role) : false;
  const selectedPlanSchool = useMemo(
    () => schools.find((school) => school.id === detailPlan?.school) || null,
    [detailPlan?.school, schools],
  );

  const filteredPlans = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter(
      (plan) =>
        plan.title?.toLowerCase().includes(term) ||
        plan.school_name?.toLowerCase().includes(term) ||
        plan.responsible_nutritionist_name?.toLowerCase().includes(term) ||
        String(plan.year).includes(term),
    );
  }, [plans, search]);

  const loadReferences = async (loadExtended = true) => {
    setLoadingReferences(true);
    try {
      const requests = loadExtended
        ? await Promise.all([
            getSchools({ is_active: true }),
            getNutritionists({ is_active: true }),
            getEducationStages(),
            getEducationModalities(),
            getRecipes({ active: true }),
          ])
        : await Promise.all([
            getSchools({ is_active: true }),
            getNutritionists({ is_active: true }),
          ]);
      const [schoolsData, nutritionistsData, stagesData, modalitiesData, recipesData] =
        requests as any[];
      setSchools(
        Array.isArray(schoolsData)
          ? (schoolsData as any[]).map((school) => normalizeSchool(school))
          : [],
      );
      setNutritionists(
        Array.isArray(nutritionistsData)
          ? (nutritionistsData as NutritionistUser[])
          : [],
      );
      setStages(
        Array.isArray(stagesData) ? (stagesData as EducationStage[]) : [],
      );
      setModalities(
        Array.isArray(modalitiesData)
          ? (modalitiesData as EducationModality[])
          : [],
      );
      setRecipes(
        Array.isArray(recipesData) ? (recipesData as RecipeOption[]) : [],
      );
    } catch (loadError) {
      setError(
        parseErrorMessage(
          loadError,
          "Nao foi possivel carregar as referencias do modulo PNAE.",
        ),
      );
    } finally {
      setLoadingReferences(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const data = (await getPnaeDashboard()) as PnaeDashboardSummary;
      setDashboardSummary(data);
    } catch (loadError) {
      setError(
        parseErrorMessage(
          loadError,
          "Nao foi possivel carregar os indicadores do PNAE.",
        ),
      );
    }
  };

  const loadPlans = async () => {
    setLoadingPlans(true);
    try {
      const data = await getPnaePlans({
        school: schoolFilter || undefined,
        year: yearFilter || undefined,
        status: statusFilter || undefined,
      });
      setPlans(Array.isArray(data) ? (data as PnaeAnnualPlanSummary[]) : []);
      await loadDashboard();
    } catch (loadError) {
      setError(
        parseErrorMessage(
          loadError,
          "Nao foi possivel carregar os planos anuais.",
        ),
      );
    } finally {
      setLoadingPlans(false);
    }
  };

  const loadPlanDetail = async (planId: string) => {
    setLoadingDetail(true);
    try {
      const plan = (await getPnaePlan(planId)) as PnaeAnnualPlanDetail;
      setDetailPlan(plan);
      const initialMonth =
        selectedOperationalMonth ||
        String(
          plan.monthly_executions?.[0]?.month ||
            plan.items?.[0]?.month ||
            new Date().getMonth() + 1,
        );
      setSelectedOperationalMonth(initialMonth);
      return plan;
    } catch (loadError) {
      setError(
        parseErrorMessage(
          loadError,
          "Nao foi possivel carregar os detalhes do plano.",
        ),
      );
      return null;
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadOperationalProjection = async (planId: string, month?: string) => {
    setLoadingOperational(true);
    try {
      const data = (await getPnaeOperationalSummary(planId, {
        month: month || undefined,
      })) as PnaeOperationalSummary;
      setOperationalSummary(data);
      if (data.selected_month) {
        setSelectedOperationalMonth(String(data.selected_month));
      }
    } catch (loadError) {
      setError(
        parseErrorMessage(
          loadError,
          "Nao foi possivel carregar a projecao operacional do plano.",
        ),
      );
    } finally {
      setLoadingOperational(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      setBootstrapping(true);
      try {
        const me = (await getMe()) as CurrentUser;
        if (cancelled) return;
        setCurrentUser(me);
        if (VIEWER_ROLES.has(me.role)) {
          await Promise.all([
            loadReferences(MANAGER_ROLES.has(me.role)),
            loadPlans(),
          ]);
        }
      } catch (loadError) {
        if (!cancelled)
          setError(
            parseErrorMessage(
              loadError,
              "Nao foi possivel validar a sessao atual.",
            ),
          );
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    };
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canViewPnae || isBootstrapping) return;
    const timeout = setTimeout(() => {
      loadPlans();
    }, 200);
    return () => clearTimeout(timeout);
  }, [canViewPnae, isBootstrapping, schoolFilter, yearFilter, statusFilter]);

  useEffect(() => {
    if (!success) return;
    const timeout = setTimeout(() => setSuccess(""), 2500);
    return () => clearTimeout(timeout);
  }, [success]);

  useEffect(() => {
    if (!detailPlan) {
      setOperationalSummary(null);
      return;
    }
    loadOperationalProjection(detailPlan.id, selectedOperationalMonth || undefined);
  }, [detailPlan?.id, selectedOperationalMonth]);

  const openCreateStage = () => {
    setEditingStage(null);
    setStageForm(emptyStageForm());
    setShowStageModal(true);
  };

  const openEditStage = (stage: EducationStage) => {
    setEditingStage(stage);
    setStageForm({
      name: stage.name || "",
      code: stage.code || "",
      age_range_start:
        stage.age_range_start === null || stage.age_range_start === undefined
          ? ""
          : String(stage.age_range_start),
      age_range_end:
        stage.age_range_end === null || stage.age_range_end === undefined
          ? ""
          : String(stage.age_range_end),
      is_active: Boolean(stage.is_active),
    });
    setShowStageModal(true);
  };

  const openCreateModality = () => {
    setEditingModality(null);
    setModalityForm(emptyModalityForm());
    setShowModalityModal(true);
  };

  const openEditModality = (modality: EducationModality) => {
    setEditingModality(modality);
    setModalityForm({
      name: modality.name || "",
      code: modality.code || "",
      is_active: Boolean(modality.is_active),
    });
    setShowModalityModal(true);
  };

  const openCreatePlan = () => {
    setEditingPlanId(null);
    setPlanForm(emptyPlanForm());
    setPlanStep(0);
    setShowPlanModal(true);
  };

  const openEditPlan = async (planId: string) => {
    if (!canManagePnae) return;
    setLoadingDetail(true);
    try {
      const plan = (await getPnaePlan(planId)) as PnaeAnnualPlanDetail;
      if (!plan.can_edit) {
        setError(
          "Este plano esta bloqueado para edicao. Use o fluxo de aprovacao ou consulte o historico.",
        );
        return;
      }
      setEditingPlanId(planId);
      setPlanForm(normalizePlanToForm(plan));
      setPlanStep(0);
      setShowPlanModal(true);
    } catch (loadError) {
      setError(
        parseErrorMessage(
          loadError,
          "Nao foi possivel carregar o plano selecionado.",
        ),
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const openCreateGoal = () => {
    if (!detailPlan || !canManagePnae || !detailPlan.can_edit) return;
    setEditingGoal(null);
    setGoalForm({ ...emptyGoalForm(), order: String(detailPlan.goals.length) });
    setGoalStep(0);
    setShowGoalModal(true);
  };

  const openEditGoal = (goal: PnaeAnnualGoal) => {
    if (!canManagePnae || !detailPlan?.can_edit) return;
    setEditingGoal(goal);
    setGoalForm(normalizeGoalToForm(goal));
    setGoalStep(0);
    setShowGoalModal(true);
  };

  const openCreateAction = () => {
    if (!detailPlan || !canManagePnae || !detailPlan.can_edit) return;
    setEditingAction(null);
    setActionForm({
      ...emptyActionForm(),
      order: String(detailPlan.actions.length),
    });
    setActionStep(0);
    setShowActionModal(true);
  };

  const openEditAction = (action: PnaeAnnualAction) => {
    if (!canManagePnae || !detailPlan?.can_edit) return;
    setEditingAction(action);
    setActionForm(normalizeActionToForm(action));
    setActionStep(0);
    setShowActionModal(true);
  };

  const openCreateItem = () => {
    if (!detailPlan || !canManagePnae || !detailPlan.can_edit) return;
    const firstStage =
      selectedPlanSchool?.education_stage_details?.[0]?.id || "";
    const firstModality =
      selectedPlanSchool?.education_modality_details?.[0]?.id || "";
    setEditingItem(null);
    setItemForm({
      ...emptyItemForm(),
      education_stage: firstStage,
      education_modality: firstModality,
    });
    setItemStep(0);
    setShowItemModal(true);
  };

  const openEditItem = (item: PnaeAnnualPlanItem) => {
    if (!canManagePnae || !detailPlan?.can_edit) return;
    setEditingItem(item);
    setItemForm(normalizeItemToForm(item));
    setItemStep(0);
    setShowItemModal(true);
  };

  const openCreateScheduleEntry = () => {
    if (!detailPlan || !canManagePnae || !detailPlan.can_edit) return;
    setEditingScheduleEntry(null);
    setScheduleEntryForm({
      ...emptyScheduleEntryForm(),
      order: String(detailPlan.schedule_entries.length),
    });
    setScheduleEntryStep(0);
    setShowScheduleEntryModal(true);
  };

  const openEditScheduleEntry = (entry: PnaeAnnualScheduleEntry) => {
    if (!canManagePnae || !detailPlan?.can_edit) return;
    setEditingScheduleEntry(entry);
    setScheduleEntryForm(normalizeScheduleEntryToForm(entry));
    setScheduleEntryStep(0);
    setShowScheduleEntryModal(true);
  };

  const openCreateBudgetItem = () => {
    if (!detailPlan || !canManagePnae || !detailPlan.can_edit) return;
    setEditingBudgetItem(null);
    setBudgetItemForm({
      ...emptyBudgetItemForm(),
      order: String(detailPlan.budget_items.length),
    });
    setBudgetItemStep(0);
    setShowBudgetItemModal(true);
  };

  const openEditBudgetItem = (item: PnaeAnnualBudgetItem) => {
    if (!canManagePnae || !detailPlan?.can_edit) return;
    setEditingBudgetItem(item);
    setBudgetItemForm(normalizeBudgetItemToForm(item));
    setBudgetItemStep(0);
    setShowBudgetItemModal(true);
  };

  const openCreateEvaluationTool = () => {
    if (!detailPlan || !canManagePnae || !detailPlan.can_edit) return;
    setEditingEvaluationTool(null);
    setEvaluationToolForm({
      ...emptyEvaluationToolForm(),
      order: String(detailPlan.evaluation_tools.length),
    });
    setEvaluationToolStep(0);
    setShowEvaluationToolModal(true);
  };

  const openEditEvaluationTool = (tool: PnaeAnnualEvaluationTool) => {
    if (!canManagePnae || !detailPlan?.can_edit) return;
    setEditingEvaluationTool(tool);
    setEvaluationToolForm(normalizeEvaluationToolToForm(tool));
    setEvaluationToolStep(0);
    setShowEvaluationToolModal(true);
  };

  const openCreateExecution = (month?: number) => {
    if (!detailPlan) return;
    setEditingExecution(null);
    setExecutionForm({
      ...emptyExecutionForm(),
      month: String(month || detailPlan.items?.[0]?.month || 1),
    });
    setShowExecutionModal(true);
  };

  const openEditExecution = (execution: PnaeAnnualPlanMonthlyExecution) => {
    setEditingExecution(execution);
    setExecutionForm(normalizeExecutionToForm(execution));
    setShowExecutionModal(true);
  };

  const closeExecutionModal = () => {
    setShowExecutionModal(false);
  };

  const refreshDetailAndOperational = async (planId: string) => {
    await Promise.all([
      loadPlanDetail(planId),
      loadPlans(),
      loadOperationalProjection(planId, selectedOperationalMonth || undefined),
    ]);
  };

  const handlePlanWorkflow = async (
    action: "submit" | "approve" | "reject",
  ) => {
    if (!detailPlan) return;
    const comment =
      window.prompt(
        action === "submit"
          ? "Observacoes para a submissao (opcional)"
          : action === "approve"
            ? "Parecer de aprovacao (opcional)"
            : "Motivo da reprovação",
        detailPlan.last_review_comment || "",
      ) || "";
    setError("");
    try {
      if (action === "submit") {
        await submitPnaePlanReview(detailPlan.id, comment);
        setSuccess("Plano submetido para revisao.");
      } else if (action === "approve") {
        await approvePnaePlan(detailPlan.id, comment);
        setSuccess("Plano aprovado.");
      } else {
        await rejectPnaePlan(detailPlan.id, comment);
        setSuccess("Plano reprovado.");
      }
      await refreshDetailAndOperational(detailPlan.id);
    } catch (workflowError) {
      setError(
        parseErrorMessage(
          workflowError,
          "Nao foi possivel executar a transicao de workflow.",
        ),
      );
    }
  };

  const handleGenerateMenuDrafts = async () => {
    if (!detailPlan || !selectedOperationalMonth) return;
    setError("");
    try {
      const result = (await generatePnaeMenuDrafts(detailPlan.id, {
        month: Number(selectedOperationalMonth),
      })) as { created_menus?: { items_created: number }[]; warnings?: string[] };
      const created = result.created_menus?.length || 0;
      const warnings = result.warnings?.length ? ` Avisos: ${result.warnings.join(" | ")}` : "";
      setSuccess(`Rascunhos de cardapio gerados: ${created}.${warnings}`);
      await refreshDetailAndOperational(detailPlan.id);
    } catch (generationError) {
      setError(
        parseErrorMessage(
          generationError,
          "Nao foi possivel gerar os rascunhos de cardapio.",
        ),
      );
    }
  };

  const handleGenerateDeliveryDraft = async () => {
    if (!detailPlan || !selectedOperationalMonth) return;
    setError("");
    try {
      const result = (await generatePnaeDeliveryDraft(detailPlan.id, {
        month: Number(selectedOperationalMonth),
      })) as { items_created?: number; delivery_date?: string };
      setSuccess(
        `Rascunho de entrega criado para ${formatDate(result.delivery_date)} com ${result.items_created || 0} itens.`,
      );
      await refreshDetailAndOperational(detailPlan.id);
    } catch (generationError) {
      setError(
        parseErrorMessage(
          generationError,
          "Nao foi possivel gerar o rascunho de entrega.",
        ),
      );
    }
  };

  const handleSaveStage = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingStage(true);
    setError("");
    try {
      const payload = {
        name: stageForm.name.trim(),
        code: stageForm.code.trim(),
        age_range_start:
          stageForm.age_range_start === ""
            ? null
            : Number(stageForm.age_range_start),
        age_range_end:
          stageForm.age_range_end === ""
            ? null
            : Number(stageForm.age_range_end),
        is_active: stageForm.is_active,
      };
      if (editingStage) {
        await updateEducationStage(editingStage.id, payload);
        setSuccess("Etapa atualizada.");
      } else {
        await createEducationStage(payload);
        setSuccess("Etapa criada.");
      }
      setShowStageModal(false);
      await loadReferences();
    } catch (saveError) {
      setError(
        parseErrorMessage(saveError, "Nao foi possivel salvar a etapa."),
      );
    } finally {
      setSavingStage(false);
    }
  };

  const handleSaveModality = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingModality(true);
    setError("");
    try {
      const payload = {
        name: modalityForm.name.trim(),
        code: modalityForm.code.trim(),
        is_active: modalityForm.is_active,
      };
      if (editingModality) {
        await updateEducationModality(editingModality.id, payload);
        setSuccess("Modalidade atualizada.");
      } else {
        await createEducationModality(payload);
        setSuccess("Modalidade criada.");
      }
      setShowModalityModal(false);
      await loadReferences();
    } catch (saveError) {
      setError(
        parseErrorMessage(saveError, "Nao foi possivel salvar a modalidade."),
      );
    } finally {
      setSavingModality(false);
    }
  };

  const handleSavePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPlan(true);
    setError("");
    try {
      const normalizedYear = Number(planForm.year);
      const existingPlansForScope = await getPnaePlans({
        school: planForm.school,
        year: normalizedYear,
      });
      const duplicatePlan = existingPlansForScope.find(
        (plan) => plan.id !== editingPlanId,
      );
      if (duplicatePlan) {
        setError(
          `Ja existe um plano PNAE para ${duplicatePlan.school_name} no ano de ${duplicatePlan.year}. Abra o plano existente para editar ou escolha outro ano.`,
        );
        return;
      }

      const payload = {
        school: planForm.school,
        year: normalizedYear,
        title: planForm.title.trim(),
        status: planForm.status,
        responsible_nutritionist: planForm.responsible_nutritionist || null,
        justification: planForm.justification.trim(),
        diagnosis_summary: planForm.diagnosis_summary.trim(),
        general_objectives: planForm.general_objectives.trim(),
        operational_strategy: planForm.operational_strategy.trim(),
        execution_locations: planForm.execution_locations.trim(),
        executing_agency: planForm.executing_agency.trim(),
        financial_schedule_notes: planForm.financial_schedule_notes.trim(),
        notes: planForm.notes.trim(),
      };
      if (editingPlanId) {
        await updatePnaePlan(editingPlanId, payload);
        setSuccess("Plano atualizado.");
      } else {
        await createPnaePlan(payload);
        setSuccess("Plano criado.");
      }
      closePlanModal();
      await loadPlans();
      if (detailPlan && editingPlanId === detailPlan.id) {
        await loadPlanDetail(detailPlan.id);
      }
    } catch (saveError) {
      setError(
        parseErrorMessage(saveError, "Nao foi possivel salvar o plano."),
      );
    } finally {
      setSavingPlan(false);
    }
  };

  const closePlanModal = () => {
    setPlanStep(0);
    setShowPlanModal(false);
  };

  const validateModalStep = (isValid: boolean, message: string) => {
    if (isValid) return true;
    setError(message);
    return false;
  };

  const advanceModalStep = (
    currentStep: number,
    totalSteps: number,
    setStep: React.Dispatch<React.SetStateAction<number>>,
    validator: (step: number) => boolean,
  ) => {
    if (!validator(currentStep)) return;
    setStep((step) => Math.min(step + 1, totalSteps - 1));
  };

  const jumpToModalStep = (
    nextStep: number,
    currentStep: number,
    setStep: React.Dispatch<React.SetStateAction<number>>,
    validator: (step: number) => boolean,
  ) => {
    if (nextStep <= currentStep) {
      setStep(nextStep);
      return;
    }
    for (let step = currentStep; step < nextStep; step += 1) {
      if (!validator(step)) return;
    }
    setStep(nextStep);
  };

  const validatePlanStep = (step: number) =>
    step !== 0 ||
    validateModalStep(
      Boolean(planForm.school && planForm.year.trim()),
      "Preencha escola e ano antes de avancar.",
    );

  const goToNextPlanStep = () => {
    advanceModalStep(
      planStep,
      PLAN_STEP_LABELS.length,
      setPlanStep,
      validatePlanStep,
    );
  };

  const goToPreviousPlanStep = () => {
    setPlanStep((currentStep) => Math.max(currentStep - 1, 0));
  };

  const goToPlanStep = (nextStep: number) => {
    jumpToModalStep(nextStep, planStep, setPlanStep, validatePlanStep);
  };

  const closeGoalModal = () => {
    setGoalStep(0);
    setShowGoalModal(false);
  };

  const validateGoalStep = (step: number) =>
    step !== 0 ||
    validateModalStep(
      Boolean(goalForm.title.trim()),
      "Preencha o titulo da meta antes de avancar.",
    );

  const goToNextGoalStep = () => {
    advanceModalStep(
      goalStep,
      GOAL_STEP_LABELS.length,
      setGoalStep,
      validateGoalStep,
    );
  };

  const goToPreviousGoalStep = () => {
    setGoalStep((step) => Math.max(step - 1, 0));
  };

  const goToGoalStep = (nextStep: number) => {
    jumpToModalStep(nextStep, goalStep, setGoalStep, validateGoalStep);
  };

  const closeActionModal = () => {
    setActionStep(0);
    setShowActionModal(false);
  };

  const validateActionStep = (step: number) =>
    step !== 0 ||
    validateModalStep(
      Boolean(actionForm.title.trim()),
      "Preencha o titulo da acao antes de avancar.",
    );

  const goToNextActionStep = () => {
    advanceModalStep(
      actionStep,
      ACTION_STEP_LABELS.length,
      setActionStep,
      validateActionStep,
    );
  };

  const goToPreviousActionStep = () => {
    setActionStep((step) => Math.max(step - 1, 0));
  };

  const goToActionStep = (nextStep: number) => {
    jumpToModalStep(nextStep, actionStep, setActionStep, validateActionStep);
  };

  const closeItemModal = () => {
    setItemStep(0);
    setShowItemModal(false);
  };

  const validateItemStep = (step: number) => {
    if (step !== 0) return true;
    return validateModalStep(
      Boolean(itemForm.education_stage && itemForm.education_modality),
      "Selecione etapa e modalidade antes de avancar.",
    );
  };

  const goToNextItemStep = () => {
    advanceModalStep(
      itemStep,
      ITEM_STEP_LABELS.length,
      setItemStep,
      validateItemStep,
    );
  };

  const goToPreviousItemStep = () => {
    setItemStep((step) => Math.max(step - 1, 0));
  };

  const goToItemStep = (nextStep: number) => {
    jumpToModalStep(nextStep, itemStep, setItemStep, validateItemStep);
  };

  const closeScheduleEntryModal = () => {
    setScheduleEntryStep(0);
    setShowScheduleEntryModal(false);
  };

  const validateScheduleEntryStep = (step: number) =>
    step !== 0 ||
    validateModalStep(
      Boolean(scheduleEntryForm.activity.trim()),
      "Preencha a atividade antes de avancar.",
    );

  const goToNextScheduleEntryStep = () => {
    advanceModalStep(
      scheduleEntryStep,
      SCHEDULE_STEP_LABELS.length,
      setScheduleEntryStep,
      validateScheduleEntryStep,
    );
  };

  const goToPreviousScheduleEntryStep = () => {
    setScheduleEntryStep((step) => Math.max(step - 1, 0));
  };

  const goToScheduleEntryStep = (nextStep: number) => {
    jumpToModalStep(
      nextStep,
      scheduleEntryStep,
      setScheduleEntryStep,
      validateScheduleEntryStep,
    );
  };

  const closeBudgetItemModal = () => {
    setBudgetItemStep(0);
    setShowBudgetItemModal(false);
  };

  const validateBudgetItemStep = (step: number) =>
    step !== 0 ||
    validateModalStep(
      Boolean(budgetItemForm.category.trim()),
      "Preencha a categoria antes de avancar.",
    );

  const goToNextBudgetItemStep = () => {
    advanceModalStep(
      budgetItemStep,
      BUDGET_STEP_LABELS.length,
      setBudgetItemStep,
      validateBudgetItemStep,
    );
  };

  const goToPreviousBudgetItemStep = () => {
    setBudgetItemStep((step) => Math.max(step - 1, 0));
  };

  const goToBudgetItemStep = (nextStep: number) => {
    jumpToModalStep(
      nextStep,
      budgetItemStep,
      setBudgetItemStep,
      validateBudgetItemStep,
    );
  };

  const closeEvaluationToolModal = () => {
    setEvaluationToolStep(0);
    setShowEvaluationToolModal(false);
  };

  const validateEvaluationToolStep = (step: number) =>
    step !== 0 ||
    validateModalStep(
      Boolean(evaluationToolForm.name.trim()),
      "Preencha o nome do instrumento antes de avancar.",
    );

  const goToNextEvaluationToolStep = () => {
    advanceModalStep(
      evaluationToolStep,
      EVALUATION_STEP_LABELS.length,
      setEvaluationToolStep,
      validateEvaluationToolStep,
    );
  };

  const goToPreviousEvaluationToolStep = () => {
    setEvaluationToolStep((step) => Math.max(step - 1, 0));
  };

  const goToEvaluationToolStep = (nextStep: number) => {
    jumpToModalStep(
      nextStep,
      evaluationToolStep,
      setEvaluationToolStep,
      validateEvaluationToolStep,
    );
  };

  const handleSaveGoal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailPlan) return;
    setSavingGoal(true);
    setError("");
    try {
      const payload = {
        plan: detailPlan.id,
        title: goalForm.title.trim(),
        description: goalForm.description.trim(),
        indicator: goalForm.indicator.trim(),
        target_value:
          goalForm.target_value === "" ? null : goalForm.target_value,
        current_value:
          goalForm.current_value === "" ? null : goalForm.current_value,
        due_date: goalForm.due_date || null,
        order: Number(goalForm.order || "0"),
      };
      if (editingGoal) {
        await updatePnaePlanGoal(editingGoal.id, payload);
        setSuccess("Meta atualizada.");
      } else {
        await createPnaePlanGoal(payload);
        setSuccess("Meta criada.");
      }
      closeGoalModal();
      await loadPlanDetail(detailPlan.id);
    } catch (saveError) {
      setError(parseErrorMessage(saveError, "Nao foi possivel salvar a meta."));
    } finally {
      setSavingGoal(false);
    }
  };

  const handleSaveAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailPlan) return;
    setSavingAction(true);
    setError("");
    try {
      const payload = {
        plan: detailPlan.id,
        title: actionForm.title.trim(),
        description: actionForm.description.trim(),
        responsible_sector: actionForm.responsible_sector.trim(),
        start_date: actionForm.start_date || null,
        end_date: actionForm.end_date || null,
        status: actionForm.status,
        order: Number(actionForm.order || "0"),
      };
      if (editingAction) {
        await updatePnaePlanAction(editingAction.id, payload);
        setSuccess("Acao atualizada.");
      } else {
        await createPnaePlanAction(payload);
        setSuccess("Acao criada.");
      }
      closeActionModal();
      await loadPlanDetail(detailPlan.id);
    } catch (saveError) {
      setError(parseErrorMessage(saveError, "Nao foi possivel salvar a acao."));
    } finally {
      setSavingAction(false);
    }
  };

  const handleSaveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailPlan) return;
    setSavingItem(true);
    setError("");
    try {
      const payload = {
        plan: detailPlan.id,
        education_stage: itemForm.education_stage,
        education_modality: itemForm.education_modality,
        month: Number(itemForm.month || "1"),
        meal_type: itemForm.meal_type,
        recipe: itemForm.recipe || null,
        servings_planned: Number(itemForm.servings_planned || "0"),
        weekly_frequency: Number(itemForm.weekly_frequency || "1"),
        notes: itemForm.notes.trim(),
      };
      if (editingItem) {
        await updatePnaePlanItem(editingItem.id, payload);
        setSuccess("Item do plano atualizado.");
      } else {
        await createPnaePlanItem(payload);
        setSuccess("Item do plano criado.");
      }
      closeItemModal();
      await loadPlanDetail(detailPlan.id);
    } catch (saveError) {
      setError(
        parseErrorMessage(
          saveError,
          "Nao foi possivel salvar o item do plano.",
        ),
      );
    } finally {
      setSavingItem(false);
    }
  };

  const handleSaveScheduleEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailPlan) return;
    setSavingScheduleEntry(true);
    setError("");
    try {
      const payload = {
        plan: detailPlan.id,
        month: Number(scheduleEntryForm.month || "1"),
        activity: scheduleEntryForm.activity.trim(),
        expected_result: scheduleEntryForm.expected_result.trim(),
        order: Number(scheduleEntryForm.order || "0"),
      };
      if (editingScheduleEntry) {
        await updatePnaePlanScheduleEntry(editingScheduleEntry.id, payload);
        setSuccess("Entrada de cronograma atualizada.");
      } else {
        await createPnaePlanScheduleEntry(payload);
        setSuccess("Entrada de cronograma criada.");
      }
      closeScheduleEntryModal();
      await loadPlanDetail(detailPlan.id);
    } catch (saveError) {
      setError(
        parseErrorMessage(
          saveError,
          "Nao foi possivel salvar a entrada de cronograma.",
        ),
      );
    } finally {
      setSavingScheduleEntry(false);
    }
  };

  const handleSaveBudgetItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailPlan) return;
    setSavingBudgetItem(true);
    setError("");
    try {
      const payload = {
        plan: detailPlan.id,
        category: budgetItemForm.category.trim(),
        description: budgetItemForm.description.trim(),
        funding_source: budgetItemForm.funding_source.trim(),
        estimated_amount:
          budgetItemForm.estimated_amount === ""
            ? 0
            : Number(budgetItemForm.estimated_amount),
        executed_amount:
          budgetItemForm.executed_amount === ""
            ? 0
            : Number(budgetItemForm.executed_amount),
        order: Number(budgetItemForm.order || "0"),
      };
      if (editingBudgetItem) {
        await updatePnaePlanBudgetItem(editingBudgetItem.id, payload);
        setSuccess("Item orcamentario atualizado.");
      } else {
        await createPnaePlanBudgetItem(payload);
        setSuccess("Item orcamentario criado.");
      }
      closeBudgetItemModal();
      await loadPlanDetail(detailPlan.id);
    } catch (saveError) {
      setError(
        parseErrorMessage(
          saveError,
          "Nao foi possivel salvar o item orcamentario.",
        ),
      );
    } finally {
      setSavingBudgetItem(false);
    }
  };

  const handleSaveEvaluationTool = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailPlan) return;
    setSavingEvaluationTool(true);
    setError("");
    try {
      const payload = {
        plan: detailPlan.id,
        name: evaluationToolForm.name.trim(),
        description: evaluationToolForm.description.trim(),
        frequency: evaluationToolForm.frequency.trim(),
        target_audience: evaluationToolForm.target_audience.trim(),
        order: Number(evaluationToolForm.order || "0"),
      };
      if (editingEvaluationTool) {
        await updatePnaePlanEvaluationTool(editingEvaluationTool.id, payload);
        setSuccess("Instrumento avaliativo atualizado.");
      } else {
        await createPnaePlanEvaluationTool(payload);
        setSuccess("Instrumento avaliativo criado.");
      }
      closeEvaluationToolModal();
      await loadPlanDetail(detailPlan.id);
    } catch (saveError) {
      setError(
        parseErrorMessage(
          saveError,
          "Nao foi possivel salvar o instrumento avaliativo.",
        ),
      );
    } finally {
      setSavingEvaluationTool(false);
    }
  };

  const handleSaveExecution = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailPlan) return;
    setSavingExecution(true);
    setError("");
    try {
      const payload = {
        plan: detailPlan.id,
        month: Number(executionForm.month || "1"),
        status: executionForm.status,
        progress_percent: Number(executionForm.progress_percent || "0"),
        executed_servings: Number(executionForm.executed_servings || "0"),
        execution_notes: executionForm.execution_notes.trim(),
        deviation_notes: executionForm.deviation_notes.trim(),
        evidence_links: executionForm.evidence_links
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      if (editingExecution) {
        await updatePnaePlanMonthlyExecution(editingExecution.id, payload);
        setSuccess("Acompanhamento mensal atualizado.");
      } else {
        await createPnaePlanMonthlyExecution(payload);
        setSuccess("Acompanhamento mensal registrado.");
      }
      closeExecutionModal();
      await refreshDetailAndOperational(detailPlan.id);
    } catch (saveError) {
      setError(
        parseErrorMessage(
          saveError,
          "Nao foi possivel salvar o acompanhamento mensal.",
        ),
      );
    } finally {
      setSavingExecution(false);
    }
  };

  const handleDeleteStage = async (stage: EducationStage) => {
    if (!confirm(`Excluir a etapa ${stage.name}?`)) return;
    try {
      await deleteEducationStage(stage.id);
      setSuccess("Etapa excluida.");
      await loadReferences();
    } catch (deleteError) {
      setError(
        parseErrorMessage(deleteError, "Nao foi possivel excluir a etapa."),
      );
    }
  };

  const handleDeleteModality = async (modality: EducationModality) => {
    if (!confirm(`Excluir a modalidade ${modality.name}?`)) return;
    try {
      await deleteEducationModality(modality.id);
      setSuccess("Modalidade excluida.");
      await loadReferences();
    } catch (deleteError) {
      setError(
        parseErrorMessage(
          deleteError,
          "Nao foi possivel excluir a modalidade.",
        ),
      );
    }
  };

  const handleDeletePlan = async (plan: PnaeAnnualPlanSummary) => {
    if (!canManagePnae) return;
    const planLabel = plan.title || `${plan.school_name} ${plan.year}`;
    if (!confirm(`Excluir o plano ${planLabel}?`)) return;
    try {
      await deletePnaePlan(plan.id);
      setSuccess("Plano excluido.");
      if (detailPlan?.id === plan.id) setDetailPlan(null);
      await loadPlans();
    } catch (deleteError) {
      setError(
        parseErrorMessage(deleteError, "Nao foi possivel excluir o plano."),
      );
    }
  };

  const handleDeleteGoal = async (goal: PnaeAnnualGoal) => {
    if (!canManagePnae || !detailPlan?.can_edit) return;
    if (!detailPlan || !confirm(`Excluir a meta ${goal.title}?`)) return;
    try {
      await deletePnaePlanGoal(goal.id);
      setSuccess("Meta excluida.");
      await loadPlanDetail(detailPlan.id);
    } catch (deleteError) {
      setError(
        parseErrorMessage(deleteError, "Nao foi possivel excluir a meta."),
      );
    }
  };

  const handleDeleteAction = async (action: PnaeAnnualAction) => {
    if (!canManagePnae || !detailPlan?.can_edit) return;
    if (!detailPlan || !confirm(`Excluir a acao ${action.title}?`)) return;
    try {
      await deletePnaePlanAction(action.id);
      setSuccess("Acao excluida.");
      await loadPlanDetail(detailPlan.id);
    } catch (deleteError) {
      setError(
        parseErrorMessage(deleteError, "Nao foi possivel excluir a acao."),
      );
    }
  };

  const handleDeleteItem = async (item: PnaeAnnualPlanItem) => {
    if (!canManagePnae || !detailPlan?.can_edit) return;
    if (!detailPlan || !confirm("Excluir este item do plano?")) return;
    try {
      await deletePnaePlanItem(item.id);
      setSuccess("Item do plano excluido.");
      await loadPlanDetail(detailPlan.id);
    } catch (deleteError) {
      setError(
        parseErrorMessage(
          deleteError,
          "Nao foi possivel excluir o item do plano.",
        ),
      );
    }
  };

  const handleDeleteScheduleEntry = async (entry: PnaeAnnualScheduleEntry) => {
    if (!canManagePnae || !detailPlan?.can_edit) return;
    if (!detailPlan || !confirm("Excluir esta entrada de cronograma?")) return;
    try {
      await deletePnaePlanScheduleEntry(entry.id);
      setSuccess("Entrada de cronograma excluida.");
      await loadPlanDetail(detailPlan.id);
    } catch (deleteError) {
      setError(
        parseErrorMessage(
          deleteError,
          "Nao foi possivel excluir a entrada de cronograma.",
        ),
      );
    }
  };

  const handleDeleteBudgetItem = async (item: PnaeAnnualBudgetItem) => {
    if (!canManagePnae || !detailPlan?.can_edit) return;
    if (
      !detailPlan ||
      !confirm(`Excluir o item orcamentario ${item.category}?`)
    )
      return;
    try {
      await deletePnaePlanBudgetItem(item.id);
      setSuccess("Item orcamentario excluido.");
      await loadPlanDetail(detailPlan.id);
    } catch (deleteError) {
      setError(
        parseErrorMessage(
          deleteError,
          "Nao foi possivel excluir o item orcamentario.",
        ),
      );
    }
  };

  const handleDeleteEvaluationTool = async (tool: PnaeAnnualEvaluationTool) => {
    if (!canManagePnae || !detailPlan?.can_edit) return;
    if (!detailPlan || !confirm(`Excluir o instrumento ${tool.name}?`)) return;
    try {
      await deletePnaePlanEvaluationTool(tool.id);
      setSuccess("Instrumento avaliativo excluido.");
      await loadPlanDetail(detailPlan.id);
    } catch (deleteError) {
      setError(
        parseErrorMessage(
          deleteError,
          "Nao foi possivel excluir o instrumento avaliativo.",
        ),
      );
    }
  };

  if (isBootstrapping) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pb-24 lg:pb-8">
        <div className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
          Carregando modulo PNAE...
        </div>
      </div>
    );
  }

  if (currentUser && !canViewPnae) {
    return (
      <div className="flex flex-1 flex-col pb-24 lg:pb-8">
        <div className="p-4 lg:p-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warning-100 text-warning-700 dark:bg-warning-900/20 dark:text-warning-300">
              <span className="material-symbols-outlined text-3xl">lock</span>
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
              Acesso restrito
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Seu perfil atual nao possui permissao para acessar o modulo PNAE.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-24 lg:pb-8">
      <div className="space-y-6 p-4 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Planejamento PNAE
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Etapas, modalidades, planos anuais e subitens operacionais do
              PNAE.
            </p>
          </div>
          {canManagePnae ? (
            <button onClick={openCreatePlan} className="btn-primary">
              <span className="material-symbols-outlined">add_task</span>Novo
              plano
            </button>
          ) : (
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Perfil em leitura
            </div>
          )}
        </div>

        {dashboardSummary ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Planos ativos"
              value={
                (dashboardSummary.plans_by_status?.DRAFT || 0) +
                (dashboardSummary.plans_by_status?.IN_REVIEW || 0) +
                (dashboardSummary.plans_by_status?.APPROVED || 0)
              }
              icon="assignment"
            />
            <StatCard
              label="Metas vencidas"
              value={dashboardSummary.overdue_goals}
              icon="flag"
            />
            <StatCard
              label="Acoes atrasadas"
              value={dashboardSummary.delayed_actions}
              icon="event_busy"
            />
            <StatCard
              label="Execucoes abertas"
              value={dashboardSummary.monthly_execution_open}
              icon="monitoring"
            />
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl bg-danger-50 p-4 text-sm text-danger-700 dark:bg-danger-900/20 dark:text-danger-300">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          </div>
        ) : null}
        {success ? (
          <div className="rounded-2xl bg-success-50 p-4 text-sm text-success-700 dark:bg-success-900/20 dark:text-success-300">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined">check_circle</span>
              <span>{success}</span>
            </div>
          </div>
        ) : null}
        {canManagePnae ? (
          <div className="grid gap-4 xl:grid-cols-2">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Etapas de ensino
                </h2>
                <p className="text-sm text-slate-500">
                  Base para escolas e itens do plano.
                </p>
              </div>
              <button onClick={openCreateStage} className="btn-secondary">
                <span className="material-symbols-outlined">add</span>Nova etapa
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {loadingReferences ? (
                [1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
                  />
                ))
              ) : stages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  Nenhuma etapa cadastrada.
                </div>
              ) : (
                stages.map((stage) => (
                  <div
                    key={stage.id}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {stage.name}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>Codigo: {stage.code || "-"}</span>
                          {(stage.age_range_start !== null &&
                            stage.age_range_start !== undefined) ||
                          (stage.age_range_end !== null &&
                            stage.age_range_end !== undefined) ? (
                            <span>
                              Faixa: {stage.age_range_start ?? "-"} a{" "}
                              {stage.age_range_end ?? "-"} anos
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${stage.is_active ? "bg-success-100 text-success-700 dark:bg-success-900/20 dark:text-success-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
                      >
                        {stage.is_active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => openEditStage(stage)}
                        className="btn-secondary flex-1"
                      >
                        <span className="material-symbols-outlined">edit</span>
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteStage(stage)}
                        className="btn-secondary flex-1 text-danger-600 dark:text-danger-300"
                      >
                        <span className="material-symbols-outlined">
                          delete
                        </span>
                        Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Modalidades
                </h2>
                <p className="text-sm text-slate-500">
                  Cadastro auxiliar para compor o plano.
                </p>
              </div>
              <button onClick={openCreateModality} className="btn-secondary">
                <span className="material-symbols-outlined">add</span>Nova
                modalidade
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {loadingReferences ? (
                [1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
                  />
                ))
              ) : modalities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  Nenhuma modalidade cadastrada.
                </div>
              ) : (
                modalities.map((modality) => (
                  <div
                    key={modality.id}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {modality.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Codigo: {modality.code || "-"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${modality.is_active ? "bg-success-100 text-success-700 dark:bg-success-900/20 dark:text-success-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
                      >
                        {modality.is_active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => openEditModality(modality)}
                        className="btn-secondary flex-1"
                      >
                        <span className="material-symbols-outlined">edit</span>
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteModality(modality)}
                        className="btn-secondary flex-1 text-danger-600 dark:text-danger-300"
                      >
                        <span className="material-symbols-outlined">
                          delete
                        </span>
                        Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          </div>
        ) : null}

        <section className="card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Planos anuais
              </h2>
              <p className="text-sm text-slate-500">
                Lista operacional por escola e ano.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  search
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="input-with-icon"
                  placeholder="Pesquisar plano"
                />
              </div>
              <select
                value={schoolFilter}
                onChange={(event) => setSchoolFilter(event.target.value)}
                className="input"
              >
                <option value="">Todas as escolas</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
              <input
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                className="input"
                placeholder="Ano"
                inputMode="numeric"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="input"
              >
                <option value="">Todos os status</option>
                {PLAN_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-5">
            {loadingPlans ? (
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : filteredPlans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                Nenhum plano encontrado.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {filteredPlans.map((plan) => {
                  const statusMeta = getPlanStatusMeta(plan.status);
                  return (
                    <article
                      key={plan.id}
                      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-slate-900 dark:text-white">
                            {plan.title ||
                              `Plano ${plan.school_name} ${plan.year}`}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {plan.school_name}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusMeta.tone}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/80">
                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            Ano
                          </p>
                          <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                            {plan.year}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/80">
                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            Responsavel
                          </p>
                          <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                            {plan.responsible_nutritionist_name ||
                              "Nao definido"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                        {plan.municipality_name ? (
                          <span>Municipio: {plan.municipality_name}</span>
                        ) : null}
                        <span>Criado: {formatDateTime(plan.created_at)}</span>
                        <span>
                          Atualizado: {formatDateTime(plan.updated_at)}
                        </span>
                      </div>
                      <div
                        className={`mt-5 grid gap-2 ${
                          canManagePnae ? "grid-cols-3" : "grid-cols-1"
                        }`}
                      >
                        <button
                          onClick={() => loadPlanDetail(plan.id)}
                          className="btn-secondary"
                        >
                          <span className="material-symbols-outlined">
                            visibility
                          </span>
                          Ver
                        </button>
                        {canManagePnae ? (
                          <button
                            onClick={() => openEditPlan(plan.id)}
                            className="btn-secondary"
                          >
                            <span className="material-symbols-outlined">
                              edit
                            </span>
                            Editar
                          </button>
                        ) : null}
                        {canManagePnae ? (
                          <button
                            onClick={() => handleDeletePlan(plan)}
                            className="btn-secondary text-danger-600 dark:text-danger-300"
                          >
                            <span className="material-symbols-outlined">
                              delete
                            </span>
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {showStageModal ? (
        <ModalShell
          title={editingStage ? "Editar etapa" : "Nova etapa"}
          subtitle="Cadastro base para escolas e planos."
          onClose={() => setShowStageModal(false)}
        >
          <form onSubmit={handleSaveStage} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Nome</FieldLabel>
                <input
                  value={stageForm.name}
                  onChange={(event) =>
                    setStageForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="input"
                  placeholder="Ensino fundamental I"
                  required
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Codigo</FieldLabel>
                <input
                  value={stageForm.code}
                  onChange={(event) =>
                    setStageForm((prev) => ({
                      ...prev,
                      code: event.target.value,
                    }))
                  }
                  className="input"
                  placeholder="EF1"
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Idade inicial</FieldLabel>
                <input
                  value={stageForm.age_range_start}
                  onChange={(event) =>
                    setStageForm((prev) => ({
                      ...prev,
                      age_range_start: event.target.value,
                    }))
                  }
                  className="input"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Idade final</FieldLabel>
                <input
                  value={stageForm.age_range_end}
                  onChange={(event) =>
                    setStageForm((prev) => ({
                      ...prev,
                      age_range_end: event.target.value,
                    }))
                  }
                  className="input"
                  inputMode="numeric"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
              <input
                type="checkbox"
                checked={stageForm.is_active}
                onChange={(event) =>
                  setStageForm((prev) => ({
                    ...prev,
                    is_active: event.target.checked,
                  }))
                }
                className="h-5 w-5 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
              />
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  Etapa ativa
                </p>
                <p className="text-xs text-slate-500">
                  Disponivel para novas vinculacoes.
                </p>
              </div>
            </label>
            <button
              type="submit"
              disabled={savingStage}
              className="btn-primary w-full"
            >
              {savingStage ? "Salvando..." : "Salvar etapa"}
            </button>
          </form>
        </ModalShell>
      ) : null}

      {showModalityModal ? (
        <ModalShell
          title={editingModality ? "Editar modalidade" : "Nova modalidade"}
          subtitle="Cadastro auxiliar para composicao do plano anual."
          onClose={() => setShowModalityModal(false)}
        >
          <form onSubmit={handleSaveModality} className="space-y-4">
            <div className="space-y-2">
              <FieldLabel>Nome</FieldLabel>
              <input
                value={modalityForm.name}
                onChange={(event) =>
                  setModalityForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                className="input"
                placeholder="Quilombola"
                required
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Codigo</FieldLabel>
              <input
                value={modalityForm.code}
                onChange={(event) =>
                  setModalityForm((prev) => ({
                    ...prev,
                    code: event.target.value,
                  }))
                }
                className="input"
                placeholder="QUI"
                required
              />
            </div>
            <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
              <input
                type="checkbox"
                checked={modalityForm.is_active}
                onChange={(event) =>
                  setModalityForm((prev) => ({
                    ...prev,
                    is_active: event.target.checked,
                  }))
                }
                className="h-5 w-5 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
              />
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  Modalidade ativa
                </p>
                <p className="text-xs text-slate-500">
                  Disponivel para novas vinculacoes.
                </p>
              </div>
            </label>
            <button
              type="submit"
              disabled={savingModality}
              className="btn-primary w-full"
            >
              {savingModality ? "Salvando..." : "Salvar modalidade"}
            </button>
          </form>
        </ModalShell>
      ) : null}

      {showPlanModal ? (
        <ModalShell
          title={editingPlanId ? "Editar plano anual" : "Novo plano anual"}
          subtitle="Cabecalho e diretrizes principais do plano PNAE."
          onClose={closePlanModal}
          maxWidthClass="max-w-5xl"
        >
          <form onSubmit={handleSavePlan} className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              {PLAN_STEP_LABELS.map((label, index) => {
                const isActive = index === planStep;
                const isCompleted = index < planStep;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => goToPlanStep(index)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? "border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/10"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                          isActive || isCompleted
                            ? "bg-primary-500 text-white"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {label}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Etapa {index + 1} de {PLAN_STEP_LABELS.length}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {planStep === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Escola</FieldLabel>
                  <select
                    value={planForm.school}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        school: event.target.value,
                      }))
                    }
                    className="input"
                    required
                  >
                    <option value="">Selecione</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Ano</FieldLabel>
                  <input
                    value={planForm.year}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        year: event.target.value,
                      }))
                    }
                    className="input"
                    inputMode="numeric"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Status</FieldLabel>
                  <select
                    value={planForm.status}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        status: event.target.value as PlanForm["status"],
                      }))
                    }
                    className="input"
                  >
                    {PLAN_FORM_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Titulo</FieldLabel>
                  <input
                    value={planForm.title}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="Plano anual da alimentacao escolar"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Nutricionista responsavel</FieldLabel>
                  <select
                    value={planForm.responsible_nutritionist}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        responsible_nutritionist: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    <option value="">Nao definido</option>
                    {nutritionists.map((nutritionist) => (
                      <option key={nutritionist.id} value={nutritionist.id}>
                        {nutritionist.name || nutritionist.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {planStep === 1 ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Justificativa</FieldLabel>
                  <textarea
                    value={planForm.justification}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        justification: event.target.value,
                      }))
                    }
                    className="input min-h-[140px]"
                    placeholder="Contexto e motivacao do plano"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Diagnostico nutricional</FieldLabel>
                  <textarea
                    value={planForm.diagnosis_summary}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        diagnosis_summary: event.target.value,
                      }))
                    }
                    className="input min-h-[140px]"
                    placeholder="Resumo do diagnostico atual"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Objetivos gerais</FieldLabel>
                  <textarea
                    value={planForm.general_objectives}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        general_objectives: event.target.value,
                      }))
                    }
                    className="input min-h-[140px]"
                    placeholder="Resultados esperados para o ano"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Estrategia operacional</FieldLabel>
                  <textarea
                    value={planForm.operational_strategy}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        operational_strategy: event.target.value,
                      }))
                    }
                    className="input min-h-[140px]"
                    placeholder="Como o plano sera executado"
                  />
                </div>
              </div>
            ) : null}

            {planStep === 2 ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2 xl:col-span-2">
                  <FieldLabel>Orgao executor</FieldLabel>
                  <input
                    value={planForm.executing_agency}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        executing_agency: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="Secretaria Municipal de Educacao"
                  />
                </div>
                <div className="space-y-2 xl:col-span-2">
                  <FieldLabel>Locais de execucao</FieldLabel>
                  <textarea
                    value={planForm.execution_locations}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        execution_locations: event.target.value,
                      }))
                    }
                    className="input min-h-[112px]"
                    placeholder="Escolas, cozinhas centrais e demais locais envolvidos"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Cronograma financeiro</FieldLabel>
                  <textarea
                    value={planForm.financial_schedule_notes}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        financial_schedule_notes: event.target.value,
                      }))
                    }
                    className="input min-h-[140px]"
                    placeholder="Distribuicao financeira prevista ao longo do ano"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Observacoes</FieldLabel>
                  <textarea
                    value={planForm.notes}
                    onChange={(event) =>
                      setPlanForm((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    className="input min-h-[140px]"
                    placeholder="Pontos complementares do plano"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={closePlanModal}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <div className="flex flex-col gap-2 sm:flex-row">
                {planStep > 0 ? (
                  <button
                    type="button"
                    onClick={goToPreviousPlanStep}
                    className="btn-secondary"
                  >
                    Voltar
                  </button>
                ) : null}
                {planStep < PLAN_STEP_LABELS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goToNextPlanStep}
                    className="btn-primary"
                  >
                    Continuar
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={savingPlan}
                    className="btn-primary"
                  >
                    {savingPlan ? "Salvando..." : "Salvar plano"}
                  </button>
                )}
              </div>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {showGoalModal ? (
        <ModalShell
          title={editingGoal ? "Editar meta" : "Nova meta"}
          subtitle="Meta anual com indicador, prazo e ordem de exibicao."
          onClose={closeGoalModal}
        >
          <form onSubmit={handleSaveGoal} className="space-y-5">
            <ModalSteps
              labels={GOAL_STEP_LABELS}
              currentStep={goalStep}
              onSelect={goToGoalStep}
            />

            {goalStep === 0 ? (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <FieldLabel>Titulo</FieldLabel>
                  <input
                    value={goalForm.title}
                    onChange={(event) =>
                      setGoalForm((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="Ampliar cobertura de cardapios padronizados"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Descricao</FieldLabel>
                  <textarea
                    value={goalForm.description}
                    onChange={(event) =>
                      setGoalForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    className="input min-h-[140px]"
                    placeholder="Detalhe o resultado esperado desta meta"
                  />
                </div>
              </div>
            ) : null}

            {goalStep === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Indicador</FieldLabel>
                  <input
                    value={goalForm.indicator}
                    onChange={(event) =>
                      setGoalForm((prev) => ({
                        ...prev,
                        indicator: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="Percentual de escolas atendidas"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Prazo</FieldLabel>
                  <input
                    type="date"
                    value={goalForm.due_date}
                    onChange={(event) =>
                      setGoalForm((prev) => ({
                        ...prev,
                        due_date: event.target.value,
                      }))
                    }
                    className="input"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Ordem</FieldLabel>
                  <input
                    value={goalForm.order}
                    onChange={(event) =>
                      setGoalForm((prev) => ({
                        ...prev,
                        order: event.target.value,
                      }))
                    }
                    className="input"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Valor alvo</FieldLabel>
                  <input
                    value={goalForm.target_value}
                    onChange={(event) =>
                      setGoalForm((prev) => ({
                        ...prev,
                        target_value: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="100"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Valor atual</FieldLabel>
                  <input
                    value={goalForm.current_value}
                    onChange={(event) =>
                      setGoalForm((prev) => ({
                        ...prev,
                        current_value: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="35"
                  />
                </div>
              </div>
            ) : null}

            <ModalStepActions
              step={goalStep}
              totalSteps={GOAL_STEP_LABELS.length}
              onCancel={closeGoalModal}
              onBack={goToPreviousGoalStep}
              onNext={goToNextGoalStep}
              saving={savingGoal}
              submitLabel="Salvar meta"
            />
          </form>
        </ModalShell>
      ) : null}

      {showActionModal ? (
        <ModalShell
          title={editingAction ? "Editar acao" : "Nova acao"}
          subtitle="Acoes operacionais vinculadas ao plano anual."
          onClose={closeActionModal}
        >
          <form onSubmit={handleSaveAction} className="space-y-5">
            <ModalSteps
              labels={ACTION_STEP_LABELS}
              currentStep={actionStep}
              onSelect={goToActionStep}
            />

            {actionStep === 0 ? (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <FieldLabel>Titulo</FieldLabel>
                  <input
                    value={actionForm.title}
                    onChange={(event) =>
                      setActionForm((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="Atualizar fichas tecnicas do semestre"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Setor responsavel</FieldLabel>
                  <input
                    value={actionForm.responsible_sector}
                    onChange={(event) =>
                      setActionForm((prev) => ({
                        ...prev,
                        responsible_sector: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="Coordenacao de alimentacao escolar"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Descricao</FieldLabel>
                  <textarea
                    value={actionForm.description}
                    onChange={(event) =>
                      setActionForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    className="input min-h-[140px]"
                    placeholder="Descreva a atividade a ser executada"
                  />
                </div>
              </div>
            ) : null}

            {actionStep === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Status</FieldLabel>
                  <select
                    value={actionForm.status}
                    onChange={(event) =>
                      setActionForm((prev) => ({
                        ...prev,
                        status: event.target.value as ActionForm["status"],
                      }))
                    }
                    className="input"
                  >
                    {ACTION_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Ordem</FieldLabel>
                  <input
                    value={actionForm.order}
                    onChange={(event) =>
                      setActionForm((prev) => ({
                        ...prev,
                        order: event.target.value,
                      }))
                    }
                    className="input"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Inicio</FieldLabel>
                  <input
                    type="date"
                    value={actionForm.start_date}
                    onChange={(event) =>
                      setActionForm((prev) => ({
                        ...prev,
                        start_date: event.target.value,
                      }))
                    }
                    className="input"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Fim</FieldLabel>
                  <input
                    type="date"
                    value={actionForm.end_date}
                    onChange={(event) =>
                      setActionForm((prev) => ({
                        ...prev,
                        end_date: event.target.value,
                      }))
                    }
                    className="input"
                  />
                </div>
              </div>
            ) : null}

            <ModalStepActions
              step={actionStep}
              totalSteps={ACTION_STEP_LABELS.length}
              onCancel={closeActionModal}
              onBack={goToPreviousActionStep}
              onNext={goToNextActionStep}
              saving={savingAction}
              submitLabel="Salvar acao"
            />
          </form>
        </ModalShell>
      ) : null}

      {showItemModal ? (
        <ModalShell
          title={editingItem ? "Editar item do plano" : "Novo item do plano"}
          subtitle="Distribuicao mensal por etapa, modalidade, refeicao e receita."
          onClose={closeItemModal}
        >
          <form onSubmit={handleSaveItem} className="space-y-5">
            <ModalSteps
              labels={ITEM_STEP_LABELS}
              currentStep={itemStep}
              onSelect={goToItemStep}
            />

            {itemStep === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Etapa</FieldLabel>
                  <select
                    value={itemForm.education_stage}
                    onChange={(event) =>
                      setItemForm((prev) => ({
                        ...prev,
                        education_stage: event.target.value,
                      }))
                    }
                    className="input"
                    required
                  >
                    <option value="">Selecione</option>
                    {(selectedPlanSchool?.education_stage_details?.length
                      ? selectedPlanSchool.education_stage_details
                      : stages
                    ).map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Modalidade</FieldLabel>
                  <select
                    value={itemForm.education_modality}
                    onChange={(event) =>
                      setItemForm((prev) => ({
                        ...prev,
                        education_modality: event.target.value,
                      }))
                    }
                    className="input"
                    required
                  >
                    <option value="">Selecione</option>
                    {(selectedPlanSchool?.education_modality_details?.length
                      ? selectedPlanSchool.education_modality_details
                      : modalities
                    ).map((modality) => (
                      <option key={modality.id} value={modality.id}>
                        {modality.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {itemStep === 1 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <FieldLabel>Mes</FieldLabel>
                  <select
                    value={itemForm.month}
                    onChange={(event) =>
                      setItemForm((prev) => ({
                        ...prev,
                        month: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    {MONTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Tipo de refeicao</FieldLabel>
                  <select
                    value={itemForm.meal_type}
                    onChange={(event) =>
                      setItemForm((prev) => ({
                        ...prev,
                        meal_type: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    {MEAL_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Receita</FieldLabel>
                  <select
                    value={itemForm.recipe}
                    onChange={(event) =>
                      setItemForm((prev) => ({
                        ...prev,
                        recipe: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    <option value="">Sem receita vinculada</option>
                    {recipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>
                        {recipe.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {itemStep === 2 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Porcoes planejadas</FieldLabel>
                  <input
                    value={itemForm.servings_planned}
                    onChange={(event) =>
                      setItemForm((prev) => ({
                        ...prev,
                        servings_planned: event.target.value,
                      }))
                    }
                    className="input"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Frequencia semanal</FieldLabel>
                  <input
                    value={itemForm.weekly_frequency}
                    onChange={(event) =>
                      setItemForm((prev) => ({
                        ...prev,
                        weekly_frequency: event.target.value,
                      }))
                    }
                    className="input"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Observacoes</FieldLabel>
                  <textarea
                    value={itemForm.notes}
                    onChange={(event) =>
                      setItemForm((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    className="input min-h-[112px]"
                    placeholder="Preferencia, substituicoes, ajustes."
                  />
                </div>
              </div>
            ) : null}

            <ModalStepActions
              step={itemStep}
              totalSteps={ITEM_STEP_LABELS.length}
              onCancel={closeItemModal}
              onBack={goToPreviousItemStep}
              onNext={goToNextItemStep}
              saving={savingItem}
              submitLabel="Salvar item"
            />
          </form>
        </ModalShell>
      ) : null}

      {showScheduleEntryModal ? (
        <ModalShell
          title={
            editingScheduleEntry
              ? "Editar cronograma"
              : "Nova entrada de cronograma"
          }
          subtitle="Atividade mensal e resultado esperado do plano anual."
          onClose={closeScheduleEntryModal}
        >
          <form onSubmit={handleSaveScheduleEntry} className="space-y-5">
            <ModalSteps
              labels={SCHEDULE_STEP_LABELS}
              currentStep={scheduleEntryStep}
              onSelect={goToScheduleEntryStep}
            />

            {scheduleEntryStep === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Mes</FieldLabel>
                  <select
                    value={scheduleEntryForm.month}
                    onChange={(event) =>
                      setScheduleEntryForm((prev) => ({
                        ...prev,
                        month: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    {MONTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Atividade</FieldLabel>
                  <textarea
                    value={scheduleEntryForm.activity}
                    onChange={(event) =>
                      setScheduleEntryForm((prev) => ({
                        ...prev,
                        activity: event.target.value,
                      }))
                    }
                    className="input min-h-[140px]"
                    required
                  />
                </div>
              </div>
            ) : null}

            {scheduleEntryStep === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Resultado esperado</FieldLabel>
                  <textarea
                    value={scheduleEntryForm.expected_result}
                    onChange={(event) =>
                      setScheduleEntryForm((prev) => ({
                        ...prev,
                        expected_result: event.target.value,
                      }))
                    }
                    className="input min-h-[120px]"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Ordem</FieldLabel>
                  <input
                    value={scheduleEntryForm.order}
                    onChange={(event) =>
                      setScheduleEntryForm((prev) => ({
                        ...prev,
                        order: event.target.value,
                      }))
                    }
                    className="input"
                    inputMode="numeric"
                  />
                </div>
              </div>
            ) : null}

            <ModalStepActions
              step={scheduleEntryStep}
              totalSteps={SCHEDULE_STEP_LABELS.length}
              onCancel={closeScheduleEntryModal}
              onBack={goToPreviousScheduleEntryStep}
              onNext={goToNextScheduleEntryStep}
              saving={savingScheduleEntry}
              submitLabel="Salvar cronograma"
            />
          </form>
        </ModalShell>
      ) : null}
      {showBudgetItemModal ? (
        <ModalShell
          title={
            editingBudgetItem
              ? "Editar item orcamentario"
              : "Novo item orcamentario"
          }
          subtitle="Categoria, fonte e valores previstos para execucao do plano."
          onClose={closeBudgetItemModal}
        >
          <form onSubmit={handleSaveBudgetItem} className="space-y-5">
            <ModalSteps
              labels={BUDGET_STEP_LABELS}
              currentStep={budgetItemStep}
              onSelect={goToBudgetItemStep}
            />

            {budgetItemStep === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Categoria</FieldLabel>
                  <input
                    value={budgetItemForm.category}
                    onChange={(event) =>
                      setBudgetItemForm((prev) => ({
                        ...prev,
                        category: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="Generos alimenticios"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Fonte de recurso</FieldLabel>
                  <input
                    value={budgetItemForm.funding_source}
                    onChange={(event) =>
                      setBudgetItemForm((prev) => ({
                        ...prev,
                        funding_source: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="PNAE federal"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Descricao</FieldLabel>
                  <textarea
                    value={budgetItemForm.description}
                    onChange={(event) =>
                      setBudgetItemForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    className="input min-h-[140px]"
                  />
                </div>
              </div>
            ) : null}

            {budgetItemStep === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Valor estimado</FieldLabel>
                  <input
                    value={budgetItemForm.estimated_amount}
                    onChange={(event) =>
                      setBudgetItemForm((prev) => ({
                        ...prev,
                        estimated_amount: event.target.value,
                      }))
                    }
                    className="input"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Valor executado</FieldLabel>
                  <input
                    value={budgetItemForm.executed_amount}
                    onChange={(event) =>
                      setBudgetItemForm((prev) => ({
                        ...prev,
                        executed_amount: event.target.value,
                      }))
                    }
                    className="input"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Ordem</FieldLabel>
                  <input
                    value={budgetItemForm.order}
                    onChange={(event) =>
                      setBudgetItemForm((prev) => ({
                        ...prev,
                        order: event.target.value,
                      }))
                    }
                    className="input"
                    inputMode="numeric"
                  />
                </div>
              </div>
            ) : null}

            <ModalStepActions
              step={budgetItemStep}
              totalSteps={BUDGET_STEP_LABELS.length}
              onCancel={closeBudgetItemModal}
              onBack={goToPreviousBudgetItemStep}
              onNext={goToNextBudgetItemStep}
              saving={savingBudgetItem}
              submitLabel="Salvar item orcamentario"
            />
          </form>
        </ModalShell>
      ) : null}
      {showEvaluationToolModal ? (
        <ModalShell
          title={
            editingEvaluationTool
              ? "Editar instrumento avaliativo"
              : "Novo instrumento avaliativo"
          }
          subtitle="Ferramenta, frequencia e publico para acompanhamento do plano."
          onClose={closeEvaluationToolModal}
        >
          <form onSubmit={handleSaveEvaluationTool} className="space-y-5">
            <ModalSteps
              labels={EVALUATION_STEP_LABELS}
              currentStep={evaluationToolStep}
              onSelect={goToEvaluationToolStep}
            />

            {evaluationToolStep === 0 ? (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <FieldLabel>Nome</FieldLabel>
                  <input
                    value={evaluationToolForm.name}
                    onChange={(event) =>
                      setEvaluationToolForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="Checklist de aceitabilidade"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Descricao</FieldLabel>
                  <textarea
                    value={evaluationToolForm.description}
                    onChange={(event) =>
                      setEvaluationToolForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    className="input min-h-[140px]"
                  />
                </div>
              </div>
            ) : null}

            {evaluationToolStep === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Frequencia</FieldLabel>
                  <input
                    value={evaluationToolForm.frequency}
                    onChange={(event) =>
                      setEvaluationToolForm((prev) => ({
                        ...prev,
                        frequency: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="Mensal"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Ordem</FieldLabel>
                  <input
                    value={evaluationToolForm.order}
                    onChange={(event) =>
                      setEvaluationToolForm((prev) => ({
                        ...prev,
                        order: event.target.value,
                      }))
                    }
                    className="input"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Publico-alvo</FieldLabel>
                  <input
                    value={evaluationToolForm.target_audience}
                    onChange={(event) =>
                      setEvaluationToolForm((prev) => ({
                        ...prev,
                        target_audience: event.target.value,
                      }))
                    }
                    className="input"
                    placeholder="Nutricionistas e gestores"
                  />
                </div>
              </div>
            ) : null}

            <ModalStepActions
              step={evaluationToolStep}
              totalSteps={EVALUATION_STEP_LABELS.length}
              onCancel={closeEvaluationToolModal}
              onBack={goToPreviousEvaluationToolStep}
              onNext={goToNextEvaluationToolStep}
              saving={savingEvaluationTool}
              submitLabel="Salvar instrumento avaliativo"
            />
          </form>
        </ModalShell>
      ) : null}
      {showExecutionModal ? (
        <ModalShell
          title={
            editingExecution
              ? "Atualizar execucao mensal"
              : "Novo acompanhamento mensal"
          }
          subtitle="Registre andamento, evidencias e desvios do mes."
          onClose={closeExecutionModal}
        >
          <form onSubmit={handleSaveExecution} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Mes</FieldLabel>
                <select
                  value={executionForm.month}
                  onChange={(event) =>
                    setExecutionForm((prev) => ({
                      ...prev,
                      month: event.target.value,
                    }))
                  }
                  className="input"
                >
                  {MONTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Status</FieldLabel>
                <select
                  value={executionForm.status}
                  onChange={(event) =>
                    setExecutionForm((prev) => ({
                      ...prev,
                      status: event.target.value as ExecutionForm["status"],
                    }))
                  }
                  className="input"
                >
                  {EXECUTION_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Progresso (%)</FieldLabel>
                <input
                  value={executionForm.progress_percent}
                  onChange={(event) =>
                    setExecutionForm((prev) => ({
                      ...prev,
                      progress_percent: event.target.value,
                    }))
                  }
                  className="input"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Porcoes executadas</FieldLabel>
                <input
                  value={executionForm.executed_servings}
                  onChange={(event) =>
                    setExecutionForm((prev) => ({
                      ...prev,
                      executed_servings: event.target.value,
                    }))
                  }
                  className="input"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <FieldLabel>Observacoes da execucao</FieldLabel>
                <textarea
                  value={executionForm.execution_notes}
                  onChange={(event) =>
                    setExecutionForm((prev) => ({
                      ...prev,
                      execution_notes: event.target.value,
                    }))
                  }
                  className="input min-h-[120px]"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <FieldLabel>Desvios encontrados</FieldLabel>
                <textarea
                  value={executionForm.deviation_notes}
                  onChange={(event) =>
                    setExecutionForm((prev) => ({
                      ...prev,
                      deviation_notes: event.target.value,
                    }))
                  }
                  className="input min-h-[120px]"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <FieldLabel>Evidencias (uma por linha)</FieldLabel>
                <textarea
                  value={executionForm.evidence_links}
                  onChange={(event) =>
                    setExecutionForm((prev) => ({
                      ...prev,
                      evidence_links: event.target.value,
                    }))
                  }
                  className="input min-h-[120px]"
                  placeholder="https://...&#10;Ata da reuniao&#10;Relatorio fotografico"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeExecutionModal} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={savingExecution}>
                {savingExecution ? "Salvando..." : "Salvar acompanhamento"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
      {detailPlan ? (
        <ModalShell
          title={
            detailPlan.title ||
            `Plano ${detailPlan.school_name} ${detailPlan.year}`
          }
          subtitle={`${detailPlan.school_name} - ${detailPlan.year}`}
          onClose={() => setDetailPlan(null)}
          maxWidthClass="max-w-7xl"
        >
          <div className="space-y-6 overflow-x-hidden">
            {loadingDetail ? (
              <div className="rounded-2xl bg-primary-50 p-3 text-sm text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
                Atualizando detalhes do plano...
              </div>
            ) : null}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getPlanStatusMeta(detailPlan.status).tone}`}
                  >
                    {getPlanStatusMeta(detailPlan.status).label}
                  </span>
                  {detailPlan.executing_agency ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {detailPlan.executing_agency}
                    </span>
                  ) : null}
                </div>
                {detailPlan.municipality_name ? (
                  <p className="text-sm text-slate-500">
                    Municipio:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {detailPlan.municipality_name}
                    </span>
                  </p>
                ) : null}
                <p className="text-sm text-slate-500">
                  Responsavel tecnico:{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {detailPlan.responsible_nutritionist_name || "Nao definido"}
                  </span>
                </p>
                <p className="text-sm text-slate-500">
                  Criado por {detailPlan.created_by_name || "sistema"} em{" "}
                  {formatDateTime(detailPlan.created_at)}
                </p>
                {detailPlan.approved_at ? (
                  <p className="text-sm text-slate-500">
                    Aprovado em {formatDateTime(detailPlan.approved_at)} por{" "}
                    {detailPlan.approved_by_name || "usuario"}
                  </p>
                ) : null}
                {detailPlan.rejected_at ? (
                  <p className="text-sm text-slate-500">
                    Reprovado em {formatDateTime(detailPlan.rejected_at)} por{" "}
                    {detailPlan.rejected_by_name || "usuario"}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {detailPlan.can_submit ? (
                  <button
                    type="button"
                    onClick={() => handlePlanWorkflow("submit")}
                    className="btn-secondary"
                  >
                    <span className="material-symbols-outlined">send</span>
                    Submeter
                  </button>
                ) : null}
                {detailPlan.can_approve ? (
                  <button
                    type="button"
                    onClick={() => handlePlanWorkflow("approve")}
                    className="btn-secondary"
                  >
                    <span className="material-symbols-outlined">check_circle</span>
                    Aprovar
                  </button>
                ) : null}
                {detailPlan.can_approve ? (
                  <button
                    type="button"
                    onClick={() => handlePlanWorkflow("reject")}
                    className="btn-secondary text-danger-600 dark:text-danger-300"
                  >
                    <span className="material-symbols-outlined">cancel</span>
                    Reprovar
                  </button>
                ) : null}
                {canManagePnae && detailPlan.can_edit ? (
                  <button
                    type="button"
                    onClick={openCreateGoal}
                    className="btn-secondary"
                  >
                    <span className="material-symbols-outlined">flag</span>Nova
                    meta
                  </button>
                ) : null}
                {canManagePnae && detailPlan.can_edit ? (
                  <button
                    type="button"
                    onClick={openCreateAction}
                    className="btn-secondary"
                  >
                    <span className="material-symbols-outlined">task_alt</span>
                    Nova acao
                  </button>
                ) : null}
                {canManagePnae && detailPlan.can_edit ? (
                  <button
                    type="button"
                    onClick={openCreateItem}
                    className="btn-secondary"
                  >
                    <span className="material-symbols-outlined">
                      restaurant_menu
                    </span>
                    Novo item
                  </button>
                ) : null}
              </div>
            </div>
            {detailPlan.last_review_comment ? (
              <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800 dark:border-warning-900/30 dark:bg-warning-900/10 dark:text-warning-200">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined">rate_review</span>
                  <div>
                    <p className="font-semibold">Ultimo parecer</p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {detailPlan.last_review_comment}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Metas"
                value={detailPlan.goals.length}
                icon="flag"
              />
              <StatCard
                label="Acoes"
                value={detailPlan.actions.length}
                icon="task_alt"
              />
              <StatCard
                label="Itens"
                value={detailPlan.items.length}
                icon="restaurant_menu"
              />
              <StatCard
                label="Instrumentos"
                value={detailPlan.evaluation_tools.length}
                icon="fact_check"
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Justificativa
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {detailPlan.justification || "Nao informada."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Diagnostico nutricional
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {detailPlan.diagnosis_summary || "Nao informado."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Objetivos gerais
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {detailPlan.general_objectives || "Nao informado."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Estrategia operacional
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {detailPlan.operational_strategy || "Nao informada."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Locais de execucao
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {detailPlan.execution_locations || "Nao informado."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Cronograma financeiro e observacoes
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {detailPlan.financial_schedule_notes ||
                    "Sem cronograma financeiro registrado."}
                </p>
                {detailPlan.notes ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-500 dark:text-slate-400">
                    {detailPlan.notes}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
              <div className="space-y-4 rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Integracao operacional
                    </h3>
                    <p className="text-sm text-slate-500">
                      Projecao de cardapio, compras e estoque a partir do plano.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={selectedOperationalMonth}
                      onChange={(event) =>
                        setSelectedOperationalMonth(event.target.value)
                      }
                      className="input min-w-[180px]"
                    >
                      {MONTH_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {canManagePnae && detailPlan.status === "APPROVED" ? (
                      <button
                        type="button"
                        onClick={handleGenerateMenuDrafts}
                        className="btn-secondary"
                      >
                        <span className="material-symbols-outlined">
                          edit_calendar
                        </span>
                        Gerar cardapio
                      </button>
                    ) : null}
                    {canManagePnae && detailPlan.status === "APPROVED" ? (
                      <button
                        type="button"
                        onClick={handleGenerateDeliveryDraft}
                        className="btn-secondary"
                      >
                        <span className="material-symbols-outlined">
                          local_shipping
                        </span>
                        Gerar entrega
                      </button>
                    ) : null}
                  </div>
                </div>

                {loadingOperational ? (
                  <div className="rounded-2xl bg-primary-50 p-3 text-sm text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
                    Carregando projecao operacional...
                  </div>
                ) : operationalSummary ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <StatCard
                        label="Porcoes projetadas"
                        value={operationalSummary.detail.summary.projected_servings}
                        icon="restaurant"
                      />
                      <StatCard
                        label="Ocorrencias"
                        value={operationalSummary.detail.summary.projected_occurrences}
                        icon="calendar_month"
                      />
                      <StatCard
                        label="Faltas na escola"
                        value={operationalSummary.detail.summary.supplies_with_shortage}
                        icon="inventory_2"
                      />
                      <StatCard
                        label="Custo estimado"
                        value={formatCurrency(
                          operationalSummary.detail.summary.estimated_cost,
                        )}
                        icon="payments"
                      />
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                      {operationalSummary.monthly_overview.map((item) => (
                        <button
                          key={item.month}
                          type="button"
                          onClick={() =>
                            setSelectedOperationalMonth(String(item.month))
                          }
                          className={`rounded-2xl border p-4 text-left transition ${
                            String(item.month) === selectedOperationalMonth
                              ? "border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20"
                              : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                          }`}
                        >
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {item.month_label}
                          </p>
                          <p className="mt-2 text-sm text-slate-500">
                            {item.projected_servings} porcoes projetadas
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.supplies_with_shortage} faltas de estoque
                          </p>
                        </button>
                      ))}
                    </div>

                    {operationalSummary.detail.warnings?.length ? (
                      <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800 dark:border-warning-900/30 dark:bg-warning-900/10 dark:text-warning-200">
                        <p className="font-semibold">Alertas da projecao</p>
                        <div className="mt-2 space-y-2">
                          {operationalSummary.detail.warnings.map((warning) => (
                            <p key={warning}>{warning}</p>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                          Compras e estoque
                        </h4>
                        {operationalSummary.detail.procurement.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-500">
                            Nenhum insumo projetado para este mes.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {operationalSummary.detail.procurement
                              .slice(0, 8)
                              .map((item) => (
                                <div
                                  key={`${item.supply_id}-${item.unit}`}
                                  className="rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-700"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-slate-900 dark:text-white">
                                        {item.supply_name}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        Necessario: {item.qty_needed} {item.unit}
                                      </p>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500">
                                      {formatCurrency(item.estimated_cost)}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                                    <span>Escola: {item.school_stock_available}</span>
                                    <span>Central: {item.central_stock_available}</span>
                                    <span>Falta: {item.school_shortage}</span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                          Projecao de cardapio
                        </h4>
                        {operationalSummary.detail.menu_projection.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-500">
                            Nenhuma data projetada para este mes.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {operationalSummary.detail.menu_projection
                              .slice(0, 8)
                              .map((entry) => (
                                <div
                                  key={`${entry.plan_item_id}-${entry.date}-${entry.meal_type}`}
                                  className="rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-700"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-slate-900 dark:text-white">
                                        {formatDate(entry.date)} • {entry.meal_type_display}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {entry.recipe_name || "Sem receita"}
                                      </p>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500">
                                      {entry.servings_planned} porcoes
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs text-slate-500">
                                    {entry.education_stage_name} •{" "}
                                    {entry.education_modality_name}
                                  </p>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Execucao mensal
                      </h3>
                      <p className="text-sm text-slate-500">
                        Andamento, evidencias e desvios.
                      </p>
                    </div>
                    {canManagePnae && detailPlan.status === "APPROVED" ? (
                      <button
                        type="button"
                        onClick={() =>
                          openCreateExecution(
                            Number(
                              selectedOperationalMonth ||
                                detailPlan.items?.[0]?.month ||
                                1,
                            ),
                          )
                        }
                        className="btn-secondary"
                      >
                        <span className="material-symbols-outlined">add</span>
                        Atualizar
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    {detailPlan.monthly_executions?.length ? (
                      detailPlan.monthly_executions.map((execution) => (
                        <div
                          key={execution.id}
                          className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {
                                  MONTH_OPTIONS.find(
                                    (option) =>
                                      Number(option.value) === execution.month,
                                  )?.label
                                }
                              </p>
                              <p className="text-xs text-slate-500">
                                {execution.status_display || execution.status}
                              </p>
                            </div>
                            {canManagePnae &&
                            detailPlan.status === "APPROVED" ? (
                              <button
                                type="button"
                                onClick={() => openEditExecution(execution)}
                                className="btn-secondary"
                              >
                                <span className="material-symbols-outlined">
                                  edit
                                </span>
                                Editar
                              </button>
                            ) : null}
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-2 rounded-full bg-primary-500"
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(100, execution.progress_percent || 0),
                                )}%`,
                              }}
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span>Planejado: {execution.planned_servings}</span>
                            <span>Executado: {execution.executed_servings}</span>
                            <span>Progresso: {execution.progress_percent}%</span>
                          </div>
                          {execution.execution_notes ? (
                            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                              {execution.execution_notes}
                            </p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
                        Nenhum acompanhamento mensal registrado.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Workflow e historico
                  </h3>
                  <div className="mt-4 space-y-3">
                    {detailPlan.workflow_events?.length ? (
                      detailPlan.workflow_events.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {event.action_display || event.action}
                              </p>
                              <p className="text-xs text-slate-500">
                                {event.actor_name || "Sistema"} •{" "}
                                {formatDateTime(event.created_at)}
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {event.to_status_display || event.to_status}
                            </span>
                          </div>
                          {event.comment ? (
                            <p className="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                              {event.comment}
                            </p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
                        Nenhum evento de workflow registrado.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Metas
                  </h3>
                  <p className="text-sm text-slate-500">
                    Indicadores e prazos para o ano letivo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateGoal}
                  className="btn-secondary"
                >
                  <span className="material-symbols-outlined">add</span>Nova
                  meta
                </button>
              </div>
              {detailPlan.goals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  Nenhuma meta registrada.
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {detailPlan.goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {goal.title}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                            {goal.indicator ? (
                              <span>Indicador: {goal.indicator}</span>
                            ) : null}
                            {goal.due_date ? (
                              <span>Prazo: {formatDate(goal.due_date)}</span>
                            ) : null}
                            <span>Ordem: {goal.order ?? 0}</span>
                          </div>
                        </div>
                      </div>
                      {goal.description ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                          {goal.description}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>Alvo: {goal.target_value ?? "-"}</span>
                        <span>Atual: {goal.current_value ?? "-"}</span>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          onClick={() => openEditGoal(goal)}
                          className="btn-secondary flex-1"
                        >
                          <span className="material-symbols-outlined">
                            edit
                          </span>
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(goal)}
                          className="btn-secondary flex-1 text-danger-600 dark:text-danger-300"
                        >
                          <span className="material-symbols-outlined">
                            delete
                          </span>
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Acoes
                  </h3>
                  <p className="text-sm text-slate-500">
                    Execucao operacional do planejamento.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateAction}
                  className="btn-secondary"
                >
                  <span className="material-symbols-outlined">add</span>Nova
                  acao
                </button>
              </div>
              {detailPlan.actions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  Nenhuma acao registrada.
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {detailPlan.actions.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {action.title}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                            {action.responsible_sector ? (
                              <span>{action.responsible_sector}</span>
                            ) : null}
                            {action.start_date ? (
                              <span>
                                Inicio: {formatDate(action.start_date)}
                              </span>
                            ) : null}
                            {action.end_date ? (
                              <span>Fim: {formatDate(action.end_date)}</span>
                            ) : null}
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {ACTION_STATUS_OPTIONS.find(
                            (option) => option.value === action.status,
                          )?.label || action.status}
                        </span>
                      </div>
                      {action.description ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                          {action.description}
                        </p>
                      ) : null}
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          onClick={() => openEditAction(action)}
                          className="btn-secondary flex-1"
                        >
                          <span className="material-symbols-outlined">
                            edit
                          </span>
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteAction(action)}
                          className="btn-secondary flex-1 text-danger-600 dark:text-danger-300"
                        >
                          <span className="material-symbols-outlined">
                            delete
                          </span>
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Itens do plano
                  </h3>
                  <p className="text-sm text-slate-500">
                    Distribuicao mensal por etapa, modalidade e refeicao.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateItem}
                  className="btn-secondary"
                >
                  <span className="material-symbols-outlined">add</span>Novo
                  item
                </button>
              </div>
              {detailPlan.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  Nenhum item registrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {detailPlan.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
                              {MONTH_OPTIONS.find(
                                (option) => option.value === String(item.month),
                              )?.label || `Mes ${item.month}`}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {getMealTypeLabel(item.meal_type)}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {item.education_stage_name} -{" "}
                            {item.education_modality_name}
                          </p>
                          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                            <span>
                              Receita: {item.recipe_name || "Nao vinculada"}
                            </span>
                            <span>Porcoes: {item.servings_planned}</span>
                            <span>
                              Frequencia semanal: {item.weekly_frequency}
                            </span>
                          </div>
                          {item.notes ? (
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                              {item.notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            onClick={() => openEditItem(item)}
                            className="btn-secondary"
                          >
                            <span className="material-symbols-outlined">
                              edit
                            </span>
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="btn-secondary text-danger-600 dark:text-danger-300"
                          >
                            <span className="material-symbols-outlined">
                              delete
                            </span>
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Cronograma mensal
                </h3>
                <div className="mt-3 space-y-3">
                  {detailPlan.schedule_entries.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Sem entradas registradas.
                    </p>
                  ) : (
                    detailPlan.schedule_entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/70"
                      >
                        <p className="font-medium text-slate-900 dark:text-white">
                          {MONTH_OPTIONS.find(
                            (option) => option.value === String(entry.month),
                          )?.label || `Mes ${entry.month}`}
                        </p>
                        <p className="mt-1 text-slate-600 dark:text-slate-300">
                          {entry.activity}
                        </p>
                        {entry.expected_result ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Resultado esperado: {entry.expected_result}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Orcamento
                </h3>
                <div className="mt-3 space-y-3">
                  {detailPlan.budget_items.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Sem itens orcamentarios registrados.
                    </p>
                  ) : (
                    detailPlan.budget_items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/70"
                      >
                        <p className="font-medium text-slate-900 dark:text-white">
                          {item.category}
                        </p>
                        {item.description ? (
                          <p className="mt-1 text-slate-600 dark:text-slate-300">
                            {item.description}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>
                            Estimado: {formatCurrency(item.estimated_amount)}
                          </span>
                          <span>
                            Executado: {formatCurrency(item.executed_amount)}
                          </span>
                          {item.funding_source ? (
                            <span>Fonte: {item.funding_source}</span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Instrumentos avaliativos
                </h3>
                <div className="mt-3 space-y-3">
                  {detailPlan.evaluation_tools.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Sem instrumentos registrados.
                    </p>
                  ) : (
                    detailPlan.evaluation_tools.map((tool) => (
                      <div
                        key={tool.id}
                        className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/70"
                      >
                        <p className="font-medium text-slate-900 dark:text-white">
                          {tool.name}
                        </p>
                        {tool.description ? (
                          <p className="mt-1 text-slate-600 dark:text-slate-300">
                            {tool.description}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                          {tool.frequency ? (
                            <span>Frequencia: {tool.frequency}</span>
                          ) : null}
                          {tool.target_audience ? (
                            <span>Publico: {tool.target_audience}</span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Cronograma mensal
                  </h3>
                  <p className="text-sm text-slate-500">
                    Atividades previstas, por mes, com resultado esperado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateScheduleEntry}
                  className="btn-secondary"
                >
                  <span className="material-symbols-outlined">add</span>Novo
                  cronograma
                </button>
              </div>
              {detailPlan.schedule_entries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  Sem entradas de cronograma.
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {detailPlan.schedule_entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {MONTH_OPTIONS.find(
                              (option) => option.value === String(entry.month),
                            )?.label || `Mes ${entry.month}`}
                          </p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {entry.activity}
                          </p>
                          {entry.expected_result ? (
                            <p className="mt-2 text-xs text-slate-500">
                              Resultado esperado: {entry.expected_result}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            onClick={() => openEditScheduleEntry(entry)}
                            className="btn-secondary"
                          >
                            <span className="material-symbols-outlined">
                              edit
                            </span>
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteScheduleEntry(entry)}
                            className="btn-secondary text-danger-600 dark:text-danger-300"
                          >
                            <span className="material-symbols-outlined">
                              delete
                            </span>
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Orcamento
                  </h3>
                  <p className="text-sm text-slate-500">
                    Categorias, fontes e valores da execucao do plano.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateBudgetItem}
                  className="btn-secondary"
                >
                  <span className="material-symbols-outlined">add</span>Novo
                  item orcamentario
                </button>
              </div>
              {detailPlan.budget_items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  Sem itens orcamentarios.
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {detailPlan.budget_items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.category}
                          </p>
                          {item.description ? (
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                              {item.description}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span>
                              Estimado: {formatCurrency(item.estimated_amount)}
                            </span>
                            <span>
                              Executado: {formatCurrency(item.executed_amount)}
                            </span>
                            {item.funding_source ? (
                              <span>Fonte: {item.funding_source}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            onClick={() => openEditBudgetItem(item)}
                            className="btn-secondary"
                          >
                            <span className="material-symbols-outlined">
                              edit
                            </span>
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteBudgetItem(item)}
                            className="btn-secondary text-danger-600 dark:text-danger-300"
                          >
                            <span className="material-symbols-outlined">
                              delete
                            </span>
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Instrumentos avaliativos
                  </h3>
                  <p className="text-sm text-slate-500">
                    Ferramentas de acompanhamento e avaliacao do plano.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateEvaluationTool}
                  className="btn-secondary"
                >
                  <span className="material-symbols-outlined">add</span>Novo
                  instrumento
                </button>
              </div>
              {detailPlan.evaluation_tools.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  Sem instrumentos avaliativos.
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {detailPlan.evaluation_tools.map((tool) => (
                    <div
                      key={tool.id}
                      className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {tool.name}
                          </p>
                          {tool.description ? (
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                              {tool.description}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                            {tool.frequency ? (
                              <span>Frequencia: {tool.frequency}</span>
                            ) : null}
                            {tool.target_audience ? (
                              <span>Publico: {tool.target_audience}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            onClick={() => openEditEvaluationTool(tool)}
                            className="btn-secondary"
                          >
                            <span className="material-symbols-outlined">
                              edit
                            </span>
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteEvaluationTool(tool)}
                            className="btn-secondary text-danger-600 dark:text-danger-300"
                          >
                            <span className="material-symbols-outlined">
                              delete
                            </span>
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDetailPlan(null)}
                className="btn-secondary"
              >
                <span className="material-symbols-outlined">close</span>Fechar
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {loadingDetail && !detailPlan ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-xl dark:bg-slate-100 dark:text-slate-900">
          Carregando detalhes do plano...
        </div>
      ) : null}
    </div>
  );
};

export default PnaePlanning;
