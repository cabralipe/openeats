import secrets
import uuid
from django.db import models
from django.utils.text import slugify


def generate_token():
    return secrets.token_urlsafe(16)


class Municipality(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    state = models.CharField(max_length=2, blank=True, default='')
    code = models.CharField(max_length=40, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name', 'state']
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'state'],
                name='unique_municipality_name_state',
            ),
            models.UniqueConstraint(
                fields=['code'],
                condition=~models.Q(code=''),
                name='unique_municipality_code',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.name}/{self.state}' if self.state else self.name


class EducationModality(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=40, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class EducationStage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=40, unique=True)
    age_range_start = models.PositiveSmallIntegerField(null=True, blank=True)
    age_range_end = models.PositiveSmallIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class School(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    municipality = models.ForeignKey(
        Municipality,
        on_delete=models.SET_NULL,
        related_name='schools',
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)
    education_stages = models.ManyToManyField(EducationStage, related_name='schools', blank=True)
    education_modalities = models.ManyToManyField(EducationModality, related_name='schools', blank=True)
    public_slug = models.SlugField(unique=True, max_length=255)
    public_token = models.CharField(unique=True, max_length=64, default=generate_token)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def _generate_unique_slug(self):
        base_slug = slugify(self.name) or str(self.id)
        slug = base_slug
        idx = 1
        while School.objects.filter(public_slug=slug).exclude(id=self.id).exists():
            idx += 1
            slug = f"{base_slug}-{idx}"
        return slug

    def save(self, *args, **kwargs):
        if self.municipality and self.city != self.municipality.name:
            self.city = self.municipality.name
        if not self.public_slug:
            self.public_slug = self._generate_unique_slug()
        if not self.public_token:
            self.public_token = generate_token()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name
