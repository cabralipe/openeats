from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import School, generate_token
from .serializers import SchoolSerializer


class SchoolViewSet(viewsets.ModelViewSet):
    queryset = School.objects.all().order_by('name')
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        query = self.request.query_params.get('q')
        city = self.request.query_params.get('city')
        address = self.request.query_params.get('address')
        is_active = self.request.query_params.get('is_active')
        if query:
            queryset = queryset.filter(name__icontains=query)
        if city:
            queryset = queryset.filter(city__icontains=city)
        if address:
            queryset = queryset.filter(address__icontains=address)
        if is_active in ['true', 'false']:
            queryset = queryset.filter(is_active=is_active == 'true')
        return queryset

    @action(detail=True, methods=['post'])
    def regenerate_link(self, request, pk=None):
        school = self.get_object()
        school.public_token = generate_token()
        school.save()
        serializer = self.get_serializer(school)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def public_link(self, request, pk=None):
        school = self.get_object()
        return Response({
            'slug': school.public_slug,
            'token': school.public_token,
            'url': f"/public/schools/{school.public_slug}/menu/current/?token={school.public_token}",
            'consumption_url': f"/public/schools/{school.public_slug}/consumption/?token={school.public_token}",
            'consumption_page_url': f"/public/consumption?slug={school.public_slug}&token={school.public_token}",
        })
