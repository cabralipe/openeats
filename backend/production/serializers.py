from rest_framework import serializers

from inventory.models import Supply
from menus.models import MenuItem
from schools.models import School

from .models import PublicCalculatorLink, SupplyAlias, SupplyConsumptionRule


class SupplyAliasSerializer(serializers.ModelSerializer):
    supply_name = serializers.CharField(source='supply.name', read_only=True)

    class Meta:
        model = SupplyAlias
        fields = ['id', 'supply', 'supply_name', 'alias', 'created_at']
        read_only_fields = ['id', 'created_at', 'supply_name']


class SupplyConsumptionRuleSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    supply_name = serializers.CharField(source='supply.name', read_only=True)

    class Meta:
        model = SupplyConsumptionRule
        fields = [
            'id', 'school', 'school_name', 'supply', 'supply_name', 'meal_type',
            'qty_per_student', 'unit', 'active', 'notes',
        ]
        read_only_fields = ['id', 'school_name', 'supply_name']

    def validate_meal_type(self, value):
        if value and value not in dict(MenuItem.MealType.choices):
            raise serializers.ValidationError('meal_type invalido.')
        return value

    def validate_unit(self, value):
        if value not in dict(Supply.Units.choices):
            raise serializers.ValidationError('Unidade invalida.')
        return value


class PublicCalculatorLinkSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)

    class Meta:
        model = PublicCalculatorLink
        fields = ['id', 'school', 'school_name', 'token', 'is_active', 'allowed_scope', 'created_at', 'updated_at']
        read_only_fields = ['id', 'token', 'created_at', 'updated_at', 'school_name']


class RoundingSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=['UP', 'NEAREST', 'NONE'], required=False, default='NEAREST')
    decimals = serializers.IntegerField(required=False, min_value=0, max_value=6, default=2)


class MenuProductionCalculateSerializer(serializers.Serializer):
    students_by_meal_type = serializers.DictField(
        child=serializers.IntegerField(min_value=0),
        required=False,
        default=dict,
    )
    waste_percent = serializers.DecimalField(required=False, max_digits=8, decimal_places=2, min_value=0, default=0)
    include_stock = serializers.BooleanField(required=False, default=True)
    rounding = RoundingSerializer(required=False)


class PublicCalculatorCalculateSerializer(MenuProductionCalculateSerializer):
    week_start = serializers.DateField()


class PublicCalculatorMetaSerializer(serializers.Serializer):
    school = serializers.DictField()
    allowed_scope = serializers.CharField()
    is_active = serializers.BooleanField()
    current_published_menu = serializers.DictField(allow_null=True)

