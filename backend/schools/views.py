from datetime import date

from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.permissions import IsPnaeManager, scope_queryset_by_municipality
from inventory.models import SchoolStockBalance
from inventory.serializers import PublicConsumptionInputSerializer, SchoolStockBalanceSerializer

from .models import EducationModality, EducationStage, Municipality, School, generate_token
from .operations import MealServiceInputSerializer, apply_school_consumption, get_meal_service_payload, save_meal_service_report
from .serializers import (
    EducationModalitySerializer,
    EducationStageSerializer,
    MunicipalitySerializer,
    SchoolSerializer,
)


class MunicipalityViewSet(viewsets.ModelViewSet):
    queryset = Municipality.objects.all().order_by('name', 'state')
    serializer_class = MunicipalitySerializer
    permission_classes = [permissions.IsAuthenticated, IsPnaeManager]

    def get_queryset(self):
        queryset = super().get_queryset()
        queryset = scope_queryset_by_municipality(queryset, self.request.user)
        query = self.request.query_params.get('q')
        is_active = self.request.query_params.get('is_active')
        if query:
            queryset = queryset.filter(name__icontains=query)
        if is_active in ['true', 'false']:
            queryset = queryset.filter(is_active=is_active == 'true')
        return queryset


class EducationModalityViewSet(viewsets.ModelViewSet):
    queryset = EducationModality.objects.all().order_by('name')
    serializer_class = EducationModalitySerializer
    permission_classes = [permissions.IsAuthenticated, IsPnaeManager]

    def get_queryset(self):
        queryset = super().get_queryset()
        query = self.request.query_params.get('q')
        is_active = self.request.query_params.get('is_active')
        if query:
            queryset = queryset.filter(name__icontains=query)
        if is_active in ['true', 'false']:
            queryset = queryset.filter(is_active=is_active == 'true')
        return queryset


class EducationStageViewSet(viewsets.ModelViewSet):
    queryset = EducationStage.objects.all().order_by('name')
    serializer_class = EducationStageSerializer
    permission_classes = [permissions.IsAuthenticated, IsPnaeManager]

    def get_queryset(self):
        queryset = super().get_queryset()
        query = self.request.query_params.get('q')
        is_active = self.request.query_params.get('is_active')
        if query:
            queryset = queryset.filter(name__icontains=query)
        if is_active in ['true', 'false']:
            queryset = queryset.filter(is_active=is_active == 'true')
        return queryset


class SchoolViewSet(viewsets.ModelViewSet):
    queryset = School.objects.select_related('municipality').prefetch_related(
        'education_stages', 'education_modalities',
    ).order_by('name')
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        queryset = scope_queryset_by_municipality(queryset, self.request.user)
        query = self.request.query_params.get('q')
        city = self.request.query_params.get('city')
        address = self.request.query_params.get('address')
        municipality = self.request.query_params.get('municipality')
        is_active = self.request.query_params.get('is_active')
        education_stage = self.request.query_params.get('education_stage')
        education_modality = self.request.query_params.get('education_modality')
        if query:
            queryset = queryset.filter(name__icontains=query)
        if city:
            queryset = queryset.filter(city__icontains=city)
        if address:
            queryset = queryset.filter(address__icontains=address)
        if municipality:
            queryset = queryset.filter(municipality_id=municipality)
        if education_stage:
            queryset = queryset.filter(education_stages__id=education_stage)
        if education_modality:
            queryset = queryset.filter(education_modalities__id=education_modality)
        if is_active in ['true', 'false']:
            queryset = queryset.filter(is_active=is_active == 'true')
        return queryset.distinct()

    @action(detail=True, methods=['post'])
    def regenerate_link(self, request, pk=None):
        school = self.get_object()
        school.public_token = generate_token()
        school.save()
        serializer = self.get_serializer(school)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def public_link(self, request, pk=None):
        school = self.get_object()
        return Response({
            'slug': school.public_slug,
            'token': school.public_token,
            'url': f"/public/schools/{school.public_slug}/menu/current/?token={school.public_token}",
            'consumption_url': f"/public/schools/{school.public_slug}/consumption/?token={school.public_token}",
            'consumption_page_url': f"/public/meal-service?slug={school.public_slug}&token={school.public_token}",
            'meal_service_url': f"/public/schools/{school.public_slug}/meal-service/?token={school.public_token}",
            'meal_service_page_url': f"/public/meal-service?slug={school.public_slug}&token={school.public_token}",
        })

    @action(detail=True, methods=['get'])
    def stock(self, request, pk=None):
        school = self.get_object()
        balances = SchoolStockBalance.objects.select_related('supply').filter(
            school=school,
        ).order_by('supply__category', 'supply__name')
        total = balances.count()
        low_stock = sum(
            1 for balance in balances
            if balance.quantity < (balance.min_stock if balance.min_stock > 0 else balance.supply.min_stock)
        )

        serializer = SchoolStockBalanceSerializer(balances, many=True)
        return Response({
            'school': {
                'id': str(school.id),
                'name': school.name,
                'municipality_name': school.municipality.name if school.municipality else '',
            },
            'summary': {
                'total_items': total,
                'low_stock': low_stock,
                'normal_stock': total - low_stock,
            },
            'items': serializer.data,
        })

    @action(detail=True, methods=['get', 'post'], url_path='consumption')
    def consumption(self, request, pk=None):
        school = self.get_object()

        if request.method == 'GET':
            balances = SchoolStockBalance.objects.select_related('supply').filter(
                school=school,
                quantity__gt=0,
                supply__is_active=True,
            ).order_by('supply__category', 'supply__name')
            total = balances.count()
            low_stock = sum(
                1 for balance in balances
                if balance.quantity < (balance.min_stock if balance.min_stock > 0 else balance.supply.min_stock)
            )

            serializer = SchoolStockBalanceSerializer(balances, many=True)
            return Response({
                'school': {
                    'id': str(school.id),
                    'name': school.name,
                    'municipality_name': school.municipality.name if school.municipality else '',
                },
                'summary': {
                    'available_items': total,
                    'low_stock': low_stock,
                    'normal_stock': total - low_stock,
                },
                'items': serializer.data,
            })

        serializer = PublicConsumptionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = apply_school_consumption(
            school,
            serializer.validated_data['items'],
            created_by_id=request.user.id,
        )
        return Response(result)

    @action(detail=True, methods=['get', 'post'], url_path='meal-service')
    def meal_service(self, request, pk=None):
        school = self.get_object()

        if request.method == 'GET':
            raw_date = request.query_params.get('date')
            try:
                service_date = date.fromisoformat(raw_date) if raw_date else date.today()
            except ValueError:
                raise PermissionDenied('Data invalida. Use o formato YYYY-MM-DD.')
            return Response(get_meal_service_payload(school, service_date))

        serializer = MealServiceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report, total_served = save_meal_service_report(
            school,
            serializer.validated_data['service_date'],
            serializer.validated_data['items'],
        )
        return Response({
            'detail': 'Refeicoes servidas registradas com sucesso.',
            'report_id': str(report.id),
            'total_served': total_served,
        })
