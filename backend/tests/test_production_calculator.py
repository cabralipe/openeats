from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from inventory.models import SchoolStockBalance, Supply
from menus.models import Menu, MenuItem
from production.models import PublicCalculatorLink, SupplyAlias, SupplyConsumptionRule
from production.services.production_calc import calculate_for_menu
from recipes.models import Recipe, RecipeIngredient
from schools.models import School


pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user():
    User = get_user_model()
    user = User.objects.create(
        email='calc@semed.local',
        name='Calc Admin',
        role=User.Roles.SEMED_ADMIN,
        is_staff=True,
        is_superuser=True,
        is_active=True,
    )
    user.set_password('Test123!')
    user.save(update_fields=['password'])
    return user


@pytest.fixture
def base_school():
    return School.objects.create(name='Escola Calculo')


@pytest.fixture
def lunch_menu(base_school, admin_user):
    week_start = date.today() - timedelta(days=date.today().weekday())
    return Menu.objects.create(
        school=base_school,
        week_start=week_start,
        week_end=week_start + timedelta(days=4),
        created_by=admin_user,
    )


def test_recipe_calculation_simple(lunch_menu):
    arroz = Supply.objects.create(name='Arroz', category='Graos', unit=Supply.Units.KG, min_stock=0)
    recipe = Recipe.objects.create(name='Arroz Cozido', servings_base=100)
    RecipeIngredient.objects.create(recipe=recipe, supply=arroz, qty_base=Decimal('5.00'), unit=Supply.Units.KG)
    MenuItem.objects.create(
        menu=lunch_menu,
        day_of_week=MenuItem.DayOfWeek.MON,
        meal_type=MenuItem.MealType.LUNCH,
        meal_name='Arroz',
        description='Arroz',
        recipe=recipe,
        calc_mode=MenuItem.CalcMode.RECIPE,
    )

    result = calculate_for_menu(lunch_menu, {'LUNCH': 200}, waste_percent=0, include_stock=False, rounding={'mode': 'NEAREST', 'decimals': 2})
    ingredients = result['days'][0]['meals'][0]['ingredients']
    assert ingredients[0]['qty_needed'] == 10.0


def test_recipe_calculation_with_waste(lunch_menu):
    arroz = Supply.objects.create(name='Arroz', category='Graos', unit=Supply.Units.KG, min_stock=0)
    recipe = Recipe.objects.create(name='Arroz Cozido', servings_base=100)
    RecipeIngredient.objects.create(recipe=recipe, supply=arroz, qty_base=Decimal('5.00'), unit=Supply.Units.KG)
    MenuItem.objects.create(
        menu=lunch_menu,
        day_of_week=MenuItem.DayOfWeek.MON,
        meal_type=MenuItem.MealType.LUNCH,
        description='Arroz',
        recipe=recipe,
        calc_mode=MenuItem.CalcMode.RECIPE,
    )

    result = calculate_for_menu(lunch_menu, {'LUNCH': 200}, waste_percent=5, include_stock=False, rounding={'mode': 'NEAREST', 'decimals': 2})
    assert result['days'][0]['meals'][0]['ingredients'][0]['qty_needed'] == 10.5


def test_fallback_rule_calculation(lunch_menu, base_school):
    arroz = Supply.objects.create(name='Arroz', category='Graos', unit=Supply.Units.KG, min_stock=0)
    feijao = Supply.objects.create(name='Feijao', category='Graos', unit=Supply.Units.KG, min_stock=0)
    SupplyAlias.objects.create(supply=arroz, alias='arroz')
    SupplyAlias.objects.create(supply=feijao, alias='feijao')
    SupplyConsumptionRule.objects.create(
        school=base_school,
        supply=arroz,
        meal_type=MenuItem.MealType.LUNCH,
        qty_per_student=Decimal('0.05'),
        unit=Supply.Units.KG,
    )
    MenuItem.objects.create(
        menu=lunch_menu,
        day_of_week=MenuItem.DayOfWeek.MON,
        meal_type=MenuItem.MealType.LUNCH,
        description='arroz, feijao',
        calc_mode=MenuItem.CalcMode.FREE_TEXT,
    )

    result = calculate_for_menu(lunch_menu, {'LUNCH': 200}, waste_percent=0, include_stock=False, rounding={'mode': 'NEAREST', 'decimals': 2})
    ingredients = result['days'][0]['meals'][0]['ingredients']
    arroz_row = next(row for row in ingredients if row['supply_name'] == 'Arroz')
    assert arroz_row['qty_needed'] == 10.0
    assert any('Sem regra para Feijao' in warning for warning in result['warnings'])


def test_stock_shortage(lunch_menu, base_school):
    arroz = Supply.objects.create(name='Arroz', category='Graos', unit=Supply.Units.KG, min_stock=0)
    recipe = Recipe.objects.create(name='Arroz Cozido', servings_base=100)
    RecipeIngredient.objects.create(recipe=recipe, supply=arroz, qty_base=Decimal('5.00'), unit=Supply.Units.KG)
    MenuItem.objects.create(
        menu=lunch_menu,
        day_of_week=MenuItem.DayOfWeek.MON,
        meal_type=MenuItem.MealType.LUNCH,
        description='Arroz',
        recipe=recipe,
        calc_mode=MenuItem.CalcMode.RECIPE,
    )
    SchoolStockBalance.objects.create(school=base_school, supply=arroz, quantity=Decimal('8.00'), min_stock=0)

    result = calculate_for_menu(lunch_menu, {'LUNCH': 200}, waste_percent=0, include_stock=True, rounding={'mode': 'NEAREST', 'decimals': 2})
    row = result['days'][0]['meals'][0]['ingredients'][0]
    assert row['qty_needed'] == 10.0
    assert row['stock_available'] == 8.0
    assert row['stock_shortage'] == 2.0


def test_public_token_only_published(api_client, admin_user, base_school):
    week_start = date.today() - timedelta(days=date.today().weekday())
    menu = Menu.objects.create(
        school=base_school,
        week_start=week_start,
        week_end=week_start + timedelta(days=4),
        status=Menu.Status.DRAFT,
        created_by=admin_user,
    )
    MenuItem.objects.create(
        menu=menu,
        day_of_week=MenuItem.DayOfWeek.MON,
        meal_type=MenuItem.MealType.LUNCH,
        description='arroz',
    )
    link = PublicCalculatorLink.objects.create(school=base_school, is_active=True)

    response = api_client.post(
        f'/public/calculator/{link.token}/calculate/',
        {
            'week_start': week_start.isoformat(),
            'students_by_meal_type': {'DEFAULT': 100},
            'waste_percent': 0,
            'include_stock': True,
        },
        format='json',
    )
    assert response.status_code == 404

