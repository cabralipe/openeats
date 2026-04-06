from django.contrib.auth import get_user_model
from django.core.management import call_command

import pytest

from inventory.models import (
    Delivery,
    DeliveryNutritionistSignature,
    SchoolStockBalance,
    StockBalance,
    Supplier,
    SupplierReceipt,
    SupplierReceiptItemLot,
    Supply,
)
from menus.models import MealServiceReport, Menu, MenuItem
from pnae.models import PnaeAcceptabilityTest, PnaeAnnualPlan
from production.models import PublicCalculatorLink, SupplyAlias, SupplyConsumptionRule
from recipes.models import Recipe
from schools.models import EducationModality, EducationStage, Municipality, School


pytestmark = pytest.mark.django_db(transaction=True)


def test_super_populate_demo_seeds_end_to_end_platform_data():
    call_command("super_populate_demo")

    User = get_user_model()

    assert Municipality.objects.count() == 2
    assert EducationStage.objects.count() == 5
    assert EducationModality.objects.count() == 5
    assert User.objects.count() == 9
    assert School.objects.count() == 5
    assert School.objects.filter(municipality__isnull=False, education_stages__isnull=False, education_modalities__isnull=False).distinct().count() >= 4

    assert Supply.objects.count() >= 13
    assert StockBalance.objects.count() >= 12
    assert SchoolStockBalance.objects.count() >= 20
    assert Supplier.objects.count() == 3
    assert SupplierReceipt.objects.count() == 3
    assert SupplierReceiptItemLot.objects.count() >= 2

    assert Delivery.objects.count() == 3
    assert DeliveryNutritionistSignature.objects.count() == 1

    assert Recipe.objects.count() == 3
    assert Menu.objects.count() == 9
    assert MenuItem.objects.filter(recipe__isnull=False).count() > 0
    assert MealServiceReport.objects.count() > 0

    assert SupplyAlias.objects.count() >= 10
    assert SupplyConsumptionRule.objects.count() == 8
    assert PublicCalculatorLink.objects.count() == 3

    assert PnaeAnnualPlan.objects.count() == 3
    assert PnaeAcceptabilityTest.objects.count() == 6
    assert PnaeAcceptabilityTest.objects.filter(method=PnaeAcceptabilityTest.Method.HEDONIC).count() == 3
    assert PnaeAcceptabilityTest.objects.filter(method=PnaeAcceptabilityTest.Method.LUDIC).count() == 1
    assert PnaeAcceptabilityTest.objects.filter(method=PnaeAcceptabilityTest.Method.REST_INGESTION).count() == 1
    assert PnaeAcceptabilityTest.objects.filter(method=PnaeAcceptabilityTest.Method.WITHIN_OUTSIDE).count() == 1
    assert PnaeAcceptabilityTest.objects.filter(respondent_profile=PnaeAcceptabilityTest.RespondentProfile.PROFESSIONAL).count() == 1


def test_super_populate_demo_is_idempotent():
    call_command("super_populate_demo")
    call_command("super_populate_demo")

    assert Municipality.objects.count() == 2
    assert School.objects.count() == 5
    assert Delivery.objects.count() == 3
    assert PublicCalculatorLink.objects.count() == 3
    assert PnaeAnnualPlan.objects.count() == 3
    assert PnaeAcceptabilityTest.objects.count() == 6
