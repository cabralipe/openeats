from rest_framework import serializers

from .models import Menu, MenuItem


class MenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = ['id', 'day_of_week', 'meal_type', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


class MenuSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    items = MenuItemSerializer(many=True, read_only=True)

    class Meta:
        model = Menu
        fields = [
            'id', 'school', 'school_name', 'week_start', 'week_end', 'status', 'notes', 'created_by',
            'published_at', 'created_at', 'updated_at', 'items'
        ]
        read_only_fields = ['created_by', 'published_at', 'created_at', 'updated_at']


class MenuItemBulkSerializer(serializers.Serializer):
    items = MenuItemSerializer(many=True)
