from django.contrib.auth import get_user_model
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import generics, permissions
from rest_framework.pagination import PageNumberPagination

from accounts.permissions import IsSemedAdmin

from .models import AuditLog
from .serializers import AuditLogSerializer

User = get_user_model()


class AuditLogPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class AuditLogListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsSemedAdmin]
    serializer_class = AuditLogSerializer
    pagination_class = AuditLogPagination

    def get_queryset(self):
        queryset = AuditLog.objects.select_related('user').all()

        user_id = (self.request.query_params.get('user_id') or '').strip()
        action_type = (self.request.query_params.get('action_type') or '').strip().upper()
        method = (self.request.query_params.get('method') or '').strip().upper()
        path_contains = (self.request.query_params.get('path') or '').strip()
        date_from_raw = (self.request.query_params.get('date_from') or '').strip()
        date_to_raw = (self.request.query_params.get('date_to') or '').strip()

        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if action_type:
            queryset = queryset.filter(action_type=action_type)
        if method:
            queryset = queryset.filter(method=method)
        if path_contains:
            queryset = queryset.filter(path__icontains=path_contains)

        if date_from_raw:
            dt = parse_datetime(date_from_raw)
            if dt is not None:
                queryset = queryset.filter(created_at__gte=dt)
            else:
                d = parse_date(date_from_raw)
                if d is not None:
                    queryset = queryset.filter(created_at__date__gte=d)

        if date_to_raw:
            dt = parse_datetime(date_to_raw)
            if dt is not None:
                queryset = queryset.filter(created_at__lte=dt)
            else:
                d = parse_date(date_to_raw)
                if d is not None:
                    queryset = queryset.filter(created_at__date__lte=d)

        return queryset
