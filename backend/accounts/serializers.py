import secrets

from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'crn', 'role', 'is_active', 'date_joined']


class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['name']


class NutritionistCreateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'crn', 'password', 'role', 'is_active', 'date_joined']
        read_only_fields = ['id', 'role', 'is_active', 'date_joined']
        extra_kwargs = {
            'name': {'required': False, 'allow_blank': True},
            'crn': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        name = (validated_data.get('name') or '').strip() or 'Nutricionista'
        crn = (validated_data.get('crn') or '').strip()
        provided_email = (validated_data.get('email') or '').strip().lower()
        base_slug = slugify(name) or 'nutricionista'
        email = provided_email or f'{base_slug}@nutri.local'
        if User.objects.filter(email=email).exists():
            email = f'{base_slug}-{secrets.token_hex(3)}@nutri.local'
        password = validated_data.pop('password', None) or secrets.token_urlsafe(12)
        user = User(
            name=name,
            email=email,
            crn=crn,
            role=User.Roles.NUTRITIONIST,
            is_active=True,
            is_staff=False,
            is_superuser=False,
        )
        user.set_password(password)
        user.save()
        return user


class NutritionistUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = ['name', 'email', 'crn', 'password', 'is_active']
        extra_kwargs = {
            'crn': {'required': False, 'allow_blank': True},
        }

    def validate_email(self, value):
        value = value.strip().lower()
        qs = User.objects.filter(email=value).exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Já existe usuário com este e-mail.')
        return value

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.role = User.Roles.NUTRITIONIST
        instance.is_superuser = False
        instance.save()
        if password:
            instance.set_password(password)
            instance.save(update_fields=['password'])
        return instance
