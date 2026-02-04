from rest_framework import serializers
from .models import School


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = [
            'id', 'name', 'address', 'city', 'is_active', 'public_slug', 'public_token',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['public_slug', 'public_token', 'created_at', 'updated_at']


class SchoolPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['id', 'name', 'address', 'city', 'public_slug']
