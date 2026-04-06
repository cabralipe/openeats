from django.contrib.auth import get_user_model
import pytest
from rest_framework.test import APIClient

from inventory.models import Supply
from pnae.models import PnaeAnnualPlan, PnaeAnnualPlanItem
from recipes.models import Recipe, RecipeIngredient
from schools.models import EducationModality, EducationStage, Municipality, School


pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def municipality():
    return Municipality.objects.create(name='Maceio', state='AL', code='2704302')


@pytest.fixture
def other_municipality():
    return Municipality.objects.create(name='Arapiraca', state='AL', code='2700300')


@pytest.fixture
def manager_user():
    User = get_user_model()
    user = User.objects.create(
        email='pnae@semed.local',
        name='PNAE Manager',
        role=User.Roles.SEMED_ADMIN,
        is_active=True,
        is_staff=True,
        is_superuser=True,
    )
    user.set_password('Test123!')
    user.save(update_fields=['password'])
    return user


@pytest.fixture
def municipal_manager_user(municipality):
    User = get_user_model()
    user = User.objects.create(
        email='gestor@semed.local',
        name='Gestor Municipal',
        role=User.Roles.MUNICIPAL_MANAGER,
        municipality=municipality,
        is_active=True,
        is_staff=False,
        is_superuser=False,
    )
    user.set_password('Test123!')
    user.save(update_fields=['password'])
    return user


@pytest.fixture
def nutritionist_user(municipality):
    User = get_user_model()
    user = User.objects.create(
        email='nutri@semed.local',
        name='Nutricionista Responsavel',
        role=User.Roles.NUTRITIONIST,
        municipality=municipality,
        is_active=True,
        is_staff=False,
        is_superuser=False,
    )
    user.set_password('Test123!')
    user.save(update_fields=['password'])
    return user


@pytest.fixture
def cae_user(municipality):
    User = get_user_model()
    user = User.objects.create(
        email='cae@semed.local',
        name='Conselheiro CAE',
        role=User.Roles.CAE_COUNCILOR,
        municipality=municipality,
        is_active=True,
        is_staff=False,
        is_superuser=False,
    )
    user.set_password('Test123!')
    user.save(update_fields=['password'])
    return user


@pytest.fixture
def school(municipality):
    return School.objects.create(name='Escola PNAE', municipality=municipality)


@pytest.fixture
def other_school(other_municipality):
    return School.objects.create(name='Escola Outro Municipio', municipality=other_municipality)


@pytest.fixture
def stage():
    return EducationStage.objects.create(name='Ensino Fundamental I', code='EFI')


@pytest.fixture
def modality():
    return EducationModality.objects.create(name='Regular', code='REG')


def _auth(client, user):
    client.force_authenticate(user=user)
    return client


def test_pnae_plan_create_allows_responsible_nutritionist(api_client, manager_user, nutritionist_user, school):
    school.education_stages.clear()
    school.education_modalities.clear()
    client = _auth(api_client, manager_user)

    response = client.post(
        '/api/pnae/plans/',
        {
            'school': str(school.id),
            'year': 2026,
            'title': 'Plano anual PNAE 2026',
            'responsible_nutritionist': str(nutritionist_user.id),
            'justification': 'Organizar a execucao anual.',
        },
        format='json',
    )

    assert response.status_code == 201, response.data
    plan = PnaeAnnualPlan.objects.get(id=response.data['id'])
    assert plan.created_by == manager_user
    assert plan.responsible_nutritionist == nutritionist_user
    assert plan.workflow_events.count() == 1


def test_pnae_plan_rejects_duplicate_school_year(api_client, manager_user, school):
    client = _auth(api_client, manager_user)
    PnaeAnnualPlan.objects.create(
        school=school,
        year=2026,
        title='Plano anual existente',
        created_by=manager_user,
    )

    response = client.post(
        '/api/pnae/plans/',
        {
            'school': str(school.id),
            'year': 2026,
            'title': 'Novo plano duplicado',
        },
        format='json',
    )

    assert response.status_code == 400
    assert 'non_field_errors' in response.data
    assert 'ja existe um plano pnae' in str(response.data['non_field_errors'][0]).lower()


def test_pnae_plan_item_requires_school_stage_and_modality(api_client, manager_user, school, stage, modality):
    client = _auth(api_client, manager_user)
    school.education_stages.add(stage)
    school.education_modalities.add(modality)
    other_stage = EducationStage.objects.create(name='Creche I', code='CRECHE-I')
    other_modality = EducationModality.objects.create(name='Integral', code='INT')

    plan = PnaeAnnualPlan.objects.create(
        school=school,
        year=2026,
        title='Plano validacao',
        created_by=manager_user,
    )

    invalid_stage_response = client.post(
        '/api/pnae/plan-items/',
        {
            'plan': str(plan.id),
            'education_stage': str(other_stage.id),
            'education_modality': str(modality.id),
            'month': 3,
            'meal_type': 'LUNCH',
            'servings_planned': 120,
            'weekly_frequency': 5,
        },
        format='json',
    )
    assert invalid_stage_response.status_code == 400
    assert 'education_stage' in invalid_stage_response.data

    invalid_modality_response = client.post(
        '/api/pnae/plan-items/',
        {
            'plan': str(plan.id),
            'education_stage': str(stage.id),
            'education_modality': str(other_modality.id),
            'month': 3,
            'meal_type': 'LUNCH',
            'servings_planned': 120,
            'weekly_frequency': 5,
        },
        format='json',
    )
    assert invalid_modality_response.status_code == 400
    assert 'education_modality' in invalid_modality_response.data


def test_pnae_goal_endpoint_filters_by_plan(api_client, manager_user, school):
    client = _auth(api_client, manager_user)
    plan = PnaeAnnualPlan.objects.create(
        school=school,
        year=2026,
        title='Plano metas',
        created_by=manager_user,
    )
    other_plan = PnaeAnnualPlan.objects.create(
        school=school,
        year=2027,
        title='Plano metas 2027',
        created_by=manager_user,
    )

    create_response = client.post(
        '/api/pnae/plan-goals/',
        {
            'plan': str(plan.id),
            'title': 'Ampliar aceitabilidade',
            'description': 'Meta de aceitabilidade anual.',
            'order': 1,
        },
        format='json',
    )
    assert create_response.status_code == 201, create_response.data

    client.post(
        '/api/pnae/plan-goals/',
        {
            'plan': str(other_plan.id),
            'title': 'Meta paralela',
            'description': 'Outra meta.',
            'order': 1,
        },
        format='json',
    )

    list_response = client.get(f'/api/pnae/plan-goals/?plan={plan.id}')
    assert list_response.status_code == 200, list_response.data
    assert len(list_response.data) == 1
    assert list_response.data[0]['title'] == 'Ampliar aceitabilidade'


def test_workflow_actions_lock_plan_after_approval(api_client, manager_user, school):
    client = _auth(api_client, manager_user)
    plan = PnaeAnnualPlan.objects.create(
        school=school,
        year=2026,
        title='Plano workflow',
        created_by=manager_user,
    )

    submit_response = client.post(
        f'/api/pnae/plans/{plan.id}/submit-review/',
        {'comment': 'Pronto para analise.'},
        format='json',
    )
    assert submit_response.status_code == 200, submit_response.data
    plan.refresh_from_db()
    assert plan.status == PnaeAnnualPlan.Status.IN_REVIEW

    approve_response = client.post(
        f'/api/pnae/plans/{plan.id}/approve/',
        {'comment': 'Aprovado sem ressalvas.'},
        format='json',
    )
    assert approve_response.status_code == 200, approve_response.data
    plan.refresh_from_db()
    assert plan.status == PnaeAnnualPlan.Status.APPROVED
    assert plan.approved_by == manager_user
    assert plan.workflow_events.filter(action='APPROVED').exists()

    patch_response = client.patch(
        f'/api/pnae/plans/{plan.id}/',
        {'title': 'Plano alterado apos aprovacao'},
        format='json',
    )
    assert patch_response.status_code == 400
    assert 'bloqueado' in str(patch_response.data).lower()


def test_operational_summary_aggregates_recipe_demand_and_stock_gaps(
    api_client,
    manager_user,
    school,
    stage,
    modality,
):
    client = _auth(api_client, manager_user)
    school.education_stages.add(stage)
    school.education_modalities.add(modality)

    supply = Supply.objects.create(name='Arroz', unit='kg', min_stock=0)
    recipe = Recipe.objects.create(name='Arroz com frango', servings_base=100)
    RecipeIngredient.objects.create(
        recipe=recipe,
        supply=supply,
        qty_base=5,
        unit='kg',
        net_weight=5,
        unit_cost=2,
    )

    plan = PnaeAnnualPlan.objects.create(
        school=school,
        year=2026,
        title='Plano operacional',
        created_by=manager_user,
    )
    PnaeAnnualPlanItem.objects.create(
        plan=plan,
        education_stage=stage,
        education_modality=modality,
        month=3,
        meal_type='LUNCH',
        recipe=recipe,
        servings_planned=100,
        weekly_frequency=5,
    )

    response = client.get(f'/api/pnae/plans/{plan.id}/operational-summary/?month=3')
    assert response.status_code == 200, response.data
    detail = response.data['detail']
    assert detail['summary']['projected_servings'] > 0
    assert detail['procurement'][0]['supply_name'] == 'Arroz'
    assert detail['procurement'][0]['school_shortage'] > 0
    assert detail['menu_projection']


def test_municipality_scope_limits_non_admin_visibility(
    api_client,
    municipal_manager_user,
    manager_user,
    school,
    other_school,
):
    PnaeAnnualPlan.objects.create(
        school=school,
        year=2026,
        title='Plano municipio A',
        created_by=manager_user,
    )
    PnaeAnnualPlan.objects.create(
        school=other_school,
        year=2026,
        title='Plano municipio B',
        created_by=manager_user,
    )

    client = _auth(api_client, municipal_manager_user)
    response = client.get('/api/pnae/plans/')
    assert response.status_code == 200, response.data
    assert len(response.data) == 1
    assert response.data[0]['school_name'] == 'Escola PNAE'


def test_cae_role_sees_only_non_draft_plans(api_client, cae_user, manager_user, school):
    approved_plan = PnaeAnnualPlan.objects.create(
        school=school,
        year=2026,
        title='Plano aprovado',
        created_by=manager_user,
        status=PnaeAnnualPlan.Status.APPROVED,
    )
    PnaeAnnualPlan.objects.create(
        school=school,
        year=2027,
        title='Plano rascunho',
        created_by=manager_user,
        status=PnaeAnnualPlan.Status.DRAFT,
    )

    client = _auth(api_client, cae_user)
    response = client.get('/api/pnae/plans/')
    assert response.status_code == 200, response.data
    assert len(response.data) == 1
    assert response.data[0]['id'] == str(approved_plan.id)


def test_pnae_acceptance_suite_runs_inside_platform_and_rolls_back(api_client, manager_user):
    client = _auth(api_client, manager_user)

    response = client.post('/api/pnae/acceptance-tests/', {}, format='json')

    assert response.status_code == 200, response.data
    assert response.data['suite_id'] == 'pnae-platform-acceptance'
    assert response.data['rolled_back'] is True
    assert response.data['summary']['failed'] == 0
    assert response.data['summary']['passed'] == response.data['summary']['total']
    assert len(response.data['results']) >= 5
    assert PnaeAnnualPlan.objects.count() == 0


def test_pnae_acceptance_suite_catalog_is_visible_but_cae_cannot_execute(api_client, cae_user):
    client = _auth(api_client, cae_user)

    catalog_response = client.get('/api/pnae/acceptance-tests/')
    assert catalog_response.status_code == 200, catalog_response.data
    assert len(catalog_response.data['scenarios']) >= 5

    run_response = client.post('/api/pnae/acceptance-tests/', {}, format='json')
    assert run_response.status_code == 403
