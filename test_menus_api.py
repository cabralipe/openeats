import os
import sys
import django

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'merenda_semed.settings')
django.setup()

from django.test import Client
from schools.models import School
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.first()
if not user:
    print("No user found")
    sys.exit(0)

school = School.objects.first()
if not school:
    print("No school found")
    sys.exit(0)

client = Client()
client.force_login(user)

response = client.get(f'/api/menus/?school={school.id}')
print(f"GET Status: {response.status_code}")
if response.status_code == 500:
    print("Error content:")
    print(response.content.decode('utf-8'))
else:
    print("GET succeeded")

response2 = client.post('/api/menus/', {
    'school': school.id,
    'week_start': '2026-03-09',
    'week_end': '2026-03-15',
})
print(f"POST Status: {response2.status_code}")
if response2.status_code == 500:
    print("Error content:")
    print(response2.content.decode('utf-8'))
else:
    print("POST succeeded")
