import os
import sys
import django

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'merenda_semed.settings')
django.setup()

from menus.models import MealServiceEntry, MealServiceReport, MenuItem
from schools.models import School
from django.utils import timezone

school = School.objects.first()
if not school:
    school = School.objects.create(name="Test School")

report, _ = MealServiceReport.objects.get_or_create(
    school=school,
    service_date=timezone.localdate()
)

MealServiceEntry.objects.get_or_create(
    report=report,
    meal_type=MenuItem.MealType.LUNCH,
    defaults={'served_count': 150}
)

from django.db.models import Sum

served = (
    MealServiceEntry.objects.select_related('report__school')
    .values('report__school__id', 'report__school__name', 'meal_type')
    .annotate(total=Sum('served_count'))
    .order_by('report__school__name', 'meal_type')
)

print("Results:")
for s in served:
    print(s)

labels = dict(MenuItem.MealType.choices)
served_by_school_category = [
    {
        'school_id': str(item['report__school__id']),
        'school_name': item['report__school__name'],
        'meal_type': item['meal_type'],
        'meal_label': labels.get(item['meal_type'], item['meal_type']),
        'value': int(item['total'] or 0),
    }
    for item in served
    if item.get('report__school__id') is not None
]
print("Transformed:")
print(served_by_school_category)
