from rest_framework import serializers

from .models import MealServiceEntry, MealServiceReport, Menu, MenuItem


class MenuItemSerializer(serializers.ModelSerializer):
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
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class MenuSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    items = MenuItemSerializer(many=True, read_only=True)

    class Meta:
        model = Menu
        fields = [
            'id', 'school', 'school_name', 'name', 'week_start', 'week_end', 'status', 'notes', 'created_by',
            'published_at', 'created_at', 'updated_at', 'items'
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
