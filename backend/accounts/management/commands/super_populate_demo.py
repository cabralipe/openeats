from datetime import date, timedelta
from decimal import Decimal
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from auditlog.models import AuditLog
from inventory.models import (
    Delivery,
    DeliveryItem,
    Notification,
    Responsible,
    SchoolStockBalance,
    StockBalance,
    StockMovement,
    Supplier,
    SupplierReceipt,
    SupplierReceiptItem,
    Supply,
)
from menus.models import MealServiceEntry, MealServiceReport, Menu, MenuItem
from schools.models import School


DEMO_MARKER = "[SUPER_DEMO]"
FAKE_SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZQx8AAAAASUVORK5CYII="


class Command(BaseCommand):
    help = "Populate rich demo data for end-to-end platform demonstrations (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-demo-generated",
            action="store_true",
            help="Remove previous demo-generated notifications, movements and logs before recreating.",
        )

    def handle(self, *args, **options):
        with transaction.atomic():
            users = self._ensure_users()
            schools = self._ensure_schools()
            supplies = self._ensure_supplies()
            responsibles = self._ensure_responsibles()

            if options.get("reset_demo_generated"):
                self._reset_demo_generated()

            self._ensure_central_stock(users["admin"], supplies)
            self._ensure_school_stock(users["admin"], schools, supplies)
            self._ensure_menus(users["admin"], schools)
            self._ensure_meal_service_reports(schools)
            deliveries = self._ensure_deliveries(users["admin"], schools, supplies, responsibles)
            self._ensure_suppliers_and_receipts(users["admin"], schools, supplies)
            self._ensure_notifications(schools, deliveries)
            self._ensure_audit_logs(users)

        self.stdout.write(self.style.SUCCESS("Super populate demo concluido."))
        self.stdout.write(self.style.WARNING(f"Marcador: {DEMO_MARKER}"))
        self.stdout.write(self.style.WARNING("Links publicos de demo:"))
        for school in School.objects.filter(name__icontains="Escola Municipal", is_active=True).order_by("name")[:4]:
            self.stdout.write(
                f"- {school.name}: /public/meal-service?slug={school.public_slug}&token={school.public_token}"
            )

    def _ensure_users(self):
        User = get_user_model()
        admin_email = os.getenv("SEED_ADMIN_EMAIL", "admin@semed.local")
        admin_password = os.getenv("SEED_ADMIN_PASSWORD", "Admin123!")

        admin, _ = User.objects.get_or_create(
            email=admin_email,
            defaults={
                "name": "Admin SEMED",
                "role": User.Roles.SEMED_ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        admin.name = admin.name or "Admin SEMED"
        admin.role = User.Roles.SEMED_ADMIN
        admin.is_staff = True
        admin.is_superuser = True
        admin.set_password(admin_password)
        admin.save()

        nutritionist, _ = User.objects.get_or_create(
            email="nutri.demo@semed.local",
            defaults={
                "name": "Ana Paula Nutricionista",
                "role": User.Roles.NUTRITIONIST,
                "is_staff": True,
                "is_superuser": False,
            },
        )
        nutritionist.name = "Ana Paula Nutricionista"
        nutritionist.role = User.Roles.NUTRITIONIST
        nutritionist.is_staff = True
        nutritionist.is_active = True
        nutritionist.set_password("Nutri123!")
        nutritionist.save()
        return {"admin": admin, "nutritionist": nutritionist}

    def _ensure_schools(self):
        schools_data = [
            {"name": "Escola Municipal Joao Cordeiro", "city": "Maceio", "address": "Centro", "is_active": True},
            {"name": "Escola Municipal Maria Lucia", "city": "Maceio", "address": "Benedito Bentes", "is_active": True},
            {"name": "Escola Municipal Santa Rosa", "city": "Maceio", "address": "Tabuleiro", "is_active": True},
            {"name": "Escola Municipal Paulo Freire", "city": "Maceio", "address": "Jacintinho", "is_active": True},
            {"name": "Escola Municipal Desativada Piloto", "city": "Maceio", "address": "Ponta Grossa", "is_active": False},
        ]
        schools = {}
        for data in schools_data:
            school, _ = School.objects.get_or_create(name=data["name"], defaults=data)
            for field, value in data.items():
                setattr(school, field, value)
            school.save()
            schools[data["name"]] = school
        return schools

    def _ensure_supplies(self):
        supplies_data = [
            ("Arroz Agulhinha", "Graos", Supply.Units.KG, "IN_NATURA", "ENERGETICOS", "80"),
            ("Feijao Carioca", "Graos", Supply.Units.KG, "IN_NATURA", "CONSTRUTORES", "70"),
            ("Macarrao Espaguete", "Mercearia", Supply.Units.KG, "PROCESSADOS", "ENERGETICOS", "45"),
            ("Oleo de Soja", "Mercearia", Supply.Units.L, "PROCESSADOS", "ENERGETICOS_EXTRAS", "20"),
            ("Leite Integral", "Laticinios", Supply.Units.L, "PROCESSADOS", "CONSTRUTORES", "35"),
            ("Frango Congelado", "Proteinas", Supply.Units.KG, "PROCESSADOS", "CONSTRUTORES", "60"),
            ("Carne Moida", "Proteinas", Supply.Units.KG, "PROCESSADOS", "CONSTRUTORES", "30"),
            ("Banana Prata", "Hortifruti", Supply.Units.KG, "IN_NATURA", "REGULADORES", "25"),
            ("Cenoura", "Hortifruti", Supply.Units.KG, "IN_NATURA", "REGULADORES", "18"),
            ("Farinha de Mandioca", "Mercearia", Supply.Units.KG, "PROCESSADOS", "ENERGETICOS", "12"),
            ("Biscoito Integral", "Lanches", Supply.Units.KG, "ULTRAPROCESSADOS", "ENERGETICOS_EXTRAS", "10"),
            ("Suco de Caju", "Bebidas", Supply.Units.L, "PROCESSADOS", "REGULADORES", "22"),
        ]
        supplies = {}
        for name, category, unit, nova, func, min_stock in supplies_data:
            supply, _ = Supply.objects.get_or_create(
                name=name,
                defaults={
                    "category": category,
                    "unit": unit,
                    "nova_classification": nova,
                    "nutritional_function": func,
                    "min_stock": Decimal(min_stock),
                    "is_active": True,
                },
            )
            supply.category = category
            supply.unit = unit
            supply.nova_classification = nova
            supply.nutritional_function = func
            supply.min_stock = Decimal(min_stock)
            supply.is_active = True
            supply.save()
            supplies[name] = supply
        return supplies

    def _ensure_responsibles(self):
        responsibles_data = [
            ("Carlos Motorista", "Motorista", "(82) 99999-1001"),
            ("Marta Almoxarife", "Almoxarife", "(82) 99999-1002"),
            ("Juliana Diretora", "Diretora", "(82) 99999-1003"),
            ("Roberto Estoquista", "Estoquista", "(82) 99999-1004"),
        ]
        responsibles = {}
        for name, position, phone in responsibles_data:
            person, _ = Responsible.objects.get_or_create(
                name=name,
                defaults={"position": position, "phone": phone, "is_active": True},
            )
            person.position = position
            person.phone = phone
            person.is_active = True
            person.save()
            responsibles[name] = person
        return responsibles

    def _reset_demo_generated(self):
        Notification.objects.filter(message__icontains=DEMO_MARKER).delete()
        StockMovement.objects.filter(note__icontains=DEMO_MARKER).delete()
        AuditLog.objects.filter(path__icontains="/demo/").delete()

    def _ensure_central_stock(self, admin, supplies):
        central_quantities = {
            "Arroz Agulhinha": Decimal("300"),
            "Feijao Carioca": Decimal("220"),
            "Macarrao Espaguete": Decimal("150"),
            "Oleo de Soja": Decimal("60"),
            "Leite Integral": Decimal("110"),
            "Frango Congelado": Decimal("180"),
            "Carne Moida": Decimal("70"),
            "Banana Prata": Decimal("65"),
            "Cenoura": Decimal("50"),
            "Farinha de Mandioca": Decimal("32"),
            "Biscoito Integral": Decimal("28"),
            "Suco de Caju": Decimal("75"),
        }
        today = date.today()
        for name, qty in central_quantities.items():
            supply = supplies[name]
            balance, _ = StockBalance.objects.get_or_create(supply=supply)
            balance.quantity = qty
            balance.save(update_fields=["quantity"])
            self._ensure_stock_movement(
                supply=supply,
                school=None,
                movement_type=StockMovement.Types.IN,
                quantity=qty,
                movement_date=today - timedelta(days=20),
                note=f"{DEMO_MARKER} Estoque central inicial",
                created_by=admin,
            )

    def _ensure_school_stock(self, admin, schools, supplies):
        stock_plan = {
            "Escola Municipal Joao Cordeiro": {
                "Arroz Agulhinha": ("40", "18"),
                "Feijao Carioca": ("25", "20"),
                "Frango Congelado": ("36", "22"),
                "Leite Integral": ("22", "16"),
                "Banana Prata": ("15", "12"),
                "Suco de Caju": ("10", "8"),
            },
            "Escola Municipal Maria Lucia": {
                "Arroz Agulhinha": ("28", "20"),
                "Feijao Carioca": ("14", "18"),
                "Macarrao Espaguete": ("21", "12"),
                "Frango Congelado": ("18", "18"),
                "Cenoura": ("7", "9"),
                "Leite Integral": ("12", "14"),
            },
            "Escola Municipal Santa Rosa": {
                "Arroz Agulhinha": ("33", "18"),
                "Feijao Carioca": ("23", "16"),
                "Carne Moida": ("9", "10"),
                "Banana Prata": ("11", "10"),
                "Biscoito Integral": ("8", "6"),
                "Suco de Caju": ("14", "9"),
            },
            "Escola Municipal Paulo Freire": {
                "Arroz Agulhinha": ("20", "15"),
                "Feijao Carioca": ("19", "14"),
                "Macarrao Espaguete": ("16", "11"),
                "Leite Integral": ("9", "12"),
                "Cenoura": ("5", "7"),
                "Farinha de Mandioca": ("6", "4"),
            },
        }
        today = date.today()
        for school_name, supply_map in stock_plan.items():
            school = schools[school_name]
            for supply_name, (qty, min_qty) in supply_map.items():
                supply = supplies[supply_name]
                school_balance, _ = SchoolStockBalance.objects.get_or_create(
                    school=school,
                    supply=supply,
                    defaults={"quantity": Decimal(qty), "min_stock": Decimal(min_qty)},
                )
                school_balance.quantity = Decimal(qty)
                school_balance.min_stock = Decimal(min_qty)
                school_balance.save()

        # Generate monthly outflows for dashboard charts and reports
        for month_offset in range(0, 5):
            base_date = (today.replace(day=15) - timedelta(days=30 * month_offset))
            for idx, school_name in enumerate(list(stock_plan.keys())[:3]):
                school = schools[school_name]
                for supply_name in ["Arroz Agulhinha", "Feijao Carioca", "Frango Congelado"]:
                    qty = Decimal(str(8 + month_offset + idx))
                    self._ensure_stock_movement(
                        supply=supplies[supply_name],
                        school=school,
                        movement_type=StockMovement.Types.OUT,
                        quantity=qty,
                        movement_date=base_date,
                        note=f"{DEMO_MARKER} Consumo mensal demonstracao {month_offset}",
                        created_by=admin,
                    )

        # Additional school inflow records (manual adjustments/previous conferences)
        self._ensure_stock_movement(
            supply=supplies["Feijao Carioca"],
            school=schools["Escola Municipal Maria Lucia"],
            movement_type=StockMovement.Types.IN,
            quantity=Decimal("5"),
            movement_date=today - timedelta(days=3),
            note=f"{DEMO_MARKER} Ajuste local por conferencia",
            created_by=admin,
        )

    def _ensure_menus(self, admin, schools):
        today = date.today()
        current_week_start = today - timedelta(days=today.weekday())
        previous_week_start = current_week_start - timedelta(days=7)
        next_week_start = current_week_start + timedelta(days=7)

        for school_name in [
            "Escola Municipal Joao Cordeiro",
            "Escola Municipal Maria Lucia",
            "Escola Municipal Santa Rosa",
            "Escola Municipal Paulo Freire",
        ]:
            school = schools[school_name]
            self._upsert_menu(
                admin,
                school,
                current_week_start,
                status=Menu.Status.PUBLISHED,
                name=f"Cardapio Semanal {school.name} {current_week_start.strftime('%d/%m')}",
                notes=f"{DEMO_MARKER} Cardapio oficial da semana",
                author_name="Ana Paula Nutricionista",
                author_crn="CRN-6 12345",
                published=True,
            )
            self._upsert_menu(
                admin,
                school,
                previous_week_start,
                status=Menu.Status.PUBLISHED,
                name=f"Cardapio Semana Anterior {school.name}",
                notes=f"{DEMO_MARKER} Historico",
                author_name="Ana Paula Nutricionista",
                author_crn="CRN-6 12345",
                published=True,
            )

        # Draft menu for editor workflow demo
        self._upsert_menu(
            admin,
            schools["Escola Municipal Joao Cordeiro"],
            next_week_start,
            status=Menu.Status.DRAFT,
            name="Cardapio em Elaboracao (Proxima Semana)",
            notes=f"{DEMO_MARKER} Rascunho para aprovacao",
            author_name="Ana Paula Nutricionista",
            author_crn="CRN-6 12345",
            published=False,
        )

    def _upsert_menu(self, admin, school, week_start, status, name, notes, author_name, author_crn, published):
        week_end = week_start + timedelta(days=4)
        menu, _ = Menu.objects.get_or_create(
            school=school,
            week_start=week_start,
            defaults={
                "week_end": week_end,
                "status": status,
                "name": name,
                "notes": notes,
                "author_name": author_name,
                "author_crn": author_crn,
                "created_by": admin,
            },
        )
        menu.week_end = week_end
        menu.status = status
        menu.name = name
        menu.notes = notes
        menu.author_name = author_name
        menu.author_crn = author_crn
        menu.created_by = admin
        menu.published_at = timezone.now() - timedelta(hours=2) if published else None
        menu.save()

        MenuItem.objects.filter(menu=menu).delete()
        days = [
            (MenuItem.DayOfWeek.MON, "Arroz, feijao, frango e salada de cenoura"),
            (MenuItem.DayOfWeek.TUE, "Macarrao com carne moida e banana"),
            (MenuItem.DayOfWeek.WED, "Arroz, feijao e frango ensopado"),
            (MenuItem.DayOfWeek.THU, "Arroz, farofa, carne moida e salada"),
            (MenuItem.DayOfWeek.FRI, "Arroz, feijao tropeiro e fruta"),
        ]
        items = []
        for day_code, lunch_text in days:
            items.extend(
                [
                    MenuItem(
                        menu=menu,
                        day_of_week=day_code,
                        meal_type=MenuItem.MealType.BREAKFAST_1,
                        meal_name="Desjejum",
                        portion_text="1 copo + 1 unidade",
                        description="Leite integral e biscoito integral",
                    ),
                    MenuItem(
                        menu=menu,
                        day_of_week=day_code,
                        meal_type=MenuItem.MealType.LUNCH,
                        meal_name="Almoco",
                        portion_text="Porcao escolar",
                        description=lunch_text,
                    ),
                    MenuItem(
                        menu=menu,
                        day_of_week=day_code,
                        meal_type=MenuItem.MealType.SNACK_2,
                        meal_name="Lanche da tarde",
                        portion_text="1 copo",
                        description="Suco de caju e banana",
                    ),
                ]
            )
        MenuItem.objects.bulk_create(items)
        return menu

    def _ensure_meal_service_reports(self, schools):
        today = date.today()
        target_schools = [
            schools["Escola Municipal Joao Cordeiro"],
            schools["Escola Municipal Maria Lucia"],
            schools["Escola Municipal Santa Rosa"],
        ]
        for day_delta in range(0, 5):
            service_date = today - timedelta(days=day_delta)
            if service_date.weekday() > 4:
                continue
            for school in target_schools:
                menu = (
                    Menu.objects.filter(
                        school=school,
                        status=Menu.Status.PUBLISHED,
                        week_start__lte=service_date,
                        week_end__gte=service_date,
                    )
                    .order_by("-week_start")
                    .first()
                )
                report, _ = MealServiceReport.objects.get_or_create(
                    school=school,
                    service_date=service_date,
                    defaults={"menu": menu},
                )
                report.menu = menu
                report.save(update_fields=["menu", "updated_at"])

                entries_plan = [
                    (MenuItem.MealType.BREAKFAST_1, "Desjejum", 120 - day_delta * 3),
                    (MenuItem.MealType.LUNCH, "Almoco", 180 - day_delta * 4),
                    (MenuItem.MealType.SNACK_2, "Lanche da tarde", 110 - day_delta * 2),
                ]
                for meal_type, label, served_count in entries_plan:
                    entry, _ = MealServiceEntry.objects.get_or_create(
                        report=report,
                        meal_type=meal_type,
                        defaults={"meal_label": label, "served_count": served_count},
                    )
                    entry.meal_label = label
                    entry.served_count = max(served_count, 0)
                    entry.save(update_fields=["meal_label", "served_count"])

    def _ensure_deliveries(self, admin, schools, supplies, responsibles):
        today = date.today()
        deliveries = {}

        delivery_specs = [
            {
                "key": "conferred_recent",
                "school": schools["Escola Municipal Maria Lucia"],
                "delivery_date": today - timedelta(days=1),
                "status": Delivery.Status.CONFERRED,
                "conference_enabled": True,
                "notes": f"{DEMO_MARKER} Entrega conferida com divergencia para demonstracao",
                "sender": responsibles["Carlos Motorista"],
                "items": [
                    ("Arroz Agulhinha", "20", "20", ""),
                    ("Feijao Carioca", "15", "13", "2kg abaixo por avaria"),
                    ("Leite Integral", "12", "12", ""),
                ],
                "sender_signed_by": "Carlos Motorista",
                "receiver_signed_by": "Juliana Diretora",
                "sent_hours_ago": 28,
                "conferred_hours_ago": 24,
            },
            {
                "key": "sent_open_public",
                "school": schools["Escola Municipal Joao Cordeiro"],
                "delivery_date": today,
                "status": Delivery.Status.SENT,
                "conference_enabled": True,
                "notes": f"{DEMO_MARKER} Entrega aberta para conferencia publica",
                "sender": responsibles["Marta Almoxarife"],
                "items": [
                    ("Arroz Agulhinha", "18", None, ""),
                    ("Frango Congelado", "14", None, ""),
                    ("Banana Prata", "9", None, ""),
                    ("Suco de Caju", "7", None, ""),
                ],
                "sender_signed_by": "",
                "receiver_signed_by": "",
                "sent_hours_ago": 2,
                "conferred_hours_ago": None,
            },
            {
                "key": "draft_future",
                "school": schools["Escola Municipal Paulo Freire"],
                "delivery_date": today + timedelta(days=1),
                "status": Delivery.Status.DRAFT,
                "conference_enabled": False,
                "notes": f"{DEMO_MARKER} Entrega em rascunho para planejamento",
                "sender": responsibles["Roberto Estoquista"],
                "items": [
                    ("Macarrao Espaguete", "10", None, ""),
                    ("Carne Moida", "8", None, ""),
                    ("Cenoura", "5", None, ""),
                ],
                "sender_signed_by": "",
                "receiver_signed_by": "",
                "sent_hours_ago": None,
                "conferred_hours_ago": None,
            },
        ]

        for spec in delivery_specs:
            delivery, _ = Delivery.objects.get_or_create(
                school=spec["school"],
                delivery_date=spec["delivery_date"],
                notes=spec["notes"],
                defaults={
                    "sender": spec["sender"],
                    "status": spec["status"],
                    "conference_enabled": spec["conference_enabled"],
                    "created_by": admin,
                    "responsible_name": spec["sender"].name,
                    "responsible_phone": spec["sender"].phone,
                },
            )
            delivery.sender = spec["sender"]
            delivery.created_by = admin
            delivery.responsible_name = spec["sender"].name
            delivery.responsible_phone = spec["sender"].phone
            delivery.status = spec["status"]
            delivery.conference_enabled = spec["conference_enabled"]
            delivery.sent_at = (
                timezone.now() - timedelta(hours=spec["sent_hours_ago"])
                if spec["sent_hours_ago"] is not None else None
            )
            delivery.conference_submitted_at = (
                timezone.now() - timedelta(hours=spec["conferred_hours_ago"])
                if spec["conferred_hours_ago"] is not None else None
            )
            if spec["status"] == Delivery.Status.CONFERRED:
                delivery.sender_signature = FAKE_SIGNATURE
                delivery.receiver_signature = FAKE_SIGNATURE
                delivery.conference_signature = FAKE_SIGNATURE
                delivery.sender_signed_by = spec["sender_signed_by"]
                delivery.receiver_signed_by = spec["receiver_signed_by"]
                delivery.conference_signed_by = spec["receiver_signed_by"]
            else:
                delivery.sender_signature = ""
                delivery.receiver_signature = ""
                delivery.conference_signature = ""
                delivery.sender_signed_by = spec["sender_signed_by"]
                delivery.receiver_signed_by = spec["receiver_signed_by"]
                delivery.conference_signed_by = spec["receiver_signed_by"]
            delivery.save()

            DeliveryItem.objects.filter(delivery=delivery).delete()
            item_objs = []
            for supply_name, planned, received, divergence_note in spec["items"]:
                item_objs.append(
                    DeliveryItem(
                        delivery=delivery,
                        supply=supplies[supply_name],
                        planned_quantity=Decimal(planned),
                        received_quantity=Decimal(received) if received is not None else None,
                        divergence_note=divergence_note,
                    )
                )
            DeliveryItem.objects.bulk_create(item_objs)
            deliveries[spec["key"]] = delivery

            if spec["status"] == Delivery.Status.CONFERRED:
                for supply_name, planned, received, divergence_note in spec["items"]:
                    actual = Decimal(received or planned)
                    self._ensure_stock_movement(
                        supply=supplies[supply_name],
                        school=delivery.school,
                        movement_type=StockMovement.Types.IN,
                        quantity=actual,
                        movement_date=delivery.delivery_date,
                        note=f"{DEMO_MARKER} Entrada confirmada de entrega {delivery.id}",
                        created_by=admin,
                    )
                    if divergence_note and Decimal(planned) > actual:
                        self._ensure_stock_movement(
                            supply=supplies[supply_name],
                            school=delivery.school,
                            movement_type=StockMovement.Types.IN,
                            quantity=(Decimal(planned) - actual),
                            movement_date=delivery.delivery_date,
                            note=f"{DEMO_MARKER} Ajuste de conferencia (falta) {delivery.id}",
                            created_by=admin,
                        )

        return deliveries

    def _ensure_suppliers_and_receipts(self, admin, schools, supplies):
        suppliers_data = [
            {
                "name": "Cooperativa Alimentos do Agreste",
                "document": "12.345.678/0001-11",
                "contact_name": "Marcos Silva",
                "phone": "(82) 98888-2001",
                "email": "contato@cooperagreste.demo",
                "address": "Rodovia AL-101, km 14",
            },
            {
                "name": "Distribuidora Nordeste Escolar",
                "document": "98.765.432/0001-22",
                "contact_name": "Luciana Costa",
                "phone": "(82) 98888-2002",
                "email": "vendas@nordesteescolar.demo",
                "address": "Av. Industrial, 450",
            },
            {
                "name": "HortiVida Fornecimentos",
                "document": "44.555.666/0001-33",
                "contact_name": "Pedro Ramos",
                "phone": "(82) 98888-2003",
                "email": "comercial@hortivida.demo",
                "address": "Mercado do Produtor, box 17",
            },
        ]
        suppliers = {}
        for data in suppliers_data:
            supplier, _ = Supplier.objects.get_or_create(name=data["name"], defaults=data)
            for field, value in data.items():
                setattr(supplier, field, value)
            supplier.is_active = True
            supplier.save()
            suppliers[data["name"]] = supplier

        today = date.today()
        receipt_specs = [
            {
                "supplier": suppliers["Cooperativa Alimentos do Agreste"],
                "school": schools["Escola Municipal Joao Cordeiro"],
                "expected_date": today - timedelta(days=2),
                "status": SupplierReceipt.Status.CONFERRED,
                "notes": f"{DEMO_MARKER} Recebimento conferido da cooperativa",
                "sender_signed_by": "Marcos Silva",
                "receiver_signed_by": "Marta Almoxarife",
                "items": [
                    ("Arroz Agulhinha", None, "Graos", Supply.Units.KG, "35", "35", ""),
                    ("Feijao Carioca", None, "Graos", Supply.Units.KG, "28", "27", "1kg em saco rasgado"),
                    (None, "Polpa de Goiaba", "Polpas", Supply.Units.KG, "12", "12", "Item novo criado na conferencia"),
                ],
            },
            {
                "supplier": suppliers["Distribuidora Nordeste Escolar"],
                "school": schools["Escola Municipal Santa Rosa"],
                "expected_date": today + timedelta(days=1),
                "status": SupplierReceipt.Status.EXPECTED,
                "notes": f"{DEMO_MARKER} Recebimento aguardando entrega",
                "sender_signed_by": "",
                "receiver_signed_by": "",
                "items": [
                    ("Leite Integral", None, "Laticinios", Supply.Units.L, "20", None, ""),
                    ("Biscoito Integral", None, "Lanches", Supply.Units.KG, "10", None, ""),
                ],
            },
            {
                "supplier": suppliers["HortiVida Fornecimentos"],
                "school": None,
                "expected_date": today,
                "status": SupplierReceipt.Status.IN_CONFERENCE,
                "notes": f"{DEMO_MARKER} Recebimento central em conferencia",
                "sender_signed_by": "",
                "receiver_signed_by": "",
                "items": [
                    ("Banana Prata", None, "Hortifruti", Supply.Units.KG, "18", "17", "1kg fora do padrao"),
                    ("Cenoura", None, "Hortifruti", Supply.Units.KG, "14", "14", ""),
                ],
            },
        ]

        for spec in receipt_specs:
            receipt, _ = SupplierReceipt.objects.get_or_create(
                supplier=spec["supplier"],
                expected_date=spec["expected_date"],
                notes=spec["notes"],
                defaults={
                    "school": spec["school"],
                    "status": spec["status"],
                    "created_by": admin,
                },
            )
            receipt.school = spec["school"]
            receipt.status = spec["status"]
            receipt.created_by = admin
            receipt.sender_signature = FAKE_SIGNATURE if spec["status"] == SupplierReceipt.Status.CONFERRED else ""
            receipt.receiver_signature = FAKE_SIGNATURE if spec["status"] == SupplierReceipt.Status.CONFERRED else ""
            receipt.sender_signed_by = spec["sender_signed_by"]
            receipt.receiver_signed_by = spec["receiver_signed_by"]
            if spec["status"] in [SupplierReceipt.Status.IN_CONFERENCE, SupplierReceipt.Status.CONFERRED]:
                receipt.conference_started_at = timezone.now() - timedelta(hours=3)
            else:
                receipt.conference_started_at = None
            if spec["status"] == SupplierReceipt.Status.CONFERRED:
                receipt.conference_finished_at = timezone.now() - timedelta(hours=2)
            else:
                receipt.conference_finished_at = None
            receipt.save()

            SupplierReceiptItem.objects.filter(receipt=receipt).delete()
            created_items = []
            for supply_name, raw_name, category, unit, expected_qty, received_qty, divergence in spec["items"]:
                linked_supply = supplies.get(supply_name) if supply_name else None
                supply_created = None
                if raw_name == "Polpa de Goiaba":
                    supply_created, _ = Supply.objects.get_or_create(
                        name="Polpa de Goiaba",
                        defaults={
                            "category": "Polpas",
                            "unit": Supply.Units.KG,
                            "nova_classification": Supply.NovaClassification.PROCESSADOS,
                            "nutritional_function": Supply.NutritionalFunction.REGULADORES,
                            "min_stock": Decimal("8"),
                        },
                    )
                    linked_supply = None
                created_items.append(
                    SupplierReceiptItem(
                        receipt=receipt,
                        supply=linked_supply,
                        raw_name=raw_name or "",
                        category=category,
                        unit=unit,
                        expected_quantity=Decimal(expected_qty),
                        received_quantity=Decimal(received_qty) if received_qty is not None else None,
                        divergence_note=divergence,
                        supply_created=supply_created,
                    )
                )
            SupplierReceiptItem.objects.bulk_create(created_items)

    def _ensure_notifications(self, schools, deliveries):
        notifications = [
            {
                "notification_type": Notification.NotificationType.DELIVERY_WITH_NOTE,
                "title": "Entrega conferida com observacao",
                "message": f"{DEMO_MARKER} Entrega de Maria Lucia conferida com divergencia de feijao.",
                "delivery": deliveries.get("conferred_recent"),
                "school": schools["Escola Municipal Maria Lucia"],
                "is_alert": True,
                "is_read": False,
            },
            {
                "notification_type": Notification.NotificationType.DELIVERY_CONFERRED,
                "title": "Entrega conferida sem divergencias",
                "message": f"{DEMO_MARKER} Ultima conferencia validada na Escola Municipal Santa Rosa.",
                "delivery": None,
                "school": schools["Escola Municipal Santa Rosa"],
                "is_alert": False,
                "is_read": True,
            },
            {
                "notification_type": Notification.NotificationType.DELIVERY_DIVERGENCE,
                "title": "Alerta de estoque baixo",
                "message": f"{DEMO_MARKER} Feijao/Cenoura abaixo do minimo em escolas da rede.",
                "delivery": None,
                "school": schools["Escola Municipal Maria Lucia"],
                "is_alert": True,
                "is_read": False,
            },
        ]
        for data in notifications:
            notification, _ = Notification.objects.get_or_create(
                notification_type=data["notification_type"],
                title=data["title"],
                message=data["message"],
                school=data["school"],
                delivery=data["delivery"],
                defaults={"is_alert": data["is_alert"], "is_read": data["is_read"]},
            )
            notification.is_alert = data["is_alert"]
            notification.is_read = data["is_read"]
            notification.save(update_fields=["is_alert", "is_read"])

    def _ensure_audit_logs(self, users):
        logs = [
            {
                "user": users["admin"],
                "action_type": AuditLog.ActionTypes.CREATE,
                "method": "POST",
                "path": "/api/demo/deliveries/",
                "action_route": "deliveries.create",
                "status_code": 201,
                "request_payload": {"school": "Joao Cordeiro", "items": 4, "source": DEMO_MARKER},
                "payload_after": {"status": "SENT", "conference_enabled": True},
            },
            {
                "user": users["nutritionist"],
                "action_type": AuditLog.ActionTypes.UPDATE,
                "method": "PATCH",
                "path": "/api/demo/menus/current/",
                "action_route": "menus.publish",
                "status_code": 200,
                "request_payload": {"status": "PUBLISHED", "source": DEMO_MARKER},
                "payload_before": {"status": "DRAFT"},
                "payload_after": {"status": "PUBLISHED"},
            },
            {
                "user": users["admin"],
                "action_type": AuditLog.ActionTypes.DELETE,
                "method": "DELETE",
                "path": "/api/demo/notifications/old/",
                "action_route": "notifications.delete",
                "status_code": 204,
                "request_payload": {"source": DEMO_MARKER},
            },
        ]
        for data in logs:
            AuditLog.objects.get_or_create(
                user=data["user"],
                method=data["method"],
                path=data["path"],
                action_type=data["action_type"],
                action_route=data["action_route"],
                status_code=data["status_code"],
                defaults={
                    "ip_address": "127.0.0.1",
                    "request_payload": data.get("request_payload"),
                    "payload_before": data.get("payload_before"),
                    "payload_after": data.get("payload_after"),
                },
            )

    def _ensure_stock_movement(self, supply, school, movement_type, quantity, movement_date, note, created_by):
        StockMovement.objects.get_or_create(
            supply=supply,
            school=school,
            type=movement_type,
            quantity=quantity,
            movement_date=movement_date,
            note=note,
            created_by=created_by,
        )
