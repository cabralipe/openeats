from django.db import transaction
from django.db.utils import DatabaseError
from decimal import Decimal

from rest_framework import serializers

from .models import (
    Delivery,
    DeliveryItem,
    DeliveryItemLot,
    DeliveryNutritionistSignature,
    Notification,
    Responsible,
    SchoolStockBalance,
    Supplier,
    SupplierReceipt,
    SupplierReceiptItem,
    SupplierReceiptItemLot,
    Supply,
    SupplyLot,
    StockBalance,
    StockMovement,
)
from .services.lots import regenerate_delivery_item_lot_plan_fefo




class SupplySerializer(serializers.ModelSerializer):
    unit = serializers.CharField()
    nova_classification_display = serializers.CharField(
        source='get_nova_classification_display', read_only=True,
    )
    nutritional_function_display = serializers.CharField(
        source='get_nutritional_function_display', read_only=True,
    )

    class Meta:
        model = Supply
        fields = [
            'id', 'name', 'category', 'unit',
            'nova_classification', 'nova_classification_display',
            'nutritional_function', 'nutritional_function_display',
            'min_stock', 'storage_instructions', 'is_active', 'created_at', 'updated_at',
        ]

    def validate_unit(self, value):
        normalized = (value or '').strip().lower()
        if normalized in {'unid', 'unidade', 'unidades'}:
            normalized = Supply.Units.UNIT
        allowed_units = {choice[0] for choice in Supply.Units.choices}
        if normalized not in allowed_units:
            raise serializers.ValidationError('Unidade inválida.')
        return normalized


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


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'document', 'contact_name', 'phone', 'email', 'address', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class SupplierReceiptItemSerializer(serializers.ModelSerializer):
    supply_name = serializers.CharField(source='supply.name', read_only=True)
    supply_created_name = serializers.CharField(source='supply_created.name', read_only=True)

    class Meta:
        model = SupplierReceiptItem
        fields = [
            'id',
            'receipt',
            'supply',
            'supply_name',
            'raw_name',
            'category',
            'unit',
            'expected_quantity',
            'received_quantity',
            'divergence_note',
            'supply_created',
            'supply_created_name',
            'created_at',
        ]
        read_only_fields = ['id', 'receipt', 'supply_name', 'supply_created_name', 'created_at']

    def validate(self, attrs):
        supply = attrs.get('supply')
        raw_name = (attrs.get('raw_name') or '').strip()
        if not supply and not raw_name:
            raise serializers.ValidationError('Informe um insumo existente ou o nome do item recebido.')
        if not supply and not (attrs.get('category') or '').strip():
            raise serializers.ValidationError('Categoria obrigatoria para item novo sem insumo cadastrado.')

        # Keep units consistent with existing catalog item whenever possible.
        if supply:
            attrs['unit'] = supply.unit
            return attrs

        matched_supply = Supply.objects.filter(name__iexact=raw_name).first() if raw_name else None
        if matched_supply:
            attrs['supply'] = matched_supply
            attrs['unit'] = matched_supply.unit
        return attrs


class SupplierReceiptItemLotSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierReceiptItemLot
        fields = [
            'id',
            'receipt_item',
            'supply',
            'lot_code',
            'expiry_date',
            'manufacture_date',
            'received_quantity',
            'divergence_note',
            'created_at',
        ]
        read_only_fields = ['id', 'receipt_item', 'created_at']


class SupplierReceiptConferenceLotInputSerializer(serializers.Serializer):
    lot_code = serializers.CharField(max_length=120)
    expiry_date = serializers.DateField()
    manufacture_date = serializers.DateField(required=False, allow_null=True)
    received_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class SupplierReceiptSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    school_name = serializers.CharField(source='school.name', read_only=True)
    items = SupplierReceiptItemSerializer(many=True)

    class Meta:
        model = SupplierReceipt
        fields = [
            'id',
            'supplier',
            'supplier_name',
            'school',
            'school_name',
            'expected_date',
            'status',
            'notes',
            'sender_signature',
            'sender_signed_by',
            'receiver_signature',
            'receiver_signed_by',
            'conference_started_at',
            'conference_finished_at',
            'created_by',
            'created_at',
            'updated_at',
            'items',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('Informe pelo menos um item para o recebimento.')
        return items

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        user = self.context['request'].user
        with transaction.atomic():
            receipt = SupplierReceipt.objects.create(created_by=user, **validated_data)
            SupplierReceiptItem.objects.bulk_create([
                SupplierReceiptItem(receipt=receipt, **item_data) for item_data in items_data
            ])
        return receipt

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)

        with transaction.atomic():
            instance.save()
            if items_data is not None:
                SupplierReceiptItem.objects.filter(receipt=instance).delete()
                SupplierReceiptItem.objects.bulk_create([
                    SupplierReceiptItem(receipt=instance, **item_data) for item_data in items_data
                ])
        return instance


class SupplierReceiptConferenceItemInputSerializer(serializers.Serializer):
    item_id = serializers.UUIDField()
    received_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    lots = SupplierReceiptConferenceLotInputSerializer(many=True, required=False)


class SupplierReceiptConferenceInputSerializer(serializers.Serializer):
    items = SupplierReceiptConferenceItemInputSerializer(many=True)
    sender_signature_data = serializers.CharField()
    sender_signer_name = serializers.CharField()
    receiver_signature_data = serializers.CharField()
    receiver_signer_name = serializers.CharField()

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('Informe os itens conferidos.')
        ids = [str(item['item_id']) for item in items]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError('Itens duplicados na conferencia.')
        return items

    def validate_sender_signature_data(self, value):
        if not value or not value.startswith('data:image/'):
            raise serializers.ValidationError('Assinatura do entregador invalida.')
        return value

    def validate_receiver_signature_data(self, value):
        if not value or not value.startswith('data:image/'):
            raise serializers.ValidationError('Assinatura do recebedor invalida.')
        return value

    def validate_sender_signer_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Nome do entregador obrigatorio.')
        return cleaned

    def validate_receiver_signer_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Nome do recebedor obrigatorio.')
        return cleaned


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
    lots = serializers.SerializerMethodField()

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
            'lots',
        ]
        read_only_fields = ['id', 'supply_name', 'supply_unit', 'received_quantity', 'divergence_note', 'shortage_quantity']

    def get_shortage_quantity(self, obj):
        if obj.received_quantity is None:
            return None
        shortage = obj.planned_quantity - obj.received_quantity
        return shortage if shortage > 0 else 0

    def get_lots(self, obj):
        return DeliveryItemLotSerializer(obj.lots.select_related('lot').all(), many=True).data


class DeliveryItemLotSerializer(serializers.ModelSerializer):
    lot_code = serializers.CharField(source='lot.lot_code', read_only=True)
    expiry_date = serializers.DateField(source='lot.expiry_date', read_only=True)
    lot_status = serializers.CharField(source='lot.status', read_only=True)
    supplier_name = serializers.CharField(source='lot.supplier.name', read_only=True, allow_null=True)

    class Meta:
        model = DeliveryItemLot
        fields = [
            'id', 'delivery_item', 'lot', 'lot_code', 'expiry_date', 'lot_status', 'supplier_name',
            'planned_quantity', 'received_quantity', 'divergence_note',
        ]
        read_only_fields = ['id', 'delivery_item', 'lot_code', 'expiry_date', 'lot_status', 'supplier_name']


class DeliveryItemLotInputSerializer(serializers.Serializer):
    lot = serializers.UUIDField()
    planned_quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)


class DeliveryNutritionistSignatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryNutritionistSignature
        fields = ['id', 'delivery', 'name', 'crn', 'function_role', 'signature_data', 'created_at']
        read_only_fields = ['id', 'created_at']


class DeliverySerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    sender_name = serializers.CharField(source='sender.name', read_only=True, allow_null=True)
    sender_position = serializers.CharField(source='sender.position', read_only=True, allow_null=True)
    nutritionist_signatures = serializers.SerializerMethodField()
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
            'nutritionist_signatures',
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
            'nutritionist_signatures',
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

    def get_nutritionist_signatures(self, obj):
        try:
            signatures = obj.nutritionist_signatures.all()
        except DatabaseError:
            # Keep deliveries endpoint available even when signature schema is temporarily out of sync.
            return []
        return DeliveryNutritionistSignatureSerializer(signatures, many=True).data

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        user = self.context['request'].user
        with transaction.atomic():
            delivery = Delivery.objects.create(created_by=user, **validated_data)
            DeliveryItem.objects.bulk_create([
                DeliveryItem(delivery=delivery, **item_data) for item_data in items_data
            ])
            for item in delivery.items.select_related('supply').all():
                try:
                    regenerate_delivery_item_lot_plan_fefo(item)
                except serializers.ValidationError:
                    # Compat mode: allow draft delivery even when no lot balances are available yet.
                    pass
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
                for item in instance.items.select_related('supply').all():
                    try:
                        regenerate_delivery_item_lot_plan_fefo(item)
                    except serializers.ValidationError:
                        pass
        return instance


class PublicDeliveryItemSerializer(serializers.ModelSerializer):
    supply_name = serializers.CharField(source='supply.name', read_only=True)
    supply_unit = serializers.CharField(source='supply.unit', read_only=True)
    lots = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryItem
        fields = [
            'id',
            'supply_name',
            'supply_unit',
            'planned_quantity',
            'received_quantity',
            'divergence_note',
            'lots',
        ]

    def get_lots(self, obj):
        return PublicDeliveryItemLotSerializer(obj.lots.select_related('lot').all(), many=True).data


class PublicDeliveryItemLotSerializer(serializers.ModelSerializer):
    lot_code = serializers.CharField(source='lot.lot_code', read_only=True)
    expiry_date = serializers.DateField(source='lot.expiry_date', read_only=True)
    supplier_name = serializers.CharField(source='lot.supplier.name', read_only=True, allow_null=True)

    class Meta:
        model = DeliveryItemLot
        fields = ['id', 'lot', 'lot_code', 'expiry_date', 'supplier_name', 'planned_quantity', 'received_quantity', 'divergence_note']


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
    lots = serializers.ListField(child=serializers.DictField(), required=False)


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
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
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


class SupplyLotSerializer(serializers.ModelSerializer):
    supply_name = serializers.CharField(source='supply.name', read_only=True)
    central_quantity = serializers.SerializerMethodField()

    class Meta:
        model = SupplyLot
        fields = [
            'id', 'supply', 'supply_name', 'lot_code', 'manufacture_date', 'expiry_date',
            'storage_instructions_snapshot', 'supplier', 'invoice_ref', 'status', 'central_quantity',
            'created_at', 'updated_at',
        ]

    def get_central_quantity(self, obj):
        return getattr(getattr(obj, 'central_balance', None), 'quantity', None)


class NotificationSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    delivery_school = serializers.CharField(source='delivery.school.name', read_only=True)
    
    class Meta:
        model = Notification
        fields = ['id', 'notification_type', 'title', 'message', 'delivery', 'school', 'school_name', 'delivery_school', 'is_read', 'is_alert', 'created_at']
        read_only_fields = ['id', 'notification_type', 'title', 'message', 'delivery', 'school', 'created_at']
