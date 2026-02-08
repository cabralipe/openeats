"""
Custom authentication classes for handling JWT tokens via query parameters.
This is necessary for export endpoints that are opened via window.open().
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class QueryParamJWTAuthentication(JWTAuthentication):
    """
    JWT authentication that also checks for a 'token' query parameter.
    
    This allows authenticated access to endpoints opened via window.open()
    in the browser, which cannot send Authorization headers.
    """
    
    def authenticate(self, request):
        # First try standard JWT authentication (Authorization header)
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                validated_token = self.get_validated_token(raw_token)
                return self.get_user(validated_token), validated_token
        
        # If no header, try query parameter
        raw_token = request.query_params.get('token')
        if raw_token is None:
            return None
        
        try:
            validated_token = self.get_validated_token(raw_token.encode())
            return self.get_user(validated_token), validated_token
        except (InvalidToken, TokenError):
            return None
