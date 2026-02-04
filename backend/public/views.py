from datetime import date

from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from inventory.models import Delivery
from inventory.serializers import DeliveryConferenceInputSerializer, PublicDeliverySerializer
from menus.models import Menu
from menus.serializers import MenuSerializer
from schools.models import School
from schools.serializers import SchoolPublicSerializer


class PublicBaseView(APIView):
    permission_classes = [permissions.AllowAny]

    def _validate_token(self, school, token):
        if not token or token != school.public_token:
            raise PermissionDenied('Token invalido.')


class PublicSchoolDetailView(PublicBaseView):
    def get(self, request, slug):
        school = get_object_or_404(School, public_slug=slug)
        token = request.query_params.get('token')
        self._validate_token(school, token)
        return Response(SchoolPublicSerializer(school).data)


class PublicMenuCurrentView(PublicBaseView):
    def get(self, request, slug):
        school = get_object_or_404(School, public_slug=slug)
        token = request.query_params.get('token')
        self._validate_token(school, token)
        today = date.today()
        menu = get_object_or_404(
            Menu.objects.prefetch_related('items'),
            school=school,
            status=Menu.Status.PUBLISHED,
            week_start__lte=today,
            week_end__gte=today,
        )
        return Response(MenuSerializer(menu).data)


class PublicMenuByWeekView(PublicBaseView):
    def get(self, request, slug):
        school = get_object_or_404(School, public_slug=slug)
        token = request.query_params.get('token')
        self._validate_token(school, token)
        week_start = request.query_params.get('week_start')
        if not week_start:
            raise PermissionDenied('week_start obrigatorio.')
        menu = get_object_or_404(
            Menu.objects.prefetch_related('items'),
            school=school,
            status=Menu.Status.PUBLISHED,
            week_start=week_start,
        )
        return Response(MenuSerializer(menu).data)


class PublicDeliveryCurrentView(PublicBaseView):
    def _get_delivery(self, school, delivery_id=None):
        queryset = Delivery.objects.prefetch_related('items__supply').filter(
            school=school,
            conference_enabled=True,
        )
        if delivery_id:
            return get_object_or_404(queryset, id=delivery_id)
        delivery = queryset.order_by('-sent_at', '-created_at').first()
        if not delivery:
            raise PermissionDenied('Nenhuma entrega habilitada para conferencia.')
        return delivery

    def get(self, request, slug):
        school = get_object_or_404(School, public_slug=slug)
        token = request.query_params.get('token')
        delivery_id = request.query_params.get('delivery_id')
        self._validate_token(school, token)
        delivery = self._get_delivery(school, delivery_id=delivery_id)
        return Response(PublicDeliverySerializer(delivery).data)

    def post(self, request, slug):
        school = get_object_or_404(School, public_slug=slug)
        token = request.query_params.get('token')
        delivery_id = request.query_params.get('delivery_id')
        self._validate_token(school, token)
        if not delivery_id:
            raise PermissionDenied('delivery_id obrigatorio para envio da conferencia.')

        serializer = DeliveryConferenceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            delivery = self._get_delivery(school, delivery_id=delivery_id)
            delivery = Delivery.objects.select_for_update().get(id=delivery.id)
            if delivery.status == Delivery.Status.CONFERRED:
                raise PermissionDenied('Conferencia ja enviada para esta entrega.')
            if delivery.status != Delivery.Status.SENT:
                raise PermissionDenied('Entrega ainda nao enviada pela SEMED.')

            delivery_items = {str(item.id): item for item in delivery.items.all()}
            payload_items = serializer.validated_data['items']
            payload_ids = {str(entry['item_id']) for entry in payload_items}

            missing_ids = set(delivery_items.keys()) - payload_ids
            if missing_ids:
                raise PermissionDenied('Envie a conferencia de todos os itens da entrega.')

            for entry in payload_items:
                item = delivery_items.get(str(entry['item_id']))
                if not item:
                    raise PermissionDenied('Item da conferencia nao pertence a entrega.')
                item.received_quantity = entry['received_quantity']
                item.divergence_note = entry.get('note', '')
                item.save(update_fields=['received_quantity', 'divergence_note'])

            delivery.status = Delivery.Status.CONFERRED
            delivery.conference_submitted_at = timezone.now()
            delivery.save(update_fields=['status', 'conference_submitted_at', 'updated_at'])

        delivery = self._get_delivery(school, delivery_id=delivery_id)
        return Response(PublicDeliverySerializer(delivery).data)
