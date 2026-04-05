from django.db import models
from rest_framework import permissions, viewsets
from accounts.permissions import IsSemedAdmin

from .models import Recipe
from .serializers import RecipeSerializer


class RecipeViewSet(viewsets.ModelViewSet):
    queryset = Recipe.objects.prefetch_related('ingredients__supply').all().order_by('name')
    serializer_class = RecipeSerializer
    permission_classes = [permissions.IsAuthenticated, IsSemedAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        active = self.request.query_params.get('active')
        search = (self.request.query_params.get('search') or '').strip()
        category = (self.request.query_params.get('category') or '').strip()
        technical_sheet_code = (self.request.query_params.get('technical_sheet_code') or '').strip()
        if active in ['true', 'false']:
            queryset = queryset.filter(active=(active == 'true'))
        if category:
            queryset = queryset.filter(category__iexact=category)
        if technical_sheet_code:
            queryset = queryset.filter(technical_sheet_code__iexact=technical_sheet_code)
        if search:
            queryset = queryset.filter(
                models.Q(name__icontains=search) |
                models.Q(instructions__icontains=search) |
                models.Q(technical_sheet_code__icontains=search)
            ).distinct()
        return queryset
