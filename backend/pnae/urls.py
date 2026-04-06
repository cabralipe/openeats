from rest_framework.routers import DefaultRouter

from .acceptance import PnaeAcceptanceSuiteViewSet
from .views import (
    PnaeAnnualActionViewSet,
    PnaeAnnualBudgetItemViewSet,
    PnaeAnnualEvaluationToolViewSet,
    PnaeAnnualGoalViewSet,
    PnaeAnnualPlanItemViewSet,
    PnaeAnnualPlanMonthlyExecutionViewSet,
    PnaeAnnualPlanViewSet,
    PnaeAnnualScheduleEntryViewSet,
)

router = DefaultRouter()
router.register(r'plans', PnaeAnnualPlanViewSet, basename='pnae-annual-plan')
router.register(r'acceptance-tests', PnaeAcceptanceSuiteViewSet, basename='pnae-acceptance-tests')
router.register(r'plan-items', PnaeAnnualPlanItemViewSet, basename='pnae-annual-plan-item')
router.register(r'plan-goals', PnaeAnnualGoalViewSet, basename='pnae-annual-goal')
router.register(r'plan-actions', PnaeAnnualActionViewSet, basename='pnae-annual-action')
router.register(r'plan-schedule-entries', PnaeAnnualScheduleEntryViewSet, basename='pnae-annual-schedule-entry')
router.register(r'plan-budget-items', PnaeAnnualBudgetItemViewSet, basename='pnae-annual-budget-item')
router.register(r'plan-evaluation-tools', PnaeAnnualEvaluationToolViewSet, basename='pnae-annual-evaluation-tool')
router.register(r'plan-monthly-executions', PnaeAnnualPlanMonthlyExecutionViewSet, basename='pnae-annual-plan-monthly-execution')

urlpatterns = router.urls
