from rest_framework.permissions import SAFE_METHODS, BasePermission


def is_user_in_municipality_scope(user, municipality_id) -> bool:
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    if getattr(user, 'role', None) == 'SEMED_ADMIN':
        return True
    user_municipality_id = getattr(user, 'municipality_id', None)
    if not user_municipality_id:
        return False
    return str(user_municipality_id) == str(municipality_id)


def scope_queryset_by_municipality(queryset, user, lookup='municipality_id'):
    if not user or not getattr(user, 'is_authenticated', False):
        return queryset.none()
    if getattr(user, 'role', None) == 'SEMED_ADMIN':
        return queryset
    municipality_id = getattr(user, 'municipality_id', None)
    if not municipality_id:
        return queryset.none()
    return queryset.filter(**{lookup: municipality_id})


class IsSemedAdmin(BasePermission):
    message = 'Apenas administradores da SEMED podem acessar este recurso.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'SEMED_ADMIN' and user.is_active)


class IsPnaeManager(BasePermission):
    message = 'Apenas perfis tecnicos da alimentacao escolar podem acessar este recurso.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and getattr(user, 'can_manage_pnae', False))


class CanAccessPnaeModule(BasePermission):
    message = 'Seu perfil nao possui acesso ao modulo PNAE.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        action = getattr(view, 'action', None)
        if request.method in SAFE_METHODS or action in {
            'dashboard',
            'operational_summary',
            'export_pdf',
            'export_xlsx',
        }:
            return bool(getattr(user, 'can_view_pnae', False))
        if action in {'submit_review'}:
            return bool(getattr(user, 'can_submit_pnae', False))
        if action in {'approve', 'reject'}:
            return bool(getattr(user, 'can_approve_pnae', False))
        return bool(getattr(user, 'can_manage_pnae', False))


class CanAccessNutritionists(BasePermission):
    message = 'Seu perfil nao possui permissao para acessar nutricionistas.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return bool(getattr(user, 'can_view_pnae', False))
        return bool(getattr(user, 'role', None) in {'SEMED_ADMIN', 'MUNICIPAL_MANAGER'} and user.is_active)
