from rest_framework import serializers

from .models import EducationModality, EducationStage, Municipality, School


class MunicipalitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Municipality
        fields = ['id', 'name', 'state', 'code', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class EducationModalitySerializer(serializers.ModelSerializer):
    class Meta:
        model = EducationModality
        fields = ['id', 'name', 'code', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class EducationStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = EducationStage
        fields = [
            'id', 'name', 'code', 'age_range_start', 'age_range_end',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SchoolSerializer(serializers.ModelSerializer):
    education_stages = serializers.PrimaryKeyRelatedField(
        queryset=EducationStage.objects.filter(is_active=True),
        many=True,
        required=False,
    )
    education_modalities = serializers.PrimaryKeyRelatedField(
        queryset=EducationModality.objects.filter(is_active=True),
        many=True,
        required=False,
    )
    municipality_name = serializers.CharField(source='municipality.name', read_only=True)
    municipality_state = serializers.CharField(source='municipality.state', read_only=True)
    education_stage_details = EducationStageSerializer(source='education_stages', many=True, read_only=True)
    education_modality_details = EducationModalitySerializer(source='education_modalities', many=True, read_only=True)

    class Meta:
        model = School
        fields = [
            'id', 'name', 'address', 'city', 'municipality', 'municipality_name',
            'municipality_state', 'is_active', 'education_stages',
            'education_stage_details', 'education_modalities',
            'education_modality_details', 'public_slug', 'public_token',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['public_slug', 'public_token', 'created_at', 'updated_at']

    def validate(self, attrs):
        municipality = attrs.get('municipality') or getattr(self.instance, 'municipality', None)
        city = attrs.get('city')
        if municipality and (city is None or not str(city).strip()):
            attrs['city'] = municipality.name
        return attrs


class SchoolPublicSerializer(serializers.ModelSerializer):
    education_stage_names = serializers.SerializerMethodField()
    education_modality_names = serializers.SerializerMethodField()
    municipality_name = serializers.CharField(source='municipality.name', read_only=True)

    class Meta:
        model = School
        fields = [
            'id', 'name', 'address', 'city', 'municipality_name',
            'public_slug', 'education_stage_names', 'education_modality_names',
        ]

    def get_education_stage_names(self, obj):
        return [stage.name for stage in obj.education_stages.all()]

    def get_education_modality_names(self, obj):
        return [modality.name for modality in obj.education_modalities.all()]
