import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models

from schools.models import Municipality


class User(AbstractUser):
    class Roles(models.TextChoices):
        SEMED_ADMIN = 'SEMED_ADMIN', 'SEMED Admin'
        MUNICIPAL_MANAGER = 'MUNICIPAL_MANAGER', 'Gestor Municipal'
        NUTRITIONIST = 'NUTRITIONIST', 'Nutricionista'
        SCHOOL_FEEDING_COORDINATOR = 'SCHOOL_FEEDING_COORDINATOR', 'Coordenador de Alimentacao Escolar'
        SCHOOL_DIRECTOR = 'SCHOOL_DIRECTOR', 'Diretor Escolar'
        SCHOOL_OPERATOR = 'SCHOOL_OPERATOR', 'Merendeira / Apoio Operacional'
        CAE_COUNCILOR = 'CAE_COUNCILOR', 'Conselheiro do CAE'
        STOCK_OPERATOR = 'STOCK_OPERATOR', 'Tecnico de Estoque/Compras'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    crn = models.CharField(max_length=64, blank=True, default='')
    function_role = models.CharField(max_length=160, blank=True, default='')
    role = models.CharField(max_length=32, choices=Roles.choices, default=Roles.SEMED_ADMIN)
    municipality = models.ForeignKey(
        Municipality,
        on_delete=models.SET_NULL,
        related_name='users',
        null=True,
        blank=True,
    )

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

    @property
    def is_cae_councilor(self) -> bool:
        return self.role == self.Roles.CAE_COUNCILOR and self.is_active

    @property
    def can_view_pnae(self) -> bool:
        return self.is_active and self.role in {
            self.Roles.SEMED_ADMIN,
            self.Roles.MUNICIPAL_MANAGER,
            self.Roles.NUTRITIONIST,
            self.Roles.SCHOOL_FEEDING_COORDINATOR,
            self.Roles.SCHOOL_DIRECTOR,
            self.Roles.CAE_COUNCILOR,
        }

    @property
    def can_manage_pnae(self) -> bool:
        return self.is_active and self.role in {
            self.Roles.SEMED_ADMIN,
            self.Roles.MUNICIPAL_MANAGER,
            self.Roles.NUTRITIONIST,
            self.Roles.SCHOOL_FEEDING_COORDINATOR,
        }

    @property
    def can_submit_pnae(self) -> bool:
        return self.can_manage_pnae

    @property
    def can_approve_pnae(self) -> bool:
        return self.is_active and self.role in {
            self.Roles.SEMED_ADMIN,
            self.Roles.MUNICIPAL_MANAGER,
        }

    @property
    def is_pnae_viewer_restricted(self) -> bool:
        return self.is_active and self.role == self.Roles.CAE_COUNCILOR
