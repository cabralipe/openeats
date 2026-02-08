from datetime import date, timedelta
import os

from django.utils import timezone

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from inventory.models import StockBalance, StockMovement, Supply
from menus.models import Menu, MenuItem
from schools.models import School


class Command(BaseCommand):
    help = 'Seed initial data for Merenda SEMED.'

    def handle(self, *args, **options):
        User = get_user_model()

        admin_email = os.getenv('SEED_ADMIN_EMAIL', 'admin@semed.local')
        admin_password = os.getenv('SEED_ADMIN_PASSWORD', 'Admin123!')
        admin, created = User.objects.get_or_create(
            email=admin_email,
            defaults={
                'name': 'Admin SEMED',
                'role': User.Roles.SEMED_ADMIN,
                'is_staff': True,
                'is_superuser': True,
            },
        )
        # Keep admin credentials deterministic for development/deploy bootstrap.
        admin.name = admin.name or 'Admin SEMED'
        admin.role = User.Roles.SEMED_ADMIN
        admin.is_staff = True
        admin.is_superuser = True
        admin.set_password(admin_password)
        admin.save()

        schools_data = [
            {'name': 'Escola Municipal Joao Cordeiro', 'city': 'Maceio', 'address': 'Centro'},
            {'name': 'Escola Municipal Maria Lucia', 'city': 'Maceio', 'address': 'Benedito Bentes'},
            {'name': 'Escola Municipal Santa Rosa', 'city': 'Maceio', 'address': 'Tabuleiro'},
        ]
        schools = []
        for data in schools_data:
            school, _ = School.objects.get_or_create(name=data['name'], defaults=data)
            schools.append(school)

        supplies_data = [
            {'name': 'Arroz Agulhinha', 'category': 'Graos', 'unit': Supply.Units.KG, 'min_stock': 50},
            {'name': 'Feijao Carioca', 'category': 'Graos', 'unit': Supply.Units.KG, 'min_stock': 40},
            {'name': 'Oleo de Soja', 'category': 'Mercearia', 'unit': Supply.Units.L, 'min_stock': 15},
            {'name': 'Frango', 'category': 'Proteinas', 'unit': Supply.Units.KG, 'min_stock': 30},
            {'name': 'Banana', 'category': 'Hortifruti', 'unit': Supply.Units.KG, 'min_stock': 20},
            {'name': 'Leite', 'category': 'Mercearia', 'unit': Supply.Units.L, 'min_stock': 25},
        ]
        supplies = []
        for data in supplies_data:
            supply, _ = Supply.objects.get_or_create(name=data['name'], defaults=data)
            supplies.append(supply)

        for supply in supplies:
            balance, _ = StockBalance.objects.get_or_create(supply=supply)
            if balance.quantity == 0:
                balance.quantity = supply.min_stock + 20
                balance.save()
                StockMovement.objects.create(
                    supply=supply,
                    type=StockMovement.Types.IN,
                    quantity=balance.quantity,
                    movement_date=date.today(),
                    note='Estoque inicial',
                    created_by=admin,
                )

        if schools:
            today = date.today()
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=4)
            menu, menu_created = Menu.objects.get_or_create(
                school=schools[0],
                week_start=week_start,
                defaults={
                    'week_end': week_end,
                    'status': Menu.Status.PUBLISHED,
                    'notes': 'Cardapio exemplo',
                    'created_by': admin,
                    'published_at': None,
                },
            )

            if menu_created or not menu.items.exists():
                menu.published_at = menu.published_at or timezone.now()
                menu.save(update_fields=['published_at'])
                MenuItem.objects.filter(menu=menu).delete()
                items = []
                days = [
                    MenuItem.DayOfWeek.MON,
                    MenuItem.DayOfWeek.TUE,
                    MenuItem.DayOfWeek.WED,
                    MenuItem.DayOfWeek.THU,
                    MenuItem.DayOfWeek.FRI,
                ]
                for day in days:
                    items.append(MenuItem(menu=menu, day_of_week=day, meal_type=MenuItem.MealType.BREAKFAST, description='Leite, pao e fruta'))
                    items.append(MenuItem(menu=menu, day_of_week=day, meal_type=MenuItem.MealType.LUNCH, description='Arroz, feijao e frango'))
                    items.append(MenuItem(menu=menu, day_of_week=day, meal_type=MenuItem.MealType.SNACK, description='Suco e biscoito'))
                MenuItem.objects.bulk_create(items)

        self.stdout.write(self.style.SUCCESS('Seed concluido.'))
        self.stdout.write(self.style.WARNING(f'Admin: {admin_email} / {admin_password}'))
