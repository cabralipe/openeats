from rest_framework.permissions import BasePermission


class IsSemedAdmin(BasePermission):
    message = 'Apenas administradores da SEMED podem acessar este recurso.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'SEMED_ADMIN' and user.is_active)
