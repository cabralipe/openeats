import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Roles(models.TextChoices):
        SEMED_ADMIN = 'SEMED_ADMIN', 'SEMED Admin'
        NUTRITIONIST = 'NUTRITIONIST', 'Nutricionista'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=32, choices=Roles.choices, default=Roles.SEMED_ADMIN)

    username = None
    first_name = None
    last_name = None

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self) -> str:
        return self.email

    @property
    def is_semed_admin(self) -> bool:
        return self.role == self.Roles.SEMED_ADMIN and self.is_active

    @property
    def is_nutritionist(self) -> bool:
        return self.role == self.Roles.NUTRITIONIST and self.is_active
