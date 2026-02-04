import secrets
import uuid
from django.db import models
from django.utils.text import slugify


def generate_token():
    return secrets.token_urlsafe(16)


class School(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
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
        if not self.public_slug:
            self.public_slug = self._generate_unique_slug()
        if not self.public_token:
            self.public_token = generate_token()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name
