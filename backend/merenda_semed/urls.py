from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from accounts.views import MeView
from merenda_semed.views import DashboardView, DashboardSeriesView
from schools.views import SchoolViewSet
from inventory.views import (
    DeliveryViewSet,
    SupplyViewSet,
    StockViewSet,
    StockMovementViewSet,
    StockExportCsvView,
    DeliveryExportPdfView,
    DeliveryExportXlsxView,
    ConsumptionExportPdfView,
    ConsumptionExportXlsxView,
)
from menus.views import MenuViewSet, MenuExportCsvView, MenuExportPdfView
from public.views import PublicConsumptionView, PublicDeliveryCurrentView, PublicMenuByWeekView, PublicMenuCurrentView, PublicSchoolDetailView

router = DefaultRouter()
router.register(r'schools', SchoolViewSet, basename='school')
router.register(r'supplies', SupplyViewSet, basename='supply')
router.register(r'stock/movements', StockMovementViewSet, basename='stock-movement')
router.register(r'stock', StockViewSet, basename='stock')
router.register(r'deliveries', DeliveryViewSet, basename='delivery')
router.register(r'menus', MenuViewSet, basename='menu')
router.register(r'exports/stock', StockExportCsvView, basename='export-stock')
router.register(r'exports/menus', MenuExportCsvView, basename='export-menus')
router.register(r'exports/menus/pdf', MenuExportPdfView, basename='export-menus-pdf')
router.register(r'exports/deliveries/pdf', DeliveryExportPdfView, basename='export-deliveries-pdf')
router.register(r'exports/deliveries/xlsx', DeliveryExportXlsxView, basename='export-deliveries-xlsx')
router.register(r'exports/consumption/pdf', ConsumptionExportPdfView, basename='export-consumption-pdf')
router.register(r'exports/consumption/xlsx', ConsumptionExportXlsxView, basename='export-consumption-xlsx')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/dashboard/', DashboardView.as_view(), name='dashboard'),
    path('api/dashboard/series/', DashboardSeriesView.as_view(), name='dashboard-series'),
    path('api/auth/me/', MeView.as_view(), name='auth-me'),
    path('api/auth/', include('accounts.urls')),
    path('api/', include(router.urls)),
    path('public/schools/<slug:slug>/', PublicSchoolDetailView.as_view(), name='public-school-detail'),
    path('public/schools/<slug:slug>/menu/current/', PublicMenuCurrentView.as_view(), name='public-menu-current'),
    path('public/schools/<slug:slug>/menu/', PublicMenuByWeekView.as_view(), name='public-menu-by-week'),
    path('public/schools/<slug:slug>/delivery/current/', PublicDeliveryCurrentView.as_view(), name='public-delivery-current'),
    path('public/schools/<slug:slug>/consumption/', PublicConsumptionView.as_view(), name='public-consumption'),
]
