from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from accounts.views import MeView
from merenda_semed.views import DashboardView, DashboardSeriesView
from schools.views import SchoolViewSet
from inventory.views import (
    DeliveryViewSet,
    NotificationViewSet,
    ResponsibleViewSet,
    SchoolStockConfigViewSet,
    SupplierReceiptViewSet,
    SupplierReceiptExportPdfView,
    SupplierViewSet,
    SupplyViewSet,
    StockViewSet,
    StockMovementViewSet,
    StockExportCsvView,
    StockExportPdfView,
    StockExportXlsxView,
    DeliveryExportPdfView,
    DeliveryExportXlsxView,
    ConsumptionExportPdfView,
    ConsumptionExportXlsxView,
)
from menus.views import MenuViewSet, MenuExportCsvView, MenuExportPdfView
from public.views import PublicConsumptionView, PublicDeliveryCurrentView, PublicMenuByWeekView, PublicMenuCurrentView, PublicSchoolDetailView, PublicSchoolListView

router = DefaultRouter()
router.register(r'schools', SchoolViewSet, basename='school')
router.register(r'supplies', SupplyViewSet, basename='supply')
router.register(r'stock/movements', StockMovementViewSet, basename='stock-movement')
router.register(r'stock', StockViewSet, basename='stock')
router.register(r'responsibles', ResponsibleViewSet, basename='responsible')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'supplier-receipts', SupplierReceiptViewSet, basename='supplier-receipt')
router.register(r'deliveries', DeliveryViewSet, basename='delivery')
router.register(r'menus', MenuViewSet, basename='menu')
router.register(r'exports/stock', StockExportCsvView, basename='export-stock')
router.register(r'exports/stock/pdf', StockExportPdfView, basename='export-stock-pdf')
router.register(r'exports/stock/xlsx', StockExportXlsxView, basename='export-stock-xlsx')
router.register(r'exports/menus', MenuExportCsvView, basename='export-menus')
router.register(r'exports/menus/pdf', MenuExportPdfView, basename='export-menus-pdf')
router.register(r'exports/deliveries/pdf', DeliveryExportPdfView, basename='export-deliveries-pdf')
router.register(r'exports/deliveries/xlsx', DeliveryExportXlsxView, basename='export-deliveries-xlsx')
router.register(r'exports/consumption/pdf', ConsumptionExportPdfView, basename='export-consumption-pdf')
router.register(r'exports/consumption/xlsx', ConsumptionExportXlsxView, basename='export-consumption-xlsx')
router.register(r'exports/supplier-receipts/pdf', SupplierReceiptExportPdfView, basename='export-supplier-receipts-pdf')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'school-stock-config', SchoolStockConfigViewSet, basename='school-stock-config')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api-auth/', include('rest_framework.urls')),
    path('api/dashboard/', DashboardView.as_view(), name='dashboard'),
    path('api/dashboard/series/', DashboardSeriesView.as_view(), name='dashboard-series'),
    path('api/auth/me/', MeView.as_view(), name='auth-me'),
    path('api/auth/', include('accounts.urls')),
    path('api/', include(router.urls)),
    path('public/schools/<slug:slug>/', PublicSchoolDetailView.as_view(), name='public-school-detail'),
    path('public/schools/', PublicSchoolListView.as_view(), name='public-school-list'),
    path('public/schools/<slug:slug>/menu/current/', PublicMenuCurrentView.as_view(), name='public-menu-current'),
    path('public/schools/<slug:slug>/menu/', PublicMenuByWeekView.as_view(), name='public-menu-by-week'),
    path('public/schools/<slug:slug>/delivery/current/', PublicDeliveryCurrentView.as_view(), name='public-delivery-current'),
    path('public/schools/<slug:slug>/consumption/', PublicConsumptionView.as_view(), name='public-consumption'),
    re_path(r'^(?!api/|admin/|api-auth/|public/|static/).*$',
            TemplateView.as_view(template_name='index.html'),
            name='spa'),
]
