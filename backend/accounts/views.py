from django.contrib.auth import get_user_model
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsSemedAdmin
from .serializers import (
    MeUpdateSerializer,
    NutritionistCreateSerializer,
    NutritionistUpdateSerializer,
    UserSerializer,
)

User = get_user_model()


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class NutritionistUserViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsSemedAdmin]
    queryset = User.objects.filter(role=User.Roles.NUTRITIONIST).order_by('-date_joined')
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return NutritionistCreateSerializer
        if self.action in {'partial_update', 'update'}:
            return NutritionistUpdateSerializer
        return UserSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        q = (self.request.query_params.get('q') or '').strip()
        is_active = self.request.query_params.get('is_active')
        if q:
            queryset = queryset.filter(email__icontains=q)
        if is_active in {'true', 'false'}:
            queryset = queryset.filter(is_active=(is_active == 'true'))
        return queryset

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)
