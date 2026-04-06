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
    DeliveryItemLot,
    DeliveryNutritionistSignature,
    LotBalanceCentral,
    LotBalanceSchool,
    Notification,
    Responsible,
    SchoolStockBalance,
    StockBalance,
    StockMovement,
    Supplier,
    SupplierReceipt,
    SupplierReceiptItem,
    SupplierReceiptItemLot,
    Supply,
    SupplyLot,
)
from inventory.services.lots import credit_lot_central, credit_lot_school, get_or_create_supply_lot, regenerate_delivery_item_lot_plan_fefo
from menus.models import MealServiceEntry, MealServiceReport, Menu, MenuItem
from pnae.models import (
    PnaeAcceptabilityTest,
    PnaeAnnualAction,
    PnaeAnnualBudgetItem,
    PnaeAnnualEvaluationTool,
    PnaeAnnualGoal,
    PnaeAnnualPlan,
    PnaeAnnualPlanItem,
    PnaeAnnualPlanMonthlyExecution,
    PnaeAnnualPlanWorkflowEvent,
    PnaeAnnualScheduleEntry,
)
from production.models import PublicCalculatorLink, SupplyAlias, SupplyConsumptionRule
from recipes.models import Recipe, RecipeIngredient
from schools.models import EducationModality, EducationStage, Municipality, School


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
            municipalities = self._ensure_municipalities()
            education_stages = self._ensure_education_stages()
            education_modalities = self._ensure_education_modalities()
            users = self._ensure_users(municipalities)
            schools = self._ensure_schools(municipalities, education_stages, education_modalities)
            supplies = self._ensure_supplies()
            responsibles = self._ensure_responsibles()

            if options.get("reset_demo_generated"):
                self._reset_demo_generated()

            self._ensure_central_stock(users["admin"], supplies)
            self._ensure_school_stock(users["admin"], schools, supplies)
            recipes = self._ensure_recipes(supplies)
            self._ensure_menus(users["admin"], schools)
            self._attach_recipes_to_menus(recipes)
            self._ensure_meal_service_reports(schools)
            deliveries = self._ensure_deliveries(users["admin"], schools, supplies, responsibles)
            self._ensure_delivery_nutritionist_signatures(deliveries, users)
            suppliers = self._ensure_suppliers_and_receipts(users["admin"], schools, supplies)
            self._ensure_lot_tracking_data(schools, supplies, suppliers, deliveries)
            self._ensure_production_data(schools, supplies)
            self._ensure_pnae_data(users, schools, education_stages, education_modalities, recipes)
            self._ensure_notifications(schools, deliveries)
            self._ensure_audit_logs(users)

        self.stdout.write(self.style.SUCCESS("Super populate demo concluido."))
        self.stdout.write(self.style.WARNING(f"Marcador: {DEMO_MARKER}"))
        self.stdout.write(self.style.WARNING("Links publicos de demo:"))
        for school in School.objects.filter(name__icontains="Escola Municipal", is_active=True).order_by("name")[:4]:
            self.stdout.write(
                f"- {school.name}: /public/meal-service?slug={school.public_slug}&token={school.public_token}"
            )

    def _ensure_municipalities(self):
        municipalities = {}
        specs = [
            {"name": "Maceio", "state": "AL", "code": "2704302", "is_active": True},
            {"name": "Arapiraca", "state": "AL", "code": "2700300", "is_active": True},
        ]
        for spec in specs:
            municipality, _ = Municipality.objects.get_or_create(
                code=spec["code"],
                defaults=spec,
            )
            for field, value in spec.items():
                setattr(municipality, field, value)
            municipality.save()
            municipalities[spec["name"]] = municipality
        return municipalities

    def _ensure_education_stages(self):
        stages = {}
        specs = [
            ("Creche I", "CRECHE-I", 0, 3),
            ("Pre-escola", "PRE", 4, 5),
            ("Ensino Fundamental I", "EFI", 6, 10),
            ("Ensino Fundamental II", "EFII", 11, 14),
            ("EJA", "EJA", 15, None),
        ]
        for name, code, age_start, age_end in specs:
            stage, _ = EducationStage.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "age_range_start": age_start,
                    "age_range_end": age_end,
                    "is_active": True,
                },
            )
            stage.name = name
            stage.age_range_start = age_start
            stage.age_range_end = age_end
            stage.is_active = True
            stage.save()
            stages[code] = stage
        return stages

    def _ensure_education_modalities(self):
        modalities = {}
        specs = [
            ("Regular", "REG"),
            ("Integral", "INT"),
            ("Quilombola", "QUIL"),
            ("Indigena", "IND"),
            ("EJA", "EJA"),
        ]
        for name, code in specs:
            modality, _ = EducationModality.objects.get_or_create(
                code=code,
                defaults={"name": name, "is_active": True},
            )
            modality.name = name
            modality.is_active = True
            modality.save()
            modalities[code] = modality
        return modalities

    def _ensure_users(self, municipalities):
        User = get_user_model()
        admin_email = os.getenv("SEED_ADMIN_EMAIL", "admin@semed.local")
        admin_password = os.getenv("SEED_ADMIN_PASSWORD", "Admin123!")
        maceio = municipalities["Maceio"]
        arapiraca = municipalities["Arapiraca"]

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
        admin.function_role = "Administrador da plataforma"
        admin.municipality = maceio
        admin.is_staff = True
        admin.is_superuser = True
        admin.is_active = True
        admin.set_password(admin_password)
        admin.save()

        users = {"admin": admin}
        role_specs = [
            ("nutritionist", "nutri.demo@semed.local", "Ana Paula Nutricionista", User.Roles.NUTRITIONIST, maceio, True, "CRN-6 12345", "Responsavel tecnica"),
            ("municipal_manager", "gestor.demo@semed.local", "Carlos Gestor Municipal", User.Roles.MUNICIPAL_MANAGER, maceio, True, "", "Gestao municipal"),
            ("school_coordinator", "coordenacao.escolar@semed.local", "Mariana Coordenadora", User.Roles.SCHOOL_FEEDING_COORDINATOR, maceio, False, "", "Coordenacao escolar"),
            ("school_director", "direcao.demo@semed.local", "Juliana Diretora", User.Roles.SCHOOL_DIRECTOR, maceio, False, "", "Direcao escolar"),
            ("school_operator", "merendeira.demo@semed.local", "Rita Merendeira", User.Roles.SCHOOL_OPERATOR, maceio, False, "", "Merendeira"),
            ("stock_operator", "estoque.demo@semed.local", "Roberto Estoquista", User.Roles.STOCK_OPERATOR, maceio, False, "", "Operador de estoque"),
            ("cae", "cae.demo@semed.local", "Paulo Conselheiro", User.Roles.CAE_COUNCILOR, maceio, False, "", "Conselheiro CAE"),
            ("external_manager", "gestor.arapiraca@semed.local", "Fernanda Gestora Externa", User.Roles.MUNICIPAL_MANAGER, arapiraca, False, "", "Gestao municipal"),
        ]
        for key, email, name, role, municipality, is_staff, crn, function_role in role_specs:
            user, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    "name": name,
                    "role": role,
                    "municipality": municipality,
                    "is_staff": is_staff,
                    "is_superuser": False,
                    "crn": crn,
                    "function_role": function_role,
                },
            )
            user.name = name
            user.role = role
            user.municipality = municipality
            user.is_staff = is_staff
            user.is_superuser = False
            user.is_active = True
            user.crn = crn
            user.function_role = function_role
            user.set_password("Demo123!")
            user.save()
            users[key] = user

        return users

    def _ensure_schools(self, municipalities, education_stages, education_modalities):
        schools_data = [
            {
                "name": "Escola Municipal Joao Cordeiro",
                "city": "Maceio",
                "address": "Centro",
                "is_active": True,
                "municipality": municipalities["Maceio"],
                "stages": ["EFI", "EFII"],
                "modalities": ["REG", "INT"],
            },
            {
                "name": "Escola Municipal Maria Lucia",
                "city": "Maceio",
                "address": "Benedito Bentes",
                "is_active": True,
                "municipality": municipalities["Maceio"],
                "stages": ["PRE", "EFI"],
                "modalities": ["REG", "INT"],
            },
            {
                "name": "Escola Municipal Santa Rosa",
                "city": "Maceio",
                "address": "Tabuleiro",
                "is_active": True,
                "municipality": municipalities["Maceio"],
                "stages": ["CRECHE-I", "PRE", "EFI"],
                "modalities": ["REG", "QUIL"],
            },
            {
                "name": "Escola Municipal Paulo Freire",
                "city": "Maceio",
                "address": "Jacintinho",
                "is_active": True,
                "municipality": municipalities["Maceio"],
                "stages": ["EFI", "EFII", "EJA"],
                "modalities": ["REG", "EJA"],
            },
            {
                "name": "Escola Municipal Desativada Piloto",
                "city": "Maceio",
                "address": "Ponta Grossa",
                "is_active": False,
                "municipality": municipalities["Maceio"],
                "stages": ["EFI"],
                "modalities": ["REG"],
            },
        ]
        schools = {}
        for data in schools_data:
            defaults = {key: value for key, value in data.items() if key not in {"stages", "modalities"}}
            school, _ = School.objects.get_or_create(name=data["name"], defaults=defaults)
            for field, value in defaults.items():
                setattr(school, field, value)
            school.save()
            school.education_stages.set([education_stages[code] for code in data["stages"]])
            school.education_modalities.set([education_modalities[code] for code in data["modalities"]])
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

    def _ensure_recipes(self, supplies):
        recipes_spec = [
            {
                "name": "Arroz com Frango e Legumes",
                "category": "Almoço",
                "servings_base": 100,
                "instructions": "1. Higienizar insumos.\n2. Refogar frango.\n3. Cozinhar arroz.\n4. Finalizar com cenoura.",
                "ingredients": [
                    ("Arroz Agulhinha", "10", Supply.Units.KG),
                    ("Frango Congelado", "5", Supply.Units.KG),
                    ("Cenoura", "2", Supply.Units.KG),
                    ("Oleo de Soja", "0.6", Supply.Units.L),
                ],
            },
            {
                "name": "Leite com Biscoito",
                "category": "Lanche",
                "servings_base": 100,
                "instructions": "1. Aquecer leite.\n2. Porcionar biscoito.\n3. Servir.",
                "ingredients": [
                    ("Leite Integral", "8", Supply.Units.L),
                    ("Biscoito Integral", "3", Supply.Units.KG),
                ],
            },
            {
                "name": "Suco de Caju com Banana",
                "category": "Lanche",
                "servings_base": 100,
                "instructions": "1. Preparar suco.\n2. Higienizar e porcionar banana.",
                "ingredients": [
                    ("Suco de Caju", "10", Supply.Units.L),
                    ("Banana Prata", "8", Supply.Units.KG),
                ],
            },
        ]
        result = {}
        for spec in recipes_spec:
            recipe, _ = Recipe.objects.get_or_create(
                name=spec["name"],
                defaults={
                    "category": spec["category"],
                    "servings_base": spec["servings_base"],
                    "instructions": spec["instructions"],
                    "active": True,
                    "tags": {"demo_marker": DEMO_MARKER, "steps_enabled": True},
                },
            )
            recipe.category = spec["category"]
            recipe.servings_base = spec["servings_base"]
            recipe.instructions = spec["instructions"]
            recipe.active = True
            tags = dict(recipe.tags or {})
            tags.update({"demo_marker": DEMO_MARKER, "steps_enabled": True})
            recipe.tags = tags
            recipe.save()

            RecipeIngredient.objects.filter(recipe=recipe).delete()
            RecipeIngredient.objects.bulk_create([
                RecipeIngredient(
                    recipe=recipe,
                    supply=supplies[supply_name],
                    qty_base=Decimal(qty),
                    unit=unit,
                )
                for supply_name, qty, unit in spec["ingredients"]
            ])
            result[spec["name"]] = recipe
        return result

    def _attach_recipes_to_menus(self, recipes):
        recipe_by_meal = {
            "Almoco": recipes.get("Arroz com Frango e Legumes"),
            "Desjejum": recipes.get("Leite com Biscoito"),
            "Lanche da tarde": recipes.get("Suco de Caju com Banana"),
        }
        for item in MenuItem.objects.select_related("menu").filter(menu__notes__icontains=DEMO_MARKER):
            recipe = recipe_by_meal.get(item.meal_name or "")
            if recipe:
                item.recipe = recipe
                item.calc_mode = MenuItem.CalcMode.RECIPE
                item.save(update_fields=["recipe", "calc_mode"])

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

    def _ensure_delivery_nutritionist_signatures(self, deliveries, users):
        if "conferred_recent" in deliveries:
            DeliveryNutritionistSignature.objects.update_or_create(
                delivery=deliveries["conferred_recent"],
                name=users["nutritionist"].name,
                defaults={
                    "crn": users["nutritionist"].crn,
                    "function_role": users["nutritionist"].function_role,
                    "signature_data": FAKE_SIGNATURE,
                },
            )

    def _ensure_production_data(self, schools, supplies):
        alias_specs = [
            ("Arroz Agulhinha", ["arroz branco", "arroz tipo 1", "arroz beneficiado"]),
            ("Feijao Carioca", ["feijao", "feijao tipo carioca"]),
            ("Leite Integral", ["leite", "leite uht"]),
            ("Banana Prata", ["banana", "banana prata"]),
            ("Suco de Caju", ["suco", "suco caju"]),
        ]
        for supply_name, aliases in alias_specs:
            supply = supplies[supply_name]
            for alias in aliases:
                SupplyAlias.objects.get_or_create(supply=supply, alias=alias)

        self._upsert_public_calculator_link(
            schools["Escola Municipal Joao Cordeiro"],
            PublicCalculatorLink.AllowedScope.MENU_WEEK,
        )
        self._upsert_public_calculator_link(
            schools["Escola Municipal Maria Lucia"],
            PublicCalculatorLink.AllowedScope.MENU_DAY,
        )
        self._upsert_public_calculator_link(
            schools["Escola Municipal Santa Rosa"],
            PublicCalculatorLink.AllowedScope.RECIPE_ONLY,
        )

        rules = [
            ("Escola Municipal Joao Cordeiro", "Arroz Agulhinha", MenuItem.MealType.LUNCH, "0.080", Supply.Units.KG, "Base para almoco regular"),
            ("Escola Municipal Joao Cordeiro", "Feijao Carioca", MenuItem.MealType.LUNCH, "0.060", Supply.Units.KG, "Feijao por aluno"),
            ("Escola Municipal Maria Lucia", "Leite Integral", MenuItem.MealType.BREAKFAST_1, "0.200", Supply.Units.L, "Copo de leite"),
            ("Escola Municipal Maria Lucia", "Biscoito Integral", MenuItem.MealType.BREAKFAST_1, "0.030", Supply.Units.KG, "Biscoito por aluno"),
            ("Escola Municipal Santa Rosa", "Suco de Caju", MenuItem.MealType.SNACK_2, "0.180", Supply.Units.L, "Lanche vespertino"),
            ("Escola Municipal Santa Rosa", "Banana Prata", MenuItem.MealType.SNACK_2, "0.070", Supply.Units.KG, "Fruta por aluno"),
            ("Escola Municipal Paulo Freire", "Macarrao Espaguete", MenuItem.MealType.LUNCH, "0.075", Supply.Units.KG, "Preparacao de massa"),
            ("Escola Municipal Paulo Freire", "Carne Moida", MenuItem.MealType.LUNCH, "0.045", Supply.Units.KG, "Proteina principal"),
        ]
        for school_name, supply_name, meal_type, qty_per_student, unit, notes in rules:
            SupplyConsumptionRule.objects.update_or_create(
                school=schools[school_name],
                supply=supplies[supply_name],
                meal_type=meal_type,
                defaults={
                    "qty_per_student": Decimal(qty_per_student),
                    "unit": unit,
                    "active": True,
                    "notes": f"{DEMO_MARKER} {notes}",
                },
            )

    def _upsert_public_calculator_link(self, school, allowed_scope):
        existing_links = PublicCalculatorLink.objects.filter(school=school).order_by("created_at")
        link = existing_links.first()
        if link is None:
            return PublicCalculatorLink.objects.create(
                school=school,
                allowed_scope=allowed_scope,
                is_active=True,
            )

        existing_links.exclude(pk=link.pk).delete()
        link.allowed_scope = allowed_scope
        link.is_active = True
        link.save(update_fields=["allowed_scope", "is_active", "updated_at"])
        return link

    def _ensure_pnae_data(self, users, schools, education_stages, education_modalities, recipes):
        current_year = date.today().year
        plan_specs = [
            {
                "school": schools["Escola Municipal Joao Cordeiro"],
                "year": current_year,
                "title": f"Plano PNAE Integrado {current_year} {DEMO_MARKER}",
                "status": PnaeAnnualPlan.Status.APPROVED,
                "review_comment": f"{DEMO_MARKER} Plano aprovado para operacao anual.",
                "workflow": [
                    (PnaeAnnualPlanWorkflowEvent.Action.CREATED, '', PnaeAnnualPlan.Status.DRAFT, 'Plano criado para demonstracao.'),
                    (PnaeAnnualPlanWorkflowEvent.Action.SUBMITTED, PnaeAnnualPlan.Status.DRAFT, PnaeAnnualPlan.Status.IN_REVIEW, f'{DEMO_MARKER} Submetido para revisao.'),
                    (PnaeAnnualPlanWorkflowEvent.Action.APPROVED, PnaeAnnualPlan.Status.IN_REVIEW, PnaeAnnualPlan.Status.APPROVED, f'{DEMO_MARKER} Aprovado para execucao.'),
                ],
            },
            {
                "school": schools["Escola Municipal Maria Lucia"],
                "year": current_year,
                "title": f"Plano PNAE em Revisao {current_year} {DEMO_MARKER}",
                "status": PnaeAnnualPlan.Status.IN_REVIEW,
                "review_comment": f"{DEMO_MARKER} Aguardando parecer do gestor.",
                "workflow": [
                    (PnaeAnnualPlanWorkflowEvent.Action.CREATED, '', PnaeAnnualPlan.Status.DRAFT, 'Plano criado para demonstracao.'),
                    (PnaeAnnualPlanWorkflowEvent.Action.SUBMITTED, PnaeAnnualPlan.Status.DRAFT, PnaeAnnualPlan.Status.IN_REVIEW, f'{DEMO_MARKER} Submetido para revisao.'),
                ],
            },
            {
                "school": schools["Escola Municipal Santa Rosa"],
                "year": current_year,
                "title": f"Plano PNAE Reprovado {current_year} {DEMO_MARKER}",
                "status": PnaeAnnualPlan.Status.REJECTED,
                "review_comment": f"{DEMO_MARKER} Ajustar indicadores e cronograma.",
                "workflow": [
                    (PnaeAnnualPlanWorkflowEvent.Action.CREATED, '', PnaeAnnualPlan.Status.DRAFT, 'Plano criado para demonstracao.'),
                    (PnaeAnnualPlanWorkflowEvent.Action.SUBMITTED, PnaeAnnualPlan.Status.DRAFT, PnaeAnnualPlan.Status.IN_REVIEW, f'{DEMO_MARKER} Submetido para revisao.'),
                    (PnaeAnnualPlanWorkflowEvent.Action.REJECTED, PnaeAnnualPlan.Status.IN_REVIEW, PnaeAnnualPlan.Status.REJECTED, f'{DEMO_MARKER} Reprovado para ajustes.'),
                ],
            },
        ]

        approved_actor = users["municipal_manager"]
        plans = {}
        for spec in plan_specs:
            plan, _ = PnaeAnnualPlan.objects.get_or_create(
                school=spec["school"],
                year=spec["year"],
                defaults={
                    "title": spec["title"],
                    "created_by": users["admin"],
                },
            )
            plan.title = spec["title"]
            plan.created_by = users["admin"]
            plan.responsible_nutritionist = users["nutritionist"]
            plan.justification = f"{DEMO_MARKER} Fortalecer a seguranca alimentar e nutricional da unidade."
            plan.diagnosis_summary = f"{DEMO_MARKER} Diagnostico com base em consumo, estoque e aceitabilidade."
            plan.general_objectives = "Garantir oferta regular, adequada e monitorada da alimentacao escolar."
            plan.operational_strategy = "Integracao entre cardapio, estoque, recebimentos, producao e acompanhamento mensal."
            plan.execution_locations = "Cozinha escolar, almoxarifado central e unidades escolares."
            plan.executing_agency = "SEMED / Coordenacao de Alimentacao Escolar"
            plan.financial_schedule_notes = f"{DEMO_MARKER} Cronograma financeiro distribuido por trimestre."
            plan.status = spec["status"]
            plan.notes = f"{DEMO_MARKER} Plano gerado automaticamente para demonstracao completa."
            plan.last_review_comment = spec["review_comment"]
            plan.submitted_by = users["school_coordinator"]
            plan.submitted_at = timezone.now() - timedelta(days=20)
            plan.approved_by = approved_actor if spec["status"] == PnaeAnnualPlan.Status.APPROVED else None
            plan.approved_at = timezone.now() - timedelta(days=15) if spec["status"] == PnaeAnnualPlan.Status.APPROVED else None
            plan.rejected_by = approved_actor if spec["status"] == PnaeAnnualPlan.Status.REJECTED else None
            plan.rejected_at = timezone.now() - timedelta(days=10) if spec["status"] == PnaeAnnualPlan.Status.REJECTED else None
            plan.save()
            plans[spec["school"].name] = plan

            plan.goals.all().delete()
            plan.actions.all().delete()
            plan.schedule_entries.all().delete()
            plan.budget_items.all().delete()
            plan.evaluation_tools.all().delete()
            plan.items.all().delete()
            plan.workflow_events.all().delete()
            plan.monthly_executions.all().delete()

            PnaeAnnualGoal.objects.bulk_create([
                PnaeAnnualGoal(plan=plan, title='Elevar aceitabilidade media', description='Ampliar aprovacao das preparacoes testadas.', indicator='Aceitabilidade', target_value=Decimal('90'), current_value=Decimal('82'), order=1),
                PnaeAnnualGoal(plan=plan, title='Reduzir ruptura de estoque', description='Acompanhar itens criticos nas escolas.', indicator='Ruptura mensal', target_value=Decimal('1'), current_value=Decimal('3'), order=2),
            ])
            PnaeAnnualAction.objects.bulk_create([
                PnaeAnnualAction(plan=plan, title='Capacitar equipes escolares', description='Treinamento sobre boas praticas e porcionamento.', responsible_sector='Nutricao Escolar', start_date=date(current_year, 2, 10), end_date=date(current_year, 3, 20), status=PnaeAnnualAction.Status.COMPLETED if spec["status"] == PnaeAnnualPlan.Status.APPROVED else PnaeAnnualAction.Status.IN_PROGRESS, order=1),
                PnaeAnnualAction(plan=plan, title='Rodar testes de aceitabilidade', description='Aplicar testes conforme manual FNDE.', responsible_sector='Nutricionistas e escolas', start_date=date(current_year, 4, 1), end_date=date(current_year, 8, 30), status=PnaeAnnualAction.Status.IN_PROGRESS, order=2),
            ])
            PnaeAnnualScheduleEntry.objects.bulk_create([
                PnaeAnnualScheduleEntry(plan=plan, month=3, activity='Diagnostico e consolidacao de dados', expected_result='Base anual consolidada', order=1),
                PnaeAnnualScheduleEntry(plan=plan, month=5, activity='Aplicacao dos testes de aceitabilidade', expected_result='Relatorios por escola', order=2),
                PnaeAnnualScheduleEntry(plan=plan, month=8, activity='Revisao de cardapio e compras', expected_result='Ajustes operacionais', order=3),
            ])
            PnaeAnnualBudgetItem.objects.bulk_create([
                PnaeAnnualBudgetItem(plan=plan, category='Generos alimenticios', description='Aquisição regular da rede', funding_source='FNDE/PNAE', estimated_amount=Decimal('185000.00'), executed_amount=Decimal('92000.00'), order=1),
                PnaeAnnualBudgetItem(plan=plan, category='Capacitacao', description='Formacao das equipes e materiais', funding_source='Municipio', estimated_amount=Decimal('14000.00'), executed_amount=Decimal('6000.00'), order=2),
            ])
            PnaeAnnualEvaluationTool.objects.bulk_create([
                PnaeAnnualEvaluationTool(plan=plan, name='Teste de aceitabilidade', description='Aplicacao de escala hedonica e resto-ingestao.', frequency='Bimestral', target_audience='Estudantes e equipes', order=1),
                PnaeAnnualEvaluationTool(plan=plan, name='Painel de execucao mensal', description='Acompanhamento de metas e desvios.', frequency='Mensal', target_audience='SEMED e nutricionistas', order=2),
            ])
            PnaeAnnualPlanItem.objects.bulk_create([
                PnaeAnnualPlanItem(plan=plan, education_stage=education_stages['EFI'], education_modality=education_modalities['REG'], month=4, meal_type=MenuItem.MealType.LUNCH, recipe=recipes['Arroz com Frango e Legumes'], servings_planned=420, weekly_frequency=5, notes=f'{DEMO_MARKER} Almoco base do ciclo.' ),
                PnaeAnnualPlanItem(plan=plan, education_stage=education_stages['EFI'], education_modality=education_modalities['REG'], month=4, meal_type=MenuItem.MealType.BREAKFAST_1, recipe=recipes['Leite com Biscoito'], servings_planned=420, weekly_frequency=5, notes=f'{DEMO_MARKER} Desjejum base.' ),
                PnaeAnnualPlanItem(plan=plan, education_stage=education_stages['EFI'], education_modality=education_modalities['REG'], month=4, meal_type=MenuItem.MealType.SNACK_2, recipe=recipes['Suco de Caju com Banana'], servings_planned=380, weekly_frequency=5, notes=f'{DEMO_MARKER} Lanche vespertino.' ),
            ])
            for action, from_status, to_status, comment in spec["workflow"]:
                actor = users["school_coordinator"] if action == PnaeAnnualPlanWorkflowEvent.Action.SUBMITTED else approved_actor
                if action == PnaeAnnualPlanWorkflowEvent.Action.CREATED:
                    actor = users["admin"]
                PnaeAnnualPlanWorkflowEvent.objects.create(
                    plan=plan,
                    action=action,
                    from_status=from_status,
                    to_status=to_status,
                    comment=f"{DEMO_MARKER} {comment}",
                    actor=actor,
                )
            for month, status, progress, planned, executed in [
                (3, PnaeAnnualPlanMonthlyExecution.Status.COMPLETED, 100, 900, 910),
                (4, PnaeAnnualPlanMonthlyExecution.Status.IN_PROGRESS, 72, 980, 700),
                (5, PnaeAnnualPlanMonthlyExecution.Status.NOT_STARTED, 0, 1020, 0),
            ]:
                PnaeAnnualPlanMonthlyExecution.objects.create(
                    plan=plan,
                    month=month,
                    status=status,
                    progress_percent=progress,
                    planned_servings=planned,
                    executed_servings=executed,
                    execution_notes=f"{DEMO_MARKER} Execucao do mes {month}.",
                    deviation_notes='' if progress >= 70 else f'{DEMO_MARKER} Ajustar entrega e equipe.',
                    evidence_links=[f'https://demo.local/pnae/{plan.id}/mes-{month}'],
                    last_updated_by=users["nutritionist"],
                )

        PnaeAcceptabilityTest.objects.filter(notes__icontains=DEMO_MARKER).delete()
        approved_plan = plans["Escola Municipal Joao Cordeiro"]
        review_plan = plans["Escola Municipal Maria Lucia"]
        rejected_plan = plans["Escola Municipal Santa Rosa"]
        approved_menu = (
            Menu.objects.filter(
                school=approved_plan.school,
                status=Menu.Status.PUBLISHED,
            )
            .order_by("-week_start")
            .first()
        )
        PnaeAcceptabilityTest.objects.create(
            school=approved_plan.school,
            menu=approved_menu,
            recipe=recipes["Arroz com Frango e Legumes"],
            method=PnaeAcceptabilityTest.Method.HEDONIC,
            objective=PnaeAcceptabilityTest.Objective.NEW_OR_ATYPICAL,
            analysis_scope=PnaeAcceptabilityTest.AnalysisScope.PREPARATION,
            service_mode=PnaeAcceptabilityTest.ServiceMode.CAFETERIA,
            preparation_name='Arroz com Frango e Legumes',
            target_group='Ensino Fundamental I',
            respondent_profile=PnaeAcceptabilityTest.RespondentProfile.STUDENT,
            respondent_entries=[
                {"respondent_type": "STUDENT", "label": "Aluno 01", "group_label": "5A", "response_code": "LOVED"},
                {"respondent_type": "STUDENT", "label": "Aluno 02", "group_label": "5A", "response_code": "LIKED"},
                {"respondent_type": "STUDENT", "label": "Aluno 03", "group_label": "5B", "response_code": "LIKED"},
                {"respondent_type": "STUDENT", "label": "Aluno 04", "group_label": "5B", "response_code": "LOVED"},
                {"respondent_type": "STUDENT", "label": "Aluno 05", "group_label": "5C", "response_code": "INDIFFERENT"},
            ],
            classes_sampled='5A, 5B e 5C',
            test_date=date.today() - timedelta(days=25),
            weather_context='Dia ensolarado',
            serving_time='11:30',
            eligible_students_count=120,
            adhered_students_count=109,
            positive_feedback=f'{DEMO_MARKER} Boa textura e sabor do frango.',
            negative_feedback='Alguns alunos pediram mais tempero.',
            notes=f'{DEMO_MARKER} Teste hedônico da preparação principal.',
            created_by=users["nutritionist"],
        )
        initial_failed_test = PnaeAcceptabilityTest.objects.create(
            school=review_plan.school,
            recipe=recipes["Suco de Caju com Banana"],
            method=PnaeAcceptabilityTest.Method.HEDONIC,
            objective=PnaeAcceptabilityTest.Objective.RECURRING_MENU,
            analysis_scope=PnaeAcceptabilityTest.AnalysisScope.PREPARATION,
            service_mode=PnaeAcceptabilityTest.ServiceMode.CLASSROOM,
            preparation_name='Suco de Caju com Banana',
            target_group='Pre-escola',
            respondent_profile=PnaeAcceptabilityTest.RespondentProfile.STUDENT,
            respondent_entries=[
                {"respondent_type": "STUDENT", "label": "Aluno 01", "group_label": "PRE-A", "response_code": "LIKED"},
                {"respondent_type": "STUDENT", "label": "Aluno 02", "group_label": "PRE-A", "response_code": "INDIFFERENT"},
                {"respondent_type": "STUDENT", "label": "Aluno 03", "group_label": "PRE-B", "response_code": "DISLIKED"},
                {"respondent_type": "STUDENT", "label": "Aluno 04", "group_label": "PRE-B", "response_code": "HATED"},
            ],
            classes_sampled='PRE-A e PRE-B',
            test_date=date.today() - timedelta(days=90),
            weather_context='Manha chuvosa',
            serving_time='09:20',
            eligible_students_count=70,
            adhered_students_count=40,
            positive_feedback='A fruta foi bem aceita.',
            negative_feedback=f'{DEMO_MARKER} Bebida pouco gelada e doce.',
            notes=f'{DEMO_MARKER} Primeira tentativa abaixo do corte.',
            created_by=users["nutritionist"],
        )
        PnaeAcceptabilityTest.objects.create(
            school=review_plan.school,
            recipe=recipes["Suco de Caju com Banana"],
            previous_test=initial_failed_test,
            method=PnaeAcceptabilityTest.Method.HEDONIC,
            objective=PnaeAcceptabilityTest.Objective.RECURRING_MENU,
            analysis_scope=PnaeAcceptabilityTest.AnalysisScope.PREPARATION,
            service_mode=PnaeAcceptabilityTest.ServiceMode.CLASSROOM,
            preparation_name='Suco de Caju com Banana',
            target_group='Pre-escola',
            respondent_profile=PnaeAcceptabilityTest.RespondentProfile.STUDENT,
            respondent_entries=[
                {"respondent_type": "STUDENT", "label": "Aluno 05", "group_label": "PRE-A", "response_code": "LOVED"},
                {"respondent_type": "STUDENT", "label": "Aluno 06", "group_label": "PRE-A", "response_code": "LIKED"},
                {"respondent_type": "STUDENT", "label": "Aluno 07", "group_label": "PRE-B", "response_code": "LIKED"},
                {"respondent_type": "STUDENT", "label": "Aluno 08", "group_label": "PRE-B", "response_code": "INDIFFERENT"},
                {"respondent_type": "STUDENT", "label": "Aluno 09", "group_label": "PRE-B", "response_code": "DISLIKED"},
            ],
            classes_sampled='PRE-A e PRE-B',
            test_date=date.today() - timedelta(days=15),
            weather_context='Dia ameno',
            serving_time='09:20',
            eligible_students_count=72,
            adhered_students_count=54,
            positive_feedback='Temperatura ajustada e melhor aceitação.',
            negative_feedback=f'{DEMO_MARKER} Ainda necessita pequena revisão.',
            notes=f'{DEMO_MARKER} Segunda tentativa do suco.',
            created_by=users["nutritionist"],
        )
        PnaeAcceptabilityTest.objects.create(
            school=rejected_plan.school,
            recipe=recipes["Leite com Biscoito"],
            method=PnaeAcceptabilityTest.Method.LUDIC,
            objective=PnaeAcceptabilityTest.Objective.NEW_OR_ATYPICAL,
            analysis_scope=PnaeAcceptabilityTest.AnalysisScope.PREPARATION,
            service_mode=PnaeAcceptabilityTest.ServiceMode.CLASSROOM,
            preparation_name="Leite com Biscoito",
            target_group="Creche e pre-escola",
            respondent_profile=PnaeAcceptabilityTest.RespondentProfile.STUDENT,
            respondent_entries=[
                {"respondent_type": "STUDENT", "label": "Crianca 01", "group_label": "Creche A", "response_code": "LOVED"},
                {"respondent_type": "STUDENT", "label": "Crianca 02", "group_label": "Creche A", "response_code": "LIKED"},
                {"respondent_type": "STUDENT", "label": "Crianca 03", "group_label": "Creche B", "response_code": "LIKED"},
                {"respondent_type": "STUDENT", "label": "Crianca 04", "group_label": "Creche B", "response_code": "LOVED"},
                {"respondent_type": "STUDENT", "label": "Crianca 05", "group_label": "Creche B", "response_code": "LIKED"},
            ],
            classes_sampled="Creche A e Creche B",
            test_date=date.today() - timedelta(days=11),
            weather_context="Turno da manha",
            serving_time="08:40",
            eligible_students_count=58,
            adhered_students_count=46,
            positive_feedback="Boa resposta visual e rapidez no consumo.",
            negative_feedback=f"{DEMO_MARKER} Parte do grupo pediu porcao menor de biscoito.",
            notes=f"{DEMO_MARKER} Cartelas ludicas com publico infantil.",
            created_by=users["nutritionist"],
        )
        PnaeAcceptabilityTest.objects.create(
            school=approved_plan.school,
            menu=approved_menu,
            method=PnaeAcceptabilityTest.Method.REST_INGESTION,
            objective=PnaeAcceptabilityTest.Objective.RECURRING_MENU,
            analysis_scope=PnaeAcceptabilityTest.AnalysisScope.MENU,
            service_mode=PnaeAcceptabilityTest.ServiceMode.CAFETERIA,
            preparation_name='Almoco completo de quarta-feira',
            target_group='Ensino Fundamental',
            respondent_profile=PnaeAcceptabilityTest.RespondentProfile.NOT_INFORMED,
            test_date=date.today() - timedelta(days=7),
            weather_context='Temperatura elevada',
            serving_time='11:40',
            eligible_students_count=210,
            adhered_students_count=182,
            prepared_weight=Decimal('48.00'),
            leftover_weight=Decimal('5.50'),
            plate_waste_weight=Decimal('3.10'),
            non_edible_weight=Decimal('0.00'),
            positive_feedback='Boa adesão geral ao almoço.',
            negative_feedback=f'{DEMO_MARKER} Resto maior na turma do turno vespertino.',
            notes=f'{DEMO_MARKER} Teste por resto-ingestao.',
            created_by=users["nutritionist"],
        )
        PnaeAcceptabilityTest.objects.create(
            school=approved_plan.school,
            method=PnaeAcceptabilityTest.Method.WITHIN_OUTSIDE,
            objective=PnaeAcceptabilityTest.Objective.PROCUREMENT_SAMPLE,
            analysis_scope=PnaeAcceptabilityTest.AnalysisScope.PRODUCT,
            service_mode=PnaeAcceptabilityTest.ServiceMode.PROCUREMENT_PANEL,
            preparation_name="Amostra de iogurte de morango",
            target_group="Painel tecnico de profissionais",
            respondent_profile=PnaeAcceptabilityTest.RespondentProfile.PROFESSIONAL,
            respondent_entries=[
                {"respondent_type": "PROFESSIONAL", "label": "Nutricionista 01", "group_label": "Nutricao", "response_code": "WITHIN"},
                {"respondent_type": "PROFESSIONAL", "label": "Nutricionista 02", "group_label": "Nutricao", "response_code": "WITHIN"},
                {"respondent_type": "PROFESSIONAL", "label": "Conselheiro 01", "group_label": "CAE", "response_code": "WITHIN"},
                {"respondent_type": "PROFESSIONAL", "label": "Conselheiro 02", "group_label": "CAE", "response_code": "WITHIN"},
                {"respondent_type": "PROFESSIONAL", "label": "Diretora 01", "group_label": "Gestao escolar", "response_code": "WITHIN"},
                {"respondent_type": "PROFESSIONAL", "label": "Diretora 02", "group_label": "Gestao escolar", "response_code": "WITHIN"},
                {"respondent_type": "PROFESSIONAL", "label": "Merendeira 01", "group_label": "Cozinha", "response_code": "WITHIN"},
                {"respondent_type": "PROFESSIONAL", "label": "Merendeira 02", "group_label": "Cozinha", "response_code": "WITHIN"},
                {"respondent_type": "PROFESSIONAL", "label": "Almoxarife 01", "group_label": "Suprimentos", "response_code": "WITHIN"},
                {"respondent_type": "PROFESSIONAL", "label": "Almoxarife 02", "group_label": "Suprimentos", "response_code": "WITHIN"},
                {"respondent_type": "PROFESSIONAL", "label": "Profissional 11", "group_label": "Apoio", "response_code": "OUTSIDE"},
                {"respondent_type": "PROFESSIONAL", "label": "Profissional 12", "group_label": "Apoio", "response_code": "OUTSIDE"},
            ],
            classes_sampled="Painel tecnico intersetorial",
            test_date=date.today() - timedelta(days=4),
            weather_context="Sala climatizada",
            serving_time="14:10",
            positive_feedback="Textura e acidez aprovadas pela maior parte do painel.",
            negative_feedback=f"{DEMO_MARKER} Ajustar leve excesso de dulcor.",
            notes=f"{DEMO_MARKER} Teste dentro-fora do padrao com profissionais.",
            created_by=users["nutritionist"],
        )

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
        return suppliers

    def _ensure_lot_tracking_data(self, schools, supplies, suppliers, deliveries):
        today = date.today()
        lot_specs = [
            # Central lots used by delivery FEFO suggestions
            ("Arroz Agulhinha", "ARZ-2401", today - timedelta(days=40), today + timedelta(days=120), "120", None, "HortiVida Fornecimentos"),
            ("Arroz Agulhinha", "ARZ-2402", today - timedelta(days=15), today + timedelta(days=210), "160", None, "Distribuidora Nordeste Escolar"),
            ("Frango Congelado", "FRG-110", today - timedelta(days=25), today + timedelta(days=60), "80", None, "Cooperativa Alimentos do Agreste"),
            ("Frango Congelado", "FRG-111", today - timedelta(days=10), today + timedelta(days=120), "90", None, "Cooperativa Alimentos do Agreste"),
            ("Banana Prata", "BAN-LOT1", today - timedelta(days=3), today + timedelta(days=6), "25", None, "HortiVida Fornecimentos"),
            ("Banana Prata", "BAN-LOT2", today - timedelta(days=1), today + timedelta(days=10), "40", None, "HortiVida Fornecimentos"),
            ("Suco de Caju", "SCJ-01", today - timedelta(days=30), today + timedelta(days=150), "40", None, "Distribuidora Nordeste Escolar"),
            ("Leite Integral", "LEI-01", today - timedelta(days=5), today + timedelta(days=20), "35", None, "Distribuidora Nordeste Escolar"),
            ("Leite Integral", "LEI-02", today - timedelta(days=2), today + timedelta(days=45), "55", None, "Distribuidora Nordeste Escolar"),
            # School lots for stock details/consumption FEFO
            ("Feijao Carioca", "FEJ-JC-01", today - timedelta(days=20), today + timedelta(days=90), "0", "Escola Municipal Joao Cordeiro", "Cooperativa Alimentos do Agreste"),
            ("Feijao Carioca", "FEJ-JC-02", today - timedelta(days=8), today + timedelta(days=130), "0", "Escola Municipal Joao Cordeiro", "Cooperativa Alimentos do Agreste"),
        ]

        for supply_name, lot_code, mfg, exp, central_qty, school_name, supplier_name in lot_specs:
            lot = get_or_create_supply_lot(
                supply=supplies[supply_name],
                lot_code=lot_code,
                expiry_date=exp,
                manufacture_date=mfg,
                supplier=suppliers.get(supplier_name),
                invoice_ref=f"{DEMO_MARKER}-{lot_code}",
            )
            if central_qty and Decimal(central_qty) > 0:
                balance = LotBalanceCentral.objects.filter(lot=lot).first()
                if not balance or balance.quantity != Decimal(central_qty):
                    LotBalanceCentral.objects.update_or_create(lot=lot, defaults={"quantity": Decimal(central_qty)})
            if school_name:
                school = schools[school_name]
                # Split school stock lots from aggregate school quantity (demo only)
                qty = Decimal("10") if lot_code.endswith("01") else Decimal("9")
                LotBalanceSchool.objects.update_or_create(school=school, lot=lot, defaults={"quantity": qty})

        # Link lot lines to conferred supplier receipts (demo traceability)
        for receipt in SupplierReceipt.objects.filter(status=SupplierReceipt.Status.CONFERRED, notes__icontains=DEMO_MARKER).prefetch_related("items"):
            for item in receipt.items.all():
                supply = item.supply or item.supply_created
                if not supply or item.received_quantity is None or item.received_quantity <= 0:
                    continue
                if SupplierReceiptItemLot.objects.filter(receipt_item=item).exists():
                    continue
                first_qty = (item.received_quantity / 2).quantize(Decimal("0.01"))
                second_qty = item.received_quantity - first_qty
                specs = [
                    (f"RCV-{str(item.id)[:4]}A", first_qty, today + timedelta(days=45)),
                    (f"RCV-{str(item.id)[:4]}B", second_qty, today + timedelta(days=90)),
                ]
                for code, qty, expiry in specs:
                    SupplierReceiptItemLot.objects.create(
                        receipt_item=item,
                        supply=supply,
                        lot_code=code,
                        expiry_date=expiry,
                        manufacture_date=today - timedelta(days=5),
                        received_quantity=qty,
                        divergence_note="",
                    )
                    lot = get_or_create_supply_lot(
                        supply=supply,
                        lot_code=code,
                        expiry_date=expiry,
                        manufacture_date=today - timedelta(days=5),
                        supplier=receipt.supplier,
                        invoice_ref=f"{DEMO_MARKER}-RCV",
                    )
                    if receipt.school_id:
                        credit_lot_school(school=receipt.school, lot=lot, quantity=qty)
                    else:
                        credit_lot_central(lot, qty)

        # Ensure lot plan exists for draft/sent deliveries to demonstrate FEFO on UI.
        for delivery in Delivery.objects.filter(notes__icontains=DEMO_MARKER).prefetch_related("items__supply"):
            if delivery.status == Delivery.Status.DRAFT:
                DeliveryItemLot.objects.filter(delivery_item__delivery=delivery).delete()
                for item in delivery.items.all():
                    try:
                        regenerate_delivery_item_lot_plan_fefo(item)
                    except Exception:
                        # Demo data should not fail the whole seed when one item lacks lot stock.
                        continue
            elif delivery.status in [Delivery.Status.SENT, Delivery.Status.CONFERRED]:
                # Keep or regenerate planned lots for visibility in details.
                for item in delivery.items.all():
                    if item.lots.exists():
                        continue
                    try:
                        regenerate_delivery_item_lot_plan_fefo(item)
                    except Exception:
                        continue

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
