import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'merenda_semed.settings')

application = get_asgi_application()
