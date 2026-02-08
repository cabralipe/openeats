from django.db import transaction
from rest_framework import serializers

from .models import Delivery, DeliveryItem, Notification, Responsible, SchoolStockBalance, Supply, StockBalance, StockMovement




class SupplySerializer(serializers.ModelSerializer):
    class Meta:
        model = Supply
        fields = ['id', 'name', 'category', 'unit', 'min_stock', 'is_active', 'created_at', 'updated_at']


class StockBalanceSerializer(serializers.ModelSerializer):
    supply = SupplySerializer(read_only=True)
    is_low_stock = serializers.SerializerMethodField()

    class Meta:
        model = StockBalance
        fields = ['supply', 'quantity', 'is_low_stock']

    def get_is_low_stock(self, obj):
        return obj.quantity < obj.supply.min_stock


class SchoolStockBalanceSerializer(serializers.ModelSerializer):
    supply = SupplySerializer(read_only=True)
    school_name = serializers.CharField(source='school.name', read_only=True)
    is_low_stock = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = SchoolStockBalance
        fields = ['id', 'school', 'school_name', 'supply', 'quantity', 'min_stock', 'is_low_stock', 'status', 'last_updated']
        read_only_fields = ['id', 'school_name', 'is_low_stock', 'status', 'last_updated']

    def _get_min_stock(self, obj):
        # Use school-specific min_stock if set, otherwise fall back to supply's global min_stock
        return obj.min_stock if obj.min_stock > 0 else obj.supply.min_stock

    def get_is_low_stock(self, obj):
        return obj.quantity < self._get_min_stock(obj)

    def get_status(self, obj):
        min_stock = self._get_min_stock(obj)
        if obj.quantity < min_stock:
            return 'BAIXO'
        elif obj.quantity >= min_stock * 2:
            return 'ALTO'
        return 'NORMAL'


class SchoolStockLimitUpdateSerializer(serializers.Serializer):
    min_stock = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)


class SchoolStockBulkLimitItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(min_value=1)
    min_stock = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)


class ResponsibleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Responsible
        fields = ['id', 'name', 'phone', 'position', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = ['id', 'supply', 'school', 'type', 'quantity', 'movement_date', 'note', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']
        extra_kwargs = {
            'school': {'required': False, 'allow_null': True},
        }

    def validate(self, attrs):
        if attrs['quantity'] <= 0:
            raise serializers.ValidationError('Quantidade deve ser maior que zero.')
        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        supply = validated_data['supply']
        with transaction.atomic():
            balance, _ = StockBalance.objects.select_for_update().get_or_create(supply=supply)
            quantity = validated_data['quantity']
            if validated_data['type'] == StockMovement.Types.OUT:
                if balance.quantity - quantity < 0:
                    raise serializers.ValidationError('Saldo insuficiente para esta saida.')
                balance.quantity -= quantity
            else:
                balance.quantity += quantity
            balance.save()
            movement = StockMovement.objects.create(created_by=user, **validated_data)
        return movement


class DeliveryItemSerializer(serializers.ModelSerializer):
    supply_name = serializers.CharField(source='supply.name', read_only=True)
    supply_unit = serializers.CharField(source='supply.unit', read_only=True)
    shortage_quantity = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryItem
        fields = [
            'id',
            'supply',
            'supply_name',
            'supply_unit',
            'planned_quantity',
            'received_quantity',
            'divergence_note',
            'shortage_quantity',
        ]
        read_only_fields = ['id', 'supply_name', 'supply_unit', 'received_quantity', 'divergence_note', 'shortage_quantity']

    def get_shortage_quantity(self, obj):
        if obj.received_quantity is None:
            return None
        shortage = obj.planned_quantity - obj.received_quantity
        return shortage if shortage > 0 else 0


class DeliverySerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    sender_name = serializers.CharField(source='sender.name', read_only=True, allow_null=True)
    sender_position = serializers.CharField(source='sender.position', read_only=True, allow_null=True)
    items = DeliveryItemSerializer(many=True)

    class Meta:
        model = Delivery
        fields = [
            'id',
            'school',
            'school_name',
            'delivery_date',
            'sender',
            'sender_name',
            'sender_position',
            'responsible_name',
            'responsible_phone',
            'notes',
            'status',
            'conference_enabled',
            'sent_at',
            'conference_submitted_at',
            'sender_signature',
            'sender_signed_by',
            'receiver_signature',
            'receiver_signed_by',
            'conference_signature',
            'conference_signed_by',
            'created_by',
            'created_at',
            'updated_at',
            'items',
        ]
        read_only_fields = [
            'id',
            'school_name',
            'sender_name',
            'sender_position',
            'status',
            'conference_enabled',
            'sent_at',
            'conference_submitted_at',
            'sender_signature',
            'sender_signed_by',
            'receiver_signature',
            'receiver_signed_by',
            'conference_signature',
            'conference_signed_by',
            'created_by',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'sender': {'required': False, 'allow_null': True},
        }


    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('Informe pelo menos um item para a entrega.')
        supply_ids = [entry['supply'].id for entry in items]
        if len(supply_ids) != len(set(supply_ids)):
            raise serializers.ValidationError('Nao e permitido repetir insumos na mesma entrega.')
        return items

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        user = self.context['request'].user
        with transaction.atomic():
            delivery = Delivery.objects.create(created_by=user, **validated_data)
            DeliveryItem.objects.bulk_create([
                DeliveryItem(delivery=delivery, **item_data) for item_data in items_data
            ])
        return delivery

    def update(self, instance, validated_data):
        if instance.status != Delivery.Status.DRAFT:
            raise serializers.ValidationError('Somente entregas em rascunho podem ser alteradas.')

        items_data = validated_data.pop('items', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)

        with transaction.atomic():
            instance.save()
            if items_data is not None:
                DeliveryItem.objects.filter(delivery=instance).delete()
                DeliveryItem.objects.bulk_create([
                    DeliveryItem(delivery=instance, **item_data) for item_data in items_data
                ])
        return instance


class PublicDeliveryItemSerializer(serializers.ModelSerializer):
    supply_name = serializers.CharField(source='supply.name', read_only=True)
    supply_unit = serializers.CharField(source='supply.unit', read_only=True)

    class Meta:
        model = DeliveryItem
        fields = [
            'id',
            'supply_name',
            'supply_unit',
            'planned_quantity',
            'received_quantity',
            'divergence_note',
        ]


class PublicDeliverySerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    sender_name = serializers.CharField(source='sender.name', read_only=True, allow_null=True)
    sender_position = serializers.CharField(source='sender.position', read_only=True, allow_null=True)
    items = PublicDeliveryItemSerializer(many=True, read_only=True)

    class Meta:
        model = Delivery
        fields = [
            'id',
            'school_name',
            'delivery_date',
            'sender_name',
            'sender_position',
            'notes',
            'status',
            'conference_submitted_at',
            'sender_signature',
            'sender_signed_by',
            'receiver_signature',
            'receiver_signed_by',
            'conference_signature',
            'conference_signed_by',
            'items',
        ]



class DeliveryConferenceItemInputSerializer(serializers.Serializer):
    item_id = serializers.UUIDField()
    received_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class DeliveryConferenceInputSerializer(serializers.Serializer):
    items = DeliveryConferenceItemInputSerializer(many=True)
    # Sender (who delivered) signature
    sender_signature_data = serializers.CharField()
    sender_signer_name = serializers.CharField()
    # Receiver (who received at school) signature
    receiver_signature_data = serializers.CharField()
    receiver_signer_name = serializers.CharField()

    def validate_sender_signature_data(self, value):
        if not value or not value.startswith('data:image/'):
            raise serializers.ValidationError('Assinatura do remetente invalida.')
        return value

    def validate_receiver_signature_data(self, value):
        if not value or not value.startswith('data:image/'):
            raise serializers.ValidationError('Assinatura do receptor invalida.')
        return value

    def validate_sender_signer_name(self, value):
        if not value.strip():
            raise serializers.ValidationError('Nome do remetente obrigatorio.')
        return value.strip()

    def validate_receiver_signer_name(self, value):
        if not value.strip():
            raise serializers.ValidationError('Nome do receptor obrigatorio.')
        return value.strip()

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('Informe os itens conferidos.')
        ids = [str(item['item_id']) for item in items]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError('Itens duplicados na conferencia.')
        return items


class PublicConsumptionItemInputSerializer(serializers.Serializer):
    supply = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0.01)
    movement_date = serializers.DateField()
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class PublicConsumptionInputSerializer(serializers.Serializer):
    items = PublicConsumptionItemInputSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('Informe pelo menos um item.')
        ids = [str(item['supply']) for item in items]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError('Itens duplicados no consumo.')
        return items


class NotificationSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    delivery_school = serializers.CharField(source='delivery.school.name', read_only=True)
    
    class Meta:
        model = Notification
        fields = ['id', 'notification_type', 'title', 'message', 'delivery', 'school', 'school_name', 'delivery_school', 'is_read', 'is_alert', 'created_at']
        read_only_fields = ['id', 'notification_type', 'title', 'message', 'delivery', 'school', 'created_at']
