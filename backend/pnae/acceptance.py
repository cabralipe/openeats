from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal
from time import perf_counter
from typing import Callable

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.permissions import CanAccessPnaeModule
from inventory.models import Delivery, SchoolStockBalance, StockBalance, Supply
from menus.models import Menu
from recipes.models import Recipe, RecipeIngredient
from schools.models import EducationModality, EducationStage, Municipality, School

from .models import PnaeAnnualPlan, PnaeAnnualPlanItem, PnaeAnnualPlanWorkflowEvent
from .services import approve_plan, record_workflow_event, submit_plan_for_review, sync_monthly_execution_snapshots
from .views import PnaeAnnualPlanItemViewSet, PnaeAnnualPlanMonthlyExecutionViewSet, PnaeAnnualPlanViewSet


ACCEPTANCE_SUITE_ID = 'pnae-platform-acceptance'
_FACTORY = APIRequestFactory()


@dataclass(frozen=True)
class AcceptanceContext:
    seed: str
    semed_admin: object
    municipal_manager: object
    nutritionist: object
    cae_user: object
    municipality: Municipality
    other_municipality: Municipality
    school: School
    other_school: School
    stage: EducationStage
    other_stage: EducationStage
    modality: EducationModality
    other_modality: EducationModality


@dataclass(frozen=True)
class AcceptanceScenario:
    id: str
    title: str
    description: str
    runner: Callable[[], list[str]]


class PnaeAcceptanceSuiteRunSerializer(serializers.Serializer):
    scenario_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=False,
    )


def _response_messages(payload) -> list[str]:
    messages: list[str] = []
    if isinstance(payload, dict):
        for key, value in payload.items():
            nested = _response_messages(value)
            if not nested:
                continue
            if key in {'detail', 'non_field_errors'}:
                messages.extend(nested)
            else:
                messages.extend([f'{key}: {item}' for item in nested])
    elif isinstance(payload, list):
        for item in payload:
            messages.extend(_response_messages(item))
    elif payload not in (None, ''):
        messages.append(str(payload))
    return messages


def _dispatch(method: str, path: str, user, view, *, data=None, kwargs=None):
    request_factory = getattr(_FACTORY, method.lower())
    request = request_factory(path, data=data, format='json')
    force_authenticate(request, user=user)
    response = view(request, **(kwargs or {}))
    if hasattr(response, 'render'):
        response.render()
    return response


def _assert(condition: bool, message: str):
    if not condition:
        raise AssertionError(message)


def _build_context() -> AcceptanceContext:
    seed = uuid.uuid4().hex[:8]
    municipality = Municipality.objects.create(
        name=f'Municipio Aceite {seed}',
        state='CE',
        code=f'ACEITE-{seed}',
    )
    other_municipality = Municipality.objects.create(
        name=f'Municipio Vizinho {seed}',
        state='CE',
        code=f'VIZINHO-{seed}',
    )
    stage = EducationStage.objects.create(
        name=f'Fundamental I {seed}',
        code=f'EFI-{seed}',
    )
    other_stage = EducationStage.objects.create(
        name=f'Creche {seed}',
        code=f'CRECHE-{seed}',
    )
    modality = EducationModality.objects.create(
        name=f'Regular {seed}',
        code=f'REG-{seed}',
    )
    other_modality = EducationModality.objects.create(
        name=f'Integral {seed}',
        code=f'INT-{seed}',
    )
    school = School.objects.create(
        name=f'Escola Aceite {seed}',
        municipality=municipality,
    )
    other_school = School.objects.create(
        name=f'Escola Vizinha {seed}',
        municipality=other_municipality,
    )
    school.education_stages.add(stage)
    school.education_modalities.add(modality)
    other_school.education_stages.add(other_stage)
    other_school.education_modalities.add(other_modality)

    User = get_user_model()
    semed_admin = User.objects.create(
        email=f'accept-admin-{seed}@semed.local',
        name=f'Admin Aceite {seed}',
        role=User.Roles.SEMED_ADMIN,
        is_active=True,
        is_staff=True,
        is_superuser=True,
    )
    municipal_manager = User.objects.create(
        email=f'accept-gestor-{seed}@semed.local',
        name=f'Gestor Aceite {seed}',
        role=User.Roles.MUNICIPAL_MANAGER,
        municipality=municipality,
        is_active=True,
    )
    nutritionist = User.objects.create(
        email=f'accept-nutri-{seed}@semed.local',
        name=f'Nutricionista Aceite {seed}',
        role=User.Roles.NUTRITIONIST,
        municipality=municipality,
        is_active=True,
    )
    cae_user = User.objects.create(
        email=f'accept-cae-{seed}@semed.local',
        name=f'CAE Aceite {seed}',
        role=User.Roles.CAE_COUNCILOR,
        municipality=municipality,
        is_active=True,
    )

    return AcceptanceContext(
        seed=seed,
        semed_admin=semed_admin,
        municipal_manager=municipal_manager,
        nutritionist=nutritionist,
        cae_user=cae_user,
        municipality=municipality,
        other_municipality=other_municipality,
        school=school,
        other_school=other_school,
        stage=stage,
        other_stage=other_stage,
        modality=modality,
        other_modality=other_modality,
    )


def _create_plan(ctx: AcceptanceContext, *, school: School | None = None, year: int = 2026, title: str = '') -> PnaeAnnualPlan:
    school = school or ctx.school
    plan = PnaeAnnualPlan.objects.create(
        school=school,
        year=year,
        title=title or f'Plano Aceite {ctx.seed} {year}',
        created_by=ctx.semed_admin,
        responsible_nutritionist=ctx.nutritionist if school.municipality_id == ctx.nutritionist.municipality_id else None,
    )
    record_workflow_event(
        plan,
        action=PnaeAnnualPlanWorkflowEvent.Action.CREATED,
        actor=ctx.semed_admin,
        from_status='',
        to_status=plan.status,
        comment='Plano criado para teste de aceitabilidade.',
    )
    return plan


def _create_recipe_bundle(ctx: AcceptanceContext):
    supply = Supply.objects.create(
        name=f'Arroz Aceite {ctx.seed}',
        category='Cereais',
        unit=Supply.Units.KG,
        min_stock=Decimal('0'),
    )
    recipe = Recipe.objects.create(
        name=f'Arroz com Frango Aceite {ctx.seed}',
        technical_sheet_code=f'TS-{ctx.seed}',
        category='Almoco',
        servings_base=100,
    )
    RecipeIngredient.objects.create(
        recipe=recipe,
        supply=supply,
        qty_base=Decimal('5'),
        unit=Supply.Units.KG,
        gross_weight=Decimal('5'),
        net_weight=Decimal('5'),
        unit_cost=Decimal('2.5'),
    )
    return supply, recipe


def _scenario_plan_creation_and_duplicate_guard() -> list[str]:
    ctx = _build_context()
    create_view = PnaeAnnualPlanViewSet.as_view({'post': 'create'})
    payload = {
        'school': str(ctx.school.id),
        'year': 2026,
        'title': 'Plano Aceitacao 2026',
        'justification': 'Teste de aceitabilidade do modulo.',
        'responsible_nutritionist': str(ctx.nutritionist.id),
    }
    response = _dispatch('post', '/api/pnae/plans/', ctx.semed_admin, create_view, data=payload)
    _assert(response.status_code == status.HTTP_201_CREATED, '; '.join(_response_messages(response.data)))
    plan = PnaeAnnualPlan.objects.get(id=response.data['id'])
    _assert(plan.responsible_nutritionist_id == ctx.nutritionist.id, 'O nutricionista responsavel nao foi vinculado.')
    _assert(plan.workflow_events.count() == 1, 'O evento inicial de workflow nao foi registrado.')

    duplicate_response = _dispatch('post', '/api/pnae/plans/', ctx.semed_admin, create_view, data=payload)
    duplicate_messages = _response_messages(duplicate_response.data)
    _assert(duplicate_response.status_code == status.HTTP_400_BAD_REQUEST, '; '.join(duplicate_messages))
    _assert(
        any('ja existe um plano pnae' in message.lower() for message in duplicate_messages),
        'A API nao bloqueou a duplicidade de escola/ano com mensagem clara.',
    )
    return [
        f'Plano criado com ID {plan.id} e nutricionista {ctx.nutritionist.name}.',
        'Tentativa duplicada de escola/ano foi barrada com erro de validacao.',
    ]


def _scenario_plan_item_scope_validation() -> list[str]:
    ctx = _build_context()
    plan = _create_plan(ctx)
    create_item_view = PnaeAnnualPlanItemViewSet.as_view({'post': 'create'})

    invalid_stage_response = _dispatch(
        'post',
        '/api/pnae/plan-items/',
        ctx.semed_admin,
        create_item_view,
        data={
            'plan': str(plan.id),
            'education_stage': str(ctx.other_stage.id),
            'education_modality': str(ctx.modality.id),
            'month': 3,
            'meal_type': 'LUNCH',
            'servings_planned': 120,
            'weekly_frequency': 5,
        },
    )
    _assert(invalid_stage_response.status_code == status.HTTP_400_BAD_REQUEST, '; '.join(_response_messages(invalid_stage_response.data)))
    _assert('education_stage' in invalid_stage_response.data, 'A etapa fora da escola nao foi rejeitada.')

    invalid_modality_response = _dispatch(
        'post',
        '/api/pnae/plan-items/',
        ctx.semed_admin,
        create_item_view,
        data={
            'plan': str(plan.id),
            'education_stage': str(ctx.stage.id),
            'education_modality': str(ctx.other_modality.id),
            'month': 3,
            'meal_type': 'LUNCH',
            'servings_planned': 120,
            'weekly_frequency': 5,
        },
    )
    _assert(invalid_modality_response.status_code == status.HTTP_400_BAD_REQUEST, '; '.join(_response_messages(invalid_modality_response.data)))
    _assert('education_modality' in invalid_modality_response.data, 'A modalidade fora da escola nao foi rejeitada.')

    return [
        'Etapa educacional fora da escola foi bloqueada.',
        'Modalidade educacional fora da escola foi bloqueada.',
    ]


def _scenario_workflow_lock_and_monthly_execution() -> list[str]:
    ctx = _build_context()
    plan = _create_plan(ctx, title='Plano Workflow Aceite')
    PnaeAnnualPlanItem.objects.create(
        plan=plan,
        education_stage=ctx.stage,
        education_modality=ctx.modality,
        month=3,
        meal_type='LUNCH',
        servings_planned=100,
        weekly_frequency=5,
    )
    sync_monthly_execution_snapshots(plan)

    create_execution_view = PnaeAnnualPlanMonthlyExecutionViewSet.as_view({'post': 'create'})
    draft_execution_response = _dispatch(
        'post',
        '/api/pnae/plan-monthly-executions/',
        ctx.semed_admin,
        create_execution_view,
        data={
            'plan': str(plan.id),
            'month': 4,
            'status': 'IN_PROGRESS',
            'progress_percent': 15,
            'executed_servings': 10,
            'execution_notes': 'Nao deveria aceitar em rascunho.',
        },
    )
    _assert(draft_execution_response.status_code == status.HTTP_403_FORBIDDEN, 'A execucao mensal foi aceita com plano em rascunho.')

    submit_view = PnaeAnnualPlanViewSet.as_view({'post': 'submit_review'})
    reject_view = PnaeAnnualPlanViewSet.as_view({'post': 'reject'})
    approve_view = PnaeAnnualPlanViewSet.as_view({'post': 'approve'})
    patch_plan_view = PnaeAnnualPlanViewSet.as_view({'patch': 'partial_update'})
    patch_execution_view = PnaeAnnualPlanMonthlyExecutionViewSet.as_view({'patch': 'partial_update'})

    submit_response = _dispatch(
        'post',
        f'/api/pnae/plans/{plan.id}/submit-review/',
        ctx.semed_admin,
        submit_view,
        data={'comment': 'Pronto para revisao.'},
        kwargs={'pk': str(plan.id)},
    )
    _assert(submit_response.status_code == status.HTTP_200_OK, '; '.join(_response_messages(submit_response.data)))

    reject_response = _dispatch(
        'post',
        f'/api/pnae/plans/{plan.id}/reject/',
        ctx.semed_admin,
        reject_view,
        data={'comment': 'Ajustar cronograma.'},
        kwargs={'pk': str(plan.id)},
    )
    _assert(reject_response.status_code == status.HTTP_200_OK, '; '.join(_response_messages(reject_response.data)))

    resubmit_response = _dispatch(
        'post',
        f'/api/pnae/plans/{plan.id}/submit-review/',
        ctx.semed_admin,
        submit_view,
        data={'comment': 'Cronograma ajustado.'},
        kwargs={'pk': str(plan.id)},
    )
    _assert(resubmit_response.status_code == status.HTTP_200_OK, '; '.join(_response_messages(resubmit_response.data)))

    approve_response = _dispatch(
        'post',
        f'/api/pnae/plans/{plan.id}/approve/',
        ctx.semed_admin,
        approve_view,
        data={'comment': 'Aprovado apos revisao.'},
        kwargs={'pk': str(plan.id)},
    )
    _assert(approve_response.status_code == status.HTTP_200_OK, '; '.join(_response_messages(approve_response.data)))

    execution = plan.monthly_executions.get(month=3)
    approved_execution_response = _dispatch(
        'patch',
        f'/api/pnae/plan-monthly-executions/{execution.id}/',
        ctx.semed_admin,
        patch_execution_view,
        data={
            'status': 'IN_PROGRESS',
            'progress_percent': 55,
            'executed_servings': 1200,
            'execution_notes': 'Execucao liberada apos aprovacao.',
            'evidence_links': ['https://interno.local/evidencias/pnae-marco'],
        },
        kwargs={'pk': str(execution.id)},
    )
    _assert(approved_execution_response.status_code == status.HTTP_200_OK, '; '.join(_response_messages(approved_execution_response.data)))

    locked_response = _dispatch(
        'patch',
        f'/api/pnae/plans/{plan.id}/',
        ctx.semed_admin,
        patch_plan_view,
        data={'title': 'Plano alterado apos aprovacao'},
        kwargs={'pk': str(plan.id)},
    )
    locked_messages = _response_messages(locked_response.data)
    _assert(locked_response.status_code == status.HTTP_400_BAD_REQUEST, '; '.join(locked_messages))
    _assert(
        any('bloqueado' in message.lower() for message in locked_messages),
        'O plano aprovado continuou editavel.',
    )

    return [
        'Workflow cobriu submissao, reprova, nova submissao e aprovacao.',
        'Execucao mensal ficou bloqueada antes da aprovacao e liberada depois.',
        'Edicao do plano aprovado foi impedida pela API.',
    ]


def _scenario_operational_generation() -> list[str]:
    ctx = _build_context()
    supply, recipe = _create_recipe_bundle(ctx)
    StockBalance.objects.create(supply=supply, quantity=Decimal('8'))
    SchoolStockBalance.objects.create(
        school=ctx.school,
        supply=supply,
        quantity=Decimal('1'),
        min_stock=Decimal('3'),
    )
    plan = _create_plan(ctx, title='Plano Operacional Aceite')
    PnaeAnnualPlanItem.objects.create(
        plan=plan,
        education_stage=ctx.stage,
        education_modality=ctx.modality,
        month=3,
        meal_type='LUNCH',
        recipe=recipe,
        servings_planned=100,
        weekly_frequency=5,
    )
    sync_monthly_execution_snapshots(plan)
    submit_plan_for_review(plan, ctx.semed_admin, 'Liberando projecoes.')
    approve_plan(plan, ctx.semed_admin, 'Aprovado para geracao operacional.')

    summary_view = PnaeAnnualPlanViewSet.as_view({'get': 'operational_summary'})
    menu_drafts_view = PnaeAnnualPlanViewSet.as_view({'post': 'generate_menu_drafts'})
    delivery_draft_view = PnaeAnnualPlanViewSet.as_view({'post': 'generate_delivery_draft'})

    summary_response = _dispatch(
        'get',
        f'/api/pnae/plans/{plan.id}/operational-summary/',
        ctx.semed_admin,
        summary_view,
        data={'month': 3},
        kwargs={'pk': str(plan.id)},
    )
    _assert(summary_response.status_code == status.HTTP_200_OK, '; '.join(_response_messages(summary_response.data)))
    procurement = summary_response.data['detail']['procurement']
    menu_projection = summary_response.data['detail']['menu_projection']
    _assert(procurement and procurement[0]['school_shortage'] > 0, 'A projecao nao detectou necessidade de compra/reposicao.')
    _assert(menu_projection, 'A projecao operacional nao gerou cardapio previsto.')

    menu_response = _dispatch(
        'post',
        f'/api/pnae/plans/{plan.id}/generate-menu-drafts/',
        ctx.semed_admin,
        menu_drafts_view,
        data={'month': 3},
        kwargs={'pk': str(plan.id)},
    )
    _assert(menu_response.status_code == status.HTTP_201_CREATED, '; '.join(_response_messages(menu_response.data)))
    _assert(menu_response.data['created_menus'], 'Nenhum rascunho de cardapio foi gerado.')
    _assert(Menu.objects.filter(school=ctx.school).exists(), 'Nenhum cardapio foi persistido durante a geracao.')

    delivery_response = _dispatch(
        'post',
        f'/api/pnae/plans/{plan.id}/generate-delivery-draft/',
        ctx.semed_admin,
        delivery_draft_view,
        data={'month': 3},
        kwargs={'pk': str(plan.id)},
    )
    _assert(delivery_response.status_code == status.HTTP_201_CREATED, '; '.join(_response_messages(delivery_response.data)))
    _assert(delivery_response.data['items_created'] > 0, 'Nenhuma entrega de reposicao foi gerada.')
    _assert(Delivery.objects.filter(school=ctx.school).exists(), 'Nenhuma entrega foi persistida durante a geracao.')

    return [
        f'Projecao mensal calculou {len(menu_projection)} ocorrencias e {len(procurement)} insumos.',
        f'Geracao criou {len(menu_response.data["created_menus"])} cardapio(s) rascunho.',
        f'Entrega de reposicao criada com {delivery_response.data["items_created"]} item(ns).',
    ]


def _scenario_visibility_scope() -> list[str]:
    ctx = _build_context()
    approved_plan = _create_plan(ctx, title='Plano Aprovado Visivel')
    approved_plan.status = PnaeAnnualPlan.Status.APPROVED
    approved_plan.save(update_fields=['status', 'updated_at'])
    draft_plan = _create_plan(ctx, year=2027, title='Plano Rascunho Oculto no CAE')
    other_plan = _create_plan(ctx, school=ctx.other_school, year=2026, title='Plano Outro Municipio')
    other_plan.status = PnaeAnnualPlan.Status.APPROVED
    other_plan.save(update_fields=['status', 'updated_at'])

    list_view = PnaeAnnualPlanViewSet.as_view({'get': 'list'})
    municipal_response = _dispatch('get', '/api/pnae/plans/', ctx.municipal_manager, list_view)
    _assert(municipal_response.status_code == status.HTTP_200_OK, '; '.join(_response_messages(municipal_response.data)))
    municipal_ids = {item['id'] for item in municipal_response.data}
    _assert(str(approved_plan.id) in municipal_ids and str(draft_plan.id) in municipal_ids, 'O gestor municipal nao enxergou todos os planos do proprio municipio.')
    _assert(str(other_plan.id) not in municipal_ids, 'O gestor municipal enxergou plano de outro municipio.')

    cae_response = _dispatch('get', '/api/pnae/plans/', ctx.cae_user, list_view)
    _assert(cae_response.status_code == status.HTTP_200_OK, '; '.join(_response_messages(cae_response.data)))
    cae_ids = {item['id'] for item in cae_response.data}
    _assert(str(approved_plan.id) in cae_ids, 'O perfil CAE nao recebeu o plano aprovado.')
    _assert(str(draft_plan.id) not in cae_ids, 'O perfil CAE visualizou plano em rascunho.')
    _assert(str(other_plan.id) not in cae_ids, 'O perfil CAE visualizou plano de outro municipio.')

    return [
        f'Gestor municipal visualizou {len(municipal_ids)} plano(s) apenas do proprio municipio.',
        f'Perfil CAE visualizou {len(cae_ids)} plano(s), excluindo rascunhos e outros municipios.',
    ]


SCENARIOS = [
    AcceptanceScenario(
        id='plan-creation-and-duplicate-guard',
        title='Criacao e unicidade do plano anual',
        description='Valida criacao de plano com nutricionista responsavel e bloqueio de duplicidade por escola/ano.',
        runner=_scenario_plan_creation_and_duplicate_guard,
    ),
    AcceptanceScenario(
        id='plan-item-scope-validation',
        title='Escopo de etapa e modalidade',
        description='Confirma que itens do plano respeitam as etapas e modalidades vinculadas a escola.',
        runner=_scenario_plan_item_scope_validation,
    ),
    AcceptanceScenario(
        id='workflow-lock-and-monthly-execution',
        title='Workflow, bloqueio e execucao mensal',
        description='Executa submissao, reprova, aprovacao, trava de edicao e regra de execucao mensal.',
        runner=_scenario_workflow_lock_and_monthly_execution,
    ),
    AcceptanceScenario(
        id='operational-generation',
        title='Projecao operacional e geracao',
        description='Valida demanda operacional, falta de estoque e geracao de rascunhos de cardapio e entrega.',
        runner=_scenario_operational_generation,
    ),
    AcceptanceScenario(
        id='municipality-visibility-scope',
        title='Escopo por municipio e perfil CAE',
        description='Verifica isolamento por municipio e restricao de rascunhos para conselheiros do CAE.',
        runner=_scenario_visibility_scope,
    ),
]


def _serialize_scenario_catalog() -> list[dict]:
    return [
        {
            'id': scenario.id,
            'title': scenario.title,
            'description': scenario.description,
        }
        for scenario in SCENARIOS
    ]


def _run_scenario(scenario: AcceptanceScenario) -> dict:
    started = perf_counter()
    try:
        with transaction.atomic():
            try:
                details = scenario.runner()
            finally:
                transaction.set_rollback(True)
        status_value = 'PASSED'
        error = ''
    except Exception as exc:
        details = []
        status_value = 'FAILED'
        error = str(exc)

    duration_ms = int((perf_counter() - started) * 1000)
    payload = {
        'id': scenario.id,
        'title': scenario.title,
        'description': scenario.description,
        'status': status_value,
        'duration_ms': duration_ms,
        'details': details,
    }
    if error:
        payload['error'] = error
    return payload


def run_acceptance_suite(*, selected_ids: list[str] | None = None) -> dict:
    selected_lookup = set(selected_ids or [])
    scenarios = [scenario for scenario in SCENARIOS if not selected_lookup or scenario.id in selected_lookup]
    started = perf_counter()
    results = [_run_scenario(scenario) for scenario in scenarios]
    duration_ms = int((perf_counter() - started) * 1000)
    failed = sum(1 for result in results if result['status'] == 'FAILED')
    passed = len(results) - failed
    return {
        'suite_id': ACCEPTANCE_SUITE_ID,
        'suite_name': 'Bateria de aceitabilidade do PNAE',
        'executed_at': timezone.now().isoformat(),
        'rolled_back': True,
        'execution_mode': 'platform_internal',
        'summary': {
            'total': len(results),
            'passed': passed,
            'failed': failed,
            'duration_ms': duration_ms,
            'status': 'PASSED' if failed == 0 else 'FAILED',
        },
        'results': results,
        'scenarios': _serialize_scenario_catalog(),
    }


class PnaeAcceptanceSuiteViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, CanAccessPnaeModule]

    def list(self, request):
        return Response({
            'suite_id': ACCEPTANCE_SUITE_ID,
            'suite_name': 'Bateria de aceitabilidade do PNAE',
            'execution_mode': 'platform_internal',
            'rolled_back': True,
            'scenarios': _serialize_scenario_catalog(),
        })

    def create(self, request):
        serializer = PnaeAcceptanceSuiteRunSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        selected_ids = serializer.validated_data.get('scenario_ids')
        valid_ids = {scenario.id for scenario in SCENARIOS}
        if selected_ids:
            invalid_ids = sorted(set(selected_ids) - valid_ids)
            if invalid_ids:
                raise serializers.ValidationError({
                    'scenario_ids': f'Cenarios invalidos: {", ".join(invalid_ids)}',
                })
        payload = run_acceptance_suite(selected_ids=selected_ids)
        payload['executed_by'] = {
            'id': str(request.user.id),
            'name': getattr(request.user, 'name', request.user.email),
            'email': request.user.email,
        }
        return Response(payload)
