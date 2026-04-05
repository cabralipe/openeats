from django.db import transaction
from rest_framework import serializers

from inventory.models import Supply

from .models import Recipe, RecipeIngredient
from .services import calculate_recipe_metrics


class RecipeIngredientSerializer(serializers.ModelSerializer):
    supply_name = serializers.CharField(source='supply.name', read_only=True)
    total_cost = serializers.SerializerMethodField()

    class Meta:
        model = RecipeIngredient
        fields = [
            'id', 'recipe', 'supply', 'supply_name', 'qty_base', 'unit', 'gross_weight',
            'net_weight', 'correction_factor', 'unit_cost', 'total_cost', 'optional', 'notes',
        ]
        read_only_fields = ['id', 'recipe', 'supply_name']

    def validate(self, attrs):
        supply = attrs.get('supply') or getattr(self.instance, 'supply', None)
        unit = attrs.get('unit') or getattr(self.instance, 'unit', None)
        if supply and unit and unit not in dict(Supply.Units.choices):
            raise serializers.ValidationError({'unit': 'Unidade invalida.'})
        return attrs

    def get_total_cost(self, obj):
        qty_reference = obj.net_weight or obj.qty_base
        return round((obj.unit_cost or 0) * qty_reference, 4)


class RecipeSerializer(serializers.ModelSerializer):
    ingredients = RecipeIngredientSerializer(many=True, required=False)
    metrics = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = [
            'id', 'name', 'technical_sheet_code', 'category', 'servings_base',
            'preparation_time_minutes', 'yield_weight', 'portion_weight', 'instructions',
            'equipment_notes', 'preparation_notes', 'tags', 'active',
            'created_at', 'updated_at', 'ingredients',
            'metrics',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_servings_base(self, value):
        if value <= 0:
            raise serializers.ValidationError('servings_base deve ser maior que zero.')
        return value

    def _save_ingredients(self, recipe: Recipe, ingredients_data):
        if ingredients_data is None:
            return
        RecipeIngredient.objects.filter(recipe=recipe).delete()
        objs = []
        for item in ingredients_data:
            objs.append(RecipeIngredient(recipe=recipe, **item))
        RecipeIngredient.objects.bulk_create(objs)

    def create(self, validated_data):
        ingredients_data = validated_data.pop('ingredients', [])
        with transaction.atomic():
            recipe = Recipe.objects.create(**validated_data)
            self._save_ingredients(recipe, ingredients_data)
        return recipe

    def update(self, instance, validated_data):
        ingredients_data = validated_data.pop('ingredients', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        with transaction.atomic():
            instance.save()
            self._save_ingredients(instance, ingredients_data)
        return instance

    def get_metrics(self, obj):
        return calculate_recipe_metrics(obj)
