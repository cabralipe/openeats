import os
import sys
import django

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'merenda_semed.settings')
django.setup()

from menus.models import MealServiceEntry, MealServiceReport
from inventory.models import StockMovement

print(f"MealServiceReport count: {MealServiceReport.objects.count()}")
print(f"MealServiceEntry count: {MealServiceEntry.objects.count()}")
if MealServiceEntry.objects.exists():
    entry = MealServiceEntry.objects.first()
    print(f"Sample MealServiceEntry: {entry.id}, "
          f"school={entry.report.school.name if entry.report and entry.report.school else None}, "
          f"meal_type={entry.meal_type}, "
          f"served_count={entry.served_count}")

from django.utils import timezone
today = timezone.localdate()
current_month_start = today.replace(day=1)

outflows = StockMovement.objects.filter(
    type=StockMovement.Types.OUT,
    school__isnull=False,
)
print(f"StockOutflows (school not null) total: {outflows.count()}")
month_outflows = outflows.filter(movement_date__gte=current_month_start)
print(f"StockOutflows current month: {month_outflows.count()}")

from django.db.models import Sum
from django.db.models.functions import TruncMonth

movements = (
    StockMovement.objects.filter(
        type=StockMovement.Types.OUT,
        school__isnull=False,
    )
    .annotate(month=TruncMonth('movement_date'))
    .values('month')
    .annotate(total=Sum('quantity'))
    .order_by('month')
)
print("Movements by month:")
for m in movements:
    print(m)

served = (
    MealServiceEntry.objects.select_related('report__school')
    .values('report__school__id', 'report__school__name', 'meal_type')
    .annotate(total=Sum('served_count'))
    .order_by('report__school__name', 'meal_type')
)
print("Served by category:")
for s in served:
    print(s)

