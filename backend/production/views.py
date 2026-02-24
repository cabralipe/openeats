from datetime import date

from django.shortcuts import get_object_or_404
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSemedAdmin
from menus.models import Menu
from production.services.production_calc import calculate_for_menu

from .models import PublicCalculatorLink, SupplyAlias, SupplyConsumptionRule
from .serializers import (
    MenuProductionCalculateSerializer,
    PublicCalculatorCalculateSerializer,
    PublicCalculatorLinkSerializer,
    SupplyAliasSerializer,
    SupplyConsumptionRuleSerializer,
)


class SupplyAliasViewSet(viewsets.ModelViewSet):
    queryset = SupplyAlias.objects.select_related('supply').all().order_by('alias')
    serializer_class = SupplyAliasSerializer
    permission_classes = [permissions.IsAuthenticated, IsSemedAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        q = (self.request.query_params.get('q') or '').strip()
        supply = self.request.query_params.get('supply')
        if q:
            queryset = queryset.filter(alias__icontains=q)
        if supply:
            queryset = queryset.filter(supply_id=supply)
        return queryset


class SupplyConsumptionRuleViewSet(viewsets.ModelViewSet):
    queryset = SupplyConsumptionRule.objects.select_related('school', 'supply').all()
    serializer_class = SupplyConsumptionRuleSerializer
    permission_classes = [permissions.IsAuthenticated, IsSemedAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        for field in ['school', 'supply', 'meal_type']:
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        return queryset


class PublicCalculatorLinkViewSet(viewsets.ModelViewSet):
    queryset = PublicCalculatorLink.objects.select_related('school').all()
    serializer_class = PublicCalculatorLinkSerializer
    permission_classes = [permissions.IsAuthenticated, IsSemedAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        school = self.request.query_params.get('school')
        is_active = self.request.query_params.get('is_active')
        if school:
            queryset = queryset.filter(school_id=school)
        if is_active in ['true', 'false']:
            queryset = queryset.filter(is_active=(is_active == 'true'))
        return queryset


class PublicCalculatorMetaView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        link = get_object_or_404(PublicCalculatorLink.objects.select_related('school'), token=token)
        if not link.is_active:
            raise PermissionDenied('Token inativo.')

        today = date.today()
        menu = (
            Menu.objects.filter(
                school=link.school,
                status=Menu.Status.PUBLISHED,
                week_start__lte=today,
                week_end__gte=today,
            )
            .order_by('-week_start')
            .first()
        ) or Menu.objects.filter(school=link.school, status=Menu.Status.PUBLISHED).order_by('-week_start').first()

        current_menu = None
        if menu:
            current_menu = {
                'id': str(menu.id),
                'week_start': menu.week_start.isoformat(),
                'week_end': menu.week_end.isoformat(),
                'name': menu.name or '',
                'status': menu.status,
            }
        return Response({
            'school': {'id': str(link.school_id), 'name': link.school.name},
            'allowed_scope': link.allowed_scope,
            'is_active': link.is_active,
            'current_published_menu': current_menu,
        })


class PublicCalculatorCalculateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, token):
        link = get_object_or_404(PublicCalculatorLink.objects.select_related('school'), token=token)
        if not link.is_active:
            raise PermissionDenied('Token inativo.')

        serializer = PublicCalculatorCalculateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        menu = get_object_or_404(
            Menu.objects.prefetch_related('items'),
            school=link.school,
            status=Menu.Status.PUBLISHED,
            week_start=payload['week_start'],
        )

        result = calculate_for_menu(
            menu=menu,
            students_by_meal_type=payload.get('students_by_meal_type') or {},
            waste_percent=payload.get('waste_percent') or 0,
            include_stock=payload.get('include_stock', True),
            rounding=payload.get('rounding') or {'mode': 'NEAREST', 'decimals': 2},
        )
        return Response(result)
