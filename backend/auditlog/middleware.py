import json

from django.forms.models import model_to_dict
from django.utils.deprecation import MiddlewareMixin

from .models import AuditLog


class AuditLogMiddleware(MiddlewareMixin):
    MUTATING_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}

    def process_request(self, request):
        request._audit_request_payload = self._parse_request_payload(request)
        request._audit_before_payload = None

    def process_view(self, request, view_func, view_args, view_kwargs):
        request._audit_before_payload = self._snapshot_before_payload(view_func, view_kwargs)

    def process_response(self, request, response):
        try:
            self._maybe_log(request, response)
        except Exception:
            # Never break the request lifecycle due to audit logging.
            pass
        return response

    def _maybe_log(self, request, response):
        if request.method not in self.MUTATING_METHODS:
            return
        path = getattr(request, 'path', '') or ''
        if not path.startswith('/api/'):
            return
        if path.startswith('/api/auth/'):
            return

        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return
        if getattr(user, 'role', None) != 'NUTRITIONIST':
            return

        AuditLog.objects.create(
            user=user,
            action_type=self._map_action_type(request.method),
            method=request.method,
            path=path,
            action_route=self._get_action_route(request),
            ip_address=self._get_ip_address(request),
            status_code=getattr(response, 'status_code', None),
            payload_before=getattr(request, '_audit_before_payload', None),
            payload_after=self._parse_response_payload(response),
            request_payload=getattr(request, '_audit_request_payload', None),
        )

    def _map_action_type(self, method):
        if method == 'POST':
            return AuditLog.ActionTypes.CREATE
        if method in {'PUT', 'PATCH'}:
            return AuditLog.ActionTypes.UPDATE
        if method == 'DELETE':
            return AuditLog.ActionTypes.DELETE
        return AuditLog.ActionTypes.UPDATE

    def _get_action_route(self, request):
        match = getattr(request, 'resolver_match', None)
        if not match:
            return ''
        return getattr(match, 'view_name', '') or ''

    def _get_ip_address(self, request):
        forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR') or None

    def _parse_request_payload(self, request):
        body = getattr(request, 'body', b'') or b''
        if not body:
            return None
        try:
            decoded = body.decode('utf-8')
        except UnicodeDecodeError:
            return {'raw': '<non-utf8>'}
        try:
            return json.loads(decoded)
        except json.JSONDecodeError:
            return {'raw': decoded[:5000]}

    def _parse_response_payload(self, response):
        if hasattr(response, 'data'):
            return self._json_safe(response.data)
        content = getattr(response, 'content', b'') or b''
        if not content:
            return None
        try:
            decoded = content.decode('utf-8')
        except UnicodeDecodeError:
            return {'raw': '<non-utf8>'}
        try:
            return json.loads(decoded)
        except json.JSONDecodeError:
            return {'raw': decoded[:5000]}

    def _json_safe(self, value):
        try:
            encoded = json.dumps(value, default=str)
            return json.loads(encoded)
        except TypeError:
            return {'raw': str(value)}

    def _snapshot_before_payload(self, view_func, view_kwargs):
        pk = (view_kwargs or {}).get('pk')
        if not pk:
            return None
        view_cls = getattr(view_func, 'cls', None)
        if view_cls is None:
            return None
        queryset = getattr(view_cls, 'queryset', None)
        model = getattr(queryset, 'model', None) if queryset is not None else None
        if model is None:
            return None
        try:
            instance = model.objects.filter(pk=pk).first()
        except Exception:
            return None
        if instance is None:
            return None
        data = model_to_dict(instance)
        data['id'] = str(getattr(instance, 'pk', pk))
        return self._json_safe(data)
