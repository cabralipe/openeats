from rest_framework import serializers

from .models import MealServiceEntry, MealServiceReport, Menu, MenuItem


class MenuItemSerializer(serializers.ModelSerializer):
    recipe_name = serializers.CharField(source='recipe.name', read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            'id',
            'day_of_week',
            'meal_type',
            'meal_name',
            'portion_text',
            'image_url',
            'image_data',
            'description',
            'recipe',
            'recipe_name',
            'calc_mode',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        recipe = attrs.get('recipe', getattr(self.instance, 'recipe', None))
        calc_mode = attrs.get('calc_mode', getattr(self.instance, 'calc_mode', MenuItem.CalcMode.FREE_TEXT))
        if recipe:
            if not recipe.active:
                raise serializers.ValidationError({'recipe': 'Receita inativa nao pode ser vinculada.'})
            attrs['calc_mode'] = MenuItem.CalcMode.RECIPE
        elif calc_mode == MenuItem.CalcMode.RECIPE:
            attrs['calc_mode'] = MenuItem.CalcMode.FREE_TEXT
        return attrs


class MenuSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    items = MenuItemSerializer(many=True, read_only=True)

    class Meta:
        model = Menu
        fields = [
            'id', 'school', 'school_name', 'name', 'week_start', 'week_end', 'status', 'notes',
            'author_name', 'author_crn', 'nutritional_info',
            'created_by', 'published_at', 'created_at', 'updated_at', 'items'
        ]
        read_only_fields = ['created_by', 'published_at', 'created_at', 'updated_at']


class MenuItemBulkSerializer(serializers.Serializer):
    items = MenuItemSerializer(many=True)


class MealServiceEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = MealServiceEntry
        fields = ['id', 'meal_type', 'meal_label', 'served_count']
        read_only_fields = ['id']


class MealServiceReportSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    entries = MealServiceEntrySerializer(many=True, read_only=True)

    class Meta:
        model = MealServiceReport
        fields = ['id', 'school', 'school_name', 'menu', 'service_date', 'submitted_at', 'updated_at', 'entries']
        read_only_fields = ['id', 'submitted_at', 'updated_at']
