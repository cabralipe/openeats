from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'role', 'is_active', 'date_joined']


class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['name']


class NutritionistCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'password', 'role', 'is_active', 'date_joined']
        read_only_fields = ['id', 'role', 'is_active', 'date_joined']
        extra_kwargs = {
            'name': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        name = (validated_data.get('name') or '').strip() or 'Nutricionista'
        email = validated_data['email'].strip().lower()
        password = validated_data.pop('password')
        user = User(
            name=name,
            email=email,
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
        fields = ['name', 'email', 'password', 'is_active']

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
