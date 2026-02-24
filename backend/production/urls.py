from rest_framework.routers import DefaultRouter

from .views import PublicCalculatorLinkViewSet, SupplyAliasViewSet, SupplyConsumptionRuleViewSet

router = DefaultRouter()
router.register(r'aliases', SupplyAliasViewSet, basename='production-alias')
router.register(r'rules', SupplyConsumptionRuleViewSet, basename='production-rule')
router.register(r'public-links', PublicCalculatorLinkViewSet, basename='production-public-link')

urlpatterns = router.urls

