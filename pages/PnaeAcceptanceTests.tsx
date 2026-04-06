import React, { useEffect, useMemo, useState } from 'react';
import {
  createPnaeAcceptabilityTest,
  deletePnaeAcceptabilityTest,
  getMenus,
  getPnaeAcceptabilityDashboard,
  getPnaeAcceptabilityTests,
  getRecipes,
  getSchools,
  updatePnaeAcceptabilityTest,
} from '../api';
import { PnaeAcceptabilityDashboard, PnaeAcceptabilityTest, School } from '../types';

type SimpleMenu = {
  id: string;
  name: string;
  week_start?: string;
  week_end?: string;
  status?: string;
};

type SimpleRecipe = {
  id: string;
  name: string;
  category?: string;
};

type AcceptabilityForm = {
  school: string;
  menu: string;
  recipe: string;
  previous_test: string;
  method: 'HEDONIC' | 'LUDIC' | 'REST_INGESTION' | 'WITHIN_OUTSIDE';
  objective: 'NEW_OR_ATYPICAL' | 'RECURRING_MENU' | 'PROCUREMENT_SAMPLE';
  analysis_scope: 'PREPARATION' | 'MENU' | 'PRODUCT';
  service_mode: 'CAFETERIA' | 'CLASSROOM' | 'SELF_SERVICE' | 'PROCUREMENT_PANEL';
  preparation_name: string;
  target_group: string;
  respondent_profile: 'NOT_INFORMED' | 'STUDENT' | 'PROFESSIONAL';
  respondent_entries: Array<{
    respondent_type: 'STUDENT' | 'PROFESSIONAL';
    label: string;
    group_label: string;
    response_code: 'LOVED' | 'LIKED' | 'INDIFFERENT' | 'DISLIKED' | 'HATED' | 'WITHIN' | 'OUTSIDE';
  }>;
  classes_sampled: string;
  test_date: string;
  weather_context: string;
  serving_time: string;
  eligible_students_count: string;
  adhered_students_count: string;
  loved_count: string;
  liked_count: string;
  indifferent_count: string;
  disliked_count: string;
  hated_count: string;
  within_count: string;
  outside_count: string;
  prepared_weight: string;
  leftover_weight: string;
  plate_waste_weight: string;
  non_edible_weight: string;
  positive_feedback: string;
  negative_feedback: string;
  notes: string;
};

type ParticipantDraft = {
  label: string;
  group_label: string;
  response_code: '' | 'LOVED' | 'LIKED' | 'INDIFFERENT' | 'DISLIKED' | 'HATED' | 'WITHIN' | 'OUTSIDE';
};

const today = new Date().toISOString().slice(0, 10);

const METHOD_CARDS = {
  HEDONIC: {
    title: 'Escala hedonica',
    threshold: 85,
    note: 'Use para preparacao nova, atipica ou reformulada. Aprovacao com gostei + adorei >= 85%.',
  },
  LUDIC: {
    title: 'Cartelas ludicas',
    threshold: 85,
    note: 'Indicada para publico infantil. Segue a mesma regra de aceitacao da escala hedonica.',
  },
  REST_INGESTION: {
    title: 'Resto-ingestao',
    threshold: 90,
    note: 'Aplica-se ao cardapio/refeicao como um todo. Aprovacao com indice de aceitacao >= 90%.',
  },
  WITHIN_OUTSIDE: {
    title: 'Dentro-fora do padrao',
    threshold: 85,
    note: 'Voltado para amostras de aquisicao. Painel recomendado de 10 a 15 provadores.',
  },
} as const;

const OBJECTIVE_LABELS = {
  NEW_OR_ATYPICAL: 'Preparacao nova ou atipica',
  RECURRING_MENU: 'Cardapio frequente',
  PROCUREMENT_SAMPLE: 'Amostra para aquisicao',
} as const;

const RESPONSE_LABELS = {
  LOVED: 'Adorei',
  LIKED: 'Gostei',
  INDIFFERENT: 'Indiferente',
  DISLIKED: 'Nao gostei',
  HATED: 'Detestei',
  WITHIN: 'Dentro do padrao',
  OUTSIDE: 'Fora do padrao',
} as const;

const RESPONSE_TONES = {
  LOVED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300',
  LIKED: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300',
  INDIFFERENT: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
  DISLIKED: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300',
  HATED: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300',
  WITHIN: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300',
  OUTSIDE: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300',
} as const;

const emptyForm = (): AcceptabilityForm => ({
  school: '',
  menu: '',
  recipe: '',
  previous_test: '',
  method: 'HEDONIC',
  objective: 'NEW_OR_ATYPICAL',
  analysis_scope: 'PREPARATION',
  service_mode: 'CAFETERIA',
  preparation_name: '',
  target_group: '',
  respondent_profile: 'STUDENT',
  respondent_entries: [],
  classes_sampled: '',
  test_date: today,
  weather_context: '',
  serving_time: '',
  eligible_students_count: '',
  adhered_students_count: '',
  loved_count: '',
  liked_count: '',
  indifferent_count: '',
  disliked_count: '',
  hated_count: '',
  within_count: '',
  outside_count: '',
  prepared_weight: '',
  leftover_weight: '',
  plate_waste_weight: '',
  non_edible_weight: '',
  positive_feedback: '',
  negative_feedback: '',
  notes: '',
});

const emptyParticipantDraft = (): ParticipantDraft => ({
  label: '',
  group_label: '',
  response_code: '',
});

const parseNumber = (value: string) => {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPercent = (value: string | number | undefined | null) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value || 0))}%`;

const formatDate = (value?: string | null) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '-');

const badgeTone = (approved: boolean) =>
  approved
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';

const getResponseOptions = (method: AcceptabilityForm['method']) => (
  method === 'WITHIN_OUTSIDE'
    ? [
        { value: 'WITHIN', label: RESPONSE_LABELS.WITHIN },
        { value: 'OUTSIDE', label: RESPONSE_LABELS.OUTSIDE },
      ]
    : [
        { value: 'LOVED', label: RESPONSE_LABELS.LOVED },
        { value: 'LIKED', label: RESPONSE_LABELS.LIKED },
        { value: 'INDIFFERENT', label: RESPONSE_LABELS.INDIFFERENT },
        { value: 'DISLIKED', label: RESPONSE_LABELS.DISLIKED },
        { value: 'HATED', label: RESPONSE_LABELS.HATED },
      ]
) as Array<{ value: ParticipantDraft['response_code']; label: string }>;

const deriveCountsFromEntries = (entries: AcceptabilityForm['respondent_entries']) => {
  const totals = {
    loved_count: 0,
    liked_count: 0,
    indifferent_count: 0,
    disliked_count: 0,
    hated_count: 0,
    within_count: 0,
    outside_count: 0,
  };

  entries.forEach((entry) => {
    if (entry.response_code === 'LOVED') totals.loved_count += 1;
    if (entry.response_code === 'LIKED') totals.liked_count += 1;
    if (entry.response_code === 'INDIFFERENT') totals.indifferent_count += 1;
    if (entry.response_code === 'DISLIKED') totals.disliked_count += 1;
    if (entry.response_code === 'HATED') totals.hated_count += 1;
    if (entry.response_code === 'WITHIN') totals.within_count += 1;
    if (entry.response_code === 'OUTSIDE') totals.outside_count += 1;
  });

  return totals;
};

const buildPreview = (form: AcceptabilityForm) => {
  const threshold = METHOD_CARDS[form.method].threshold;
  const eligible = parseNumber(form.eligible_students_count);
  const individualCounts = deriveCountsFromEntries(form.respondent_entries);
  const participantCount = form.respondent_entries.length;
  const adhered = parseNumber(form.adhered_students_count) || participantCount;
  const adhesion = eligible > 0 ? (adhered / eligible) * 100 : 0;
  const adhesionLabel = adhesion > 70 ? 'Alta' : adhesion >= 50 ? 'Media' : adhesion >= 30 ? 'Baixa' : adhesion > 0 ? 'Muito baixa' : 'Nao informada';

  if (form.method === 'REST_INGESTION') {
    const prepared = parseNumber(form.prepared_weight);
    const leftover = parseNumber(form.leftover_weight);
    const waste = parseNumber(form.plate_waste_weight);
    const nonEdible = parseNumber(form.non_edible_weight);
    const distributed = Math.max(prepared - leftover - nonEdible, 0);
    const rejection = distributed > 0 ? (waste / distributed) * 100 : 0;
    const acceptance = distributed > 0 ? 100 - rejection : 0;
    return { threshold, acceptance, rejection, distributed, adhesion, adhesionLabel, approved: acceptance >= threshold, participantCount };
  }

  const loved = participantCount ? individualCounts.loved_count : parseNumber(form.loved_count);
  const liked = participantCount ? individualCounts.liked_count : parseNumber(form.liked_count);
  const indifferent = participantCount ? individualCounts.indifferent_count : parseNumber(form.indifferent_count);
  const disliked = participantCount ? individualCounts.disliked_count : parseNumber(form.disliked_count);
  const hated = participantCount ? individualCounts.hated_count : parseNumber(form.hated_count);
  const within = participantCount ? individualCounts.within_count : parseNumber(form.within_count);
  const outside = participantCount ? individualCounts.outside_count : parseNumber(form.outside_count);
  const total = form.method === 'WITHIN_OUTSIDE' ? within + outside : loved + liked + indifferent + disliked + hated;
  const positive = form.method === 'WITHIN_OUTSIDE' ? within : loved + liked;
  const acceptance = total > 0 ? (positive / total) * 100 : 0;
  return { threshold, acceptance, rejection: 0, distributed: 0, adhesion, adhesionLabel, approved: acceptance >= threshold, participantCount };
};

const SummaryCard: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone }) => (
  <div className={`rounded-3xl border px-5 py-4 shadow-sm ${tone || 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</div>
    <div className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{value}</div>
  </div>
);

const PnaeAcceptanceTests: React.FC = () => {
  const [dashboard, setDashboard] = useState<PnaeAcceptabilityDashboard | null>(null);
  const [tests, setTests] = useState<PnaeAcceptabilityTest[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [menus, setMenus] = useState<SimpleMenu[]>([]);
  const [recipes, setRecipes] = useState<SimpleRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ school: '', method: '', approved: '' });
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<PnaeAcceptabilityTest | null>(null);
  const [form, setForm] = useState<AcceptabilityForm>(emptyForm());
  const [participantDraft, setParticipantDraft] = useState<ParticipantDraft>(emptyParticipantDraft());
  const groupedEntryCounts = useMemo(
    () => deriveCountsFromEntries(form.respondent_entries),
    [form.respondent_entries],
  );
  const displayedCategoryCounts = useMemo(
    () => (form.respondent_entries.length
      ? groupedEntryCounts
      : {
          loved_count: parseNumber(form.loved_count),
          liked_count: parseNumber(form.liked_count),
          indifferent_count: parseNumber(form.indifferent_count),
          disliked_count: parseNumber(form.disliked_count),
          hated_count: parseNumber(form.hated_count),
          within_count: parseNumber(form.within_count),
          outside_count: parseNumber(form.outside_count),
        }),
    [form, groupedEntryCounts],
  );
  const preview = useMemo(() => buildPreview(form), [form]);
  const previousTestOptions = useMemo(
    () => tests.filter((item) => item.school === form.school && item.method === form.method && !item.approved && item.id !== editingTest?.id),
    [tests, form.school, form.method, editingTest?.id],
  );

  const loadTests = async () => {
    const response = (await getPnaeAcceptabilityTests({
      school: filters.school || undefined,
      method: filters.method || undefined,
      approved: filters.approved === '' ? undefined : filters.approved === 'true',
    })) as PnaeAcceptabilityTest[];
    setTests(response);
  };

  const loadBase = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardResponse, schoolResponse, recipeResponse] = await Promise.all([
        getPnaeAcceptabilityDashboard(),
        getSchools(),
        getRecipes({ active: true }),
      ]);
      setDashboard(dashboardResponse as PnaeAcceptabilityDashboard);
      setSchools(schoolResponse as School[]);
      setRecipes(recipeResponse as SimpleRecipe[]);
      await loadTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar a tela.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    if (!loading) {
      void loadTests().catch((err) => setError(err instanceof Error ? err.message : 'Falha ao atualizar lista.'));
    }
  }, [filters.school, filters.method, filters.approved]);

  useEffect(() => {
    if (!form.school) {
      setMenus([]);
      return;
    }
    void getMenus({ school: form.school }).then((response) => setMenus(response as SimpleMenu[])).catch(() => setMenus([]));
  }, [form.school]);

  const openCreate = () => {
    setEditingTest(null);
    setForm(emptyForm());
    setParticipantDraft(emptyParticipantDraft());
    setModalOpen(true);
  };

  const openEdit = (item: PnaeAcceptabilityTest) => {
    setEditingTest(item);
    setForm({
      school: item.school,
      menu: item.menu || '',
      recipe: item.recipe || '',
      previous_test: item.previous_test || '',
      method: item.method,
      objective: item.objective,
      analysis_scope: item.analysis_scope,
      service_mode: item.service_mode,
      preparation_name: item.preparation_name,
      target_group: item.target_group || '',
      respondent_profile: item.respondent_profile || 'STUDENT',
      respondent_entries: (item.respondent_entries || []).map((entry) => ({
        respondent_type: entry.respondent_type,
        label: entry.label || '',
        group_label: entry.group_label || '',
        response_code: entry.response_code,
      })),
      classes_sampled: item.classes_sampled || '',
      test_date: item.test_date,
      weather_context: item.weather_context || '',
      serving_time: item.serving_time || '',
      eligible_students_count: item.eligible_students_count ? String(item.eligible_students_count) : '',
      adhered_students_count: item.adhered_students_count ? String(item.adhered_students_count) : '',
      loved_count: String(item.loved_count || ''),
      liked_count: String(item.liked_count || ''),
      indifferent_count: String(item.indifferent_count || ''),
      disliked_count: String(item.disliked_count || ''),
      hated_count: String(item.hated_count || ''),
      within_count: String(item.within_count || ''),
      outside_count: String(item.outside_count || ''),
      prepared_weight: String(item.prepared_weight || ''),
      leftover_weight: String(item.leftover_weight || ''),
      plate_waste_weight: String(item.plate_waste_weight || ''),
      non_edible_weight: String(item.non_edible_weight || ''),
      positive_feedback: item.positive_feedback || '',
      negative_feedback: item.negative_feedback || '',
      notes: item.notes || '',
    });
    setParticipantDraft(emptyParticipantDraft());
    setModalOpen(true);
  };

  const handleMethodChange = (method: AcceptabilityForm['method']) => {
    const shouldResetEntries =
      method === 'REST_INGESTION'
      || (method === 'WITHIN_OUTSIDE' && form.method !== 'WITHIN_OUTSIDE')
      || (method !== 'WITHIN_OUTSIDE' && form.method === 'WITHIN_OUTSIDE');
    setForm((current) => ({
      ...current,
      method,
      objective: method === 'WITHIN_OUTSIDE' ? 'PROCUREMENT_SAMPLE' : current.objective,
      analysis_scope: method === 'WITHIN_OUTSIDE' ? 'PRODUCT' : method === 'REST_INGESTION' ? 'MENU' : 'PREPARATION',
      service_mode: method === 'WITHIN_OUTSIDE' ? 'PROCUREMENT_PANEL' : current.service_mode === 'PROCUREMENT_PANEL' ? 'CAFETERIA' : current.service_mode,
      respondent_profile: method === 'REST_INGESTION' ? 'NOT_INFORMED' : current.respondent_profile === 'NOT_INFORMED' ? 'STUDENT' : current.respondent_profile,
      respondent_entries: shouldResetEntries ? [] : current.respondent_entries,
    }));
    setParticipantDraft(emptyParticipantDraft());
  };

  const handleAddParticipant = (responseCode?: ParticipantDraft['response_code']) => {
    const selectedResponse = responseCode || participantDraft.response_code;
    if (!selectedResponse) {
      setError('Selecione a resposta do participante antes de adicionar.');
      return;
    }
    setError(null);
    setForm((current) => ({
      ...current,
      respondent_entries: [
        ...current.respondent_entries,
        {
          respondent_type: current.respondent_profile === 'PROFESSIONAL' ? 'PROFESSIONAL' : 'STUDENT',
          label: participantDraft.label.trim(),
          group_label: participantDraft.group_label.trim(),
          response_code: selectedResponse,
        },
      ],
    }));
    setParticipantDraft(emptyParticipantDraft());
  };

  const handleRemoveParticipant = (indexToRemove: number) => {
    setForm((current) => ({
      ...current,
      respondent_entries: current.respondent_entries.filter((_, index) => index !== indexToRemove),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const derivedCounts = deriveCountsFromEntries(form.respondent_entries);
      const payload = {
        ...form,
        menu: form.menu || null,
        recipe: form.recipe || null,
        previous_test: form.previous_test || null,
        eligible_students_count: form.eligible_students_count ? parseNumber(form.eligible_students_count) : null,
        adhered_students_count: form.adhered_students_count ? parseNumber(form.adhered_students_count) : (form.respondent_entries.length || null),
        loved_count: form.respondent_entries.length ? derivedCounts.loved_count : parseNumber(form.loved_count),
        liked_count: form.respondent_entries.length ? derivedCounts.liked_count : parseNumber(form.liked_count),
        indifferent_count: form.respondent_entries.length ? derivedCounts.indifferent_count : parseNumber(form.indifferent_count),
        disliked_count: form.respondent_entries.length ? derivedCounts.disliked_count : parseNumber(form.disliked_count),
        hated_count: form.respondent_entries.length ? derivedCounts.hated_count : parseNumber(form.hated_count),
        within_count: form.respondent_entries.length ? derivedCounts.within_count : parseNumber(form.within_count),
        outside_count: form.respondent_entries.length ? derivedCounts.outside_count : parseNumber(form.outside_count),
        prepared_weight: parseNumber(form.prepared_weight),
        leftover_weight: parseNumber(form.leftover_weight),
        plate_waste_weight: parseNumber(form.plate_waste_weight),
        non_edible_weight: parseNumber(form.non_edible_weight),
      };
      if (editingTest) {
        await updatePnaeAcceptabilityTest(editingTest.id, payload);
      } else {
        await createPnaeAcceptabilityTest(payload);
      }
      setModalOpen(false);
      await loadBase();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar o teste.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este teste de aceitabilidade?')) return;
    try {
      await deletePnaeAcceptabilityTest(id);
      await loadBase();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel excluir o teste.');
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-slate-500 dark:text-slate-400">Carregando testes de aceitabilidade...</div>;
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">PNAE | TESTE DE ACEITABILIDADE</div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900 dark:text-white">Registro operacional conforme o manual FNDE</h1>
              <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
                A plataforma registra escala hedonica, cartelas ludicas, resto-ingestao e dentro-fora do padrao com as regras de aprovacao, reteste e adesao do manual de 2017.
              </p>
            </div>
            <button onClick={openCreate} className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">
              Novo teste
            </button>
          </div>
        </section>

        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Total" value={String(dashboard?.total_tests || 0)} />
          <SummaryCard label="Aprovados" value={String(dashboard?.approved_tests || 0)} tone="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20" />
          <SummaryCard label="Reprovados" value={String(dashboard?.failed_tests || 0)} tone="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20" />
          <SummaryCard label="Aguardando reteste" value={String(dashboard?.pending_retest || 0)} />
          <SummaryCard label="Baixa adesao" value={String(dashboard?.low_adhesion_tests || 0)} />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          {(Object.keys(METHOD_CARDS) as Array<keyof typeof METHOD_CARDS>).map((key) => (
            <div key={key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm font-bold text-slate-900 dark:text-white">{METHOD_CARDS[key].title}</div>
              <div className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Corte minimo: {METHOD_CARDS[key].threshold}%</div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{METHOD_CARDS[key].note}</p>
            </div>
          ))}
        </div>

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 md:grid-cols-3">
            <select value={filters.school} onChange={(e) => setFilters((current) => ({ ...current, school: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Todas as escolas</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
            <select value={filters.method} onChange={(e) => setFilters((current) => ({ ...current, method: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Todos os metodos</option>
              <option value="HEDONIC">Escala hedonica</option>
              <option value="LUDIC">Cartelas ludicas</option>
              <option value="REST_INGESTION">Resto-ingestao</option>
              <option value="WITHIN_OUTSIDE">Dentro-fora do padrao</option>
            </select>
            <select value={filters.approved} onChange={(e) => setFilters((current) => ({ ...current, approved: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Todos os resultados</option>
              <option value="true">Somente aprovados</option>
              <option value="false">Somente abaixo do corte</option>
            </select>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {tests.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-8 py-16 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              Nenhum teste registrado ainda. Use o botao acima para iniciar o primeiro registro conforme o manual.
            </div>
          ) : tests.map((item) => (
            <article key={item.id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeTone(item.approved)}`}>{item.approved ? 'Aprovado' : 'Abaixo do corte'}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.method_display || METHOD_CARDS[item.method].title}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Tentativa {item.attempt_number}</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{item.preparation_name}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.school_name} | {formatDate(item.test_date)} | {item.objective_display || OBJECTIVE_LABELS[item.objective]}</p>
                  </div>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item.recommendation || 'Sem recomendacao registrada.'}</p>
                  {item.guidance_alerts?.length ? <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{item.guidance_alerts.join(' ')}</div> : null}
                </div>
                <div className="grid min-w-[18rem] gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950"><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Aceitacao</div><div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatPercent(item.acceptance_index)}</div></div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950"><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Corte minimo</div><div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatPercent(item.minimum_threshold)}</div></div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950"><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Adesao</div><div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatPercent(item.adhesion_index)}</div></div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950"><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Reteste minimo</div><div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{formatDate(item.next_retest_date)}</div></div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={() => openEdit(item)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Editar</button>
                <button onClick={() => handleDelete(item.id)} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30">Excluir</button>
              </div>
            </article>
          ))}
        </section>
      </div>
      {isModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/60 px-4 py-8">
          <div className="w-full max-w-6xl rounded-[2rem] bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1.4fr_0.9fr]">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">{editingTest ? 'Editar teste' : 'Novo teste de aceitabilidade'}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Preencha o registro conforme o metodo previsto no manual.</p>
                  </div>
                  <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">Fechar</button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <select value={form.school} onChange={(e) => setForm((current) => ({ ...current, school: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Escola</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select>
                  <input value={form.preparation_name} onChange={(e) => setForm((current) => ({ ...current, preparation_name: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Preparacao ou produto avaliado" />
                  <select value={form.method} onChange={(e) => handleMethodChange(e.target.value as AcceptabilityForm['method'])} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="HEDONIC">Escala hedonica</option><option value="LUDIC">Cartelas ludicas</option><option value="REST_INGESTION">Resto-ingestao</option><option value="WITHIN_OUTSIDE">Dentro-fora do padrao</option></select>
                  <input type="date" value={form.test_date} onChange={(e) => setForm((current) => ({ ...current, test_date: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
                  <select value={form.objective} onChange={(e) => setForm((current) => ({ ...current, objective: e.target.value as AcceptabilityForm['objective'] }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="NEW_OR_ATYPICAL">Preparacao nova ou atipica</option><option value="RECURRING_MENU">Cardapio frequente</option><option value="PROCUREMENT_SAMPLE">Amostra para aquisicao</option></select>
                  <select value={form.analysis_scope} onChange={(e) => setForm((current) => ({ ...current, analysis_scope: e.target.value as AcceptabilityForm['analysis_scope'] }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="PREPARATION">Preparacao</option><option value="MENU">Cardapio / refeicao</option><option value="PRODUCT">Produto / amostra</option></select>
                  <select value={form.service_mode} onChange={(e) => setForm((current) => ({ ...current, service_mode: e.target.value as AcceptabilityForm['service_mode'] }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="CAFETERIA">Refeitorio</option><option value="CLASSROOM">Sala de aula</option><option value="SELF_SERVICE">Autosservico</option><option value="PROCUREMENT_PANEL">Equipe de provadores</option></select>
                  <select value={form.menu} onChange={(e) => setForm((current) => ({ ...current, menu: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Cardapio vinculado (opcional)</option>{menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select>
                  <select value={form.recipe} onChange={(e) => setForm((current) => ({ ...current, recipe: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Receita vinculada (opcional)</option>{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select>
                  <select value={form.previous_test} onChange={(e) => setForm((current) => ({ ...current, previous_test: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 md:col-span-2"><option value="">Teste anterior (reteste opcional)</option>{previousTestOptions.map((item) => <option key={item.id} value={item.id}>{item.preparation_name} | tentativa {item.attempt_number} | {formatDate(item.test_date)}</option>)}</select>
                  <input value={form.target_group} onChange={(e) => setForm((current) => ({ ...current, target_group: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Publico avaliado" />
                  <input value={form.classes_sampled} onChange={(e) => setForm((current) => ({ ...current, classes_sampled: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Turmas amostradas" />
                  <input value={form.weather_context} onChange={(e) => setForm((current) => ({ ...current, weather_context: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Clima / contexto" />
                  <input value={form.serving_time} onChange={(e) => setForm((current) => ({ ...current, serving_time: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Horario da oferta" />
                  <input value={form.eligible_students_count} onChange={(e) => setForm((current) => ({ ...current, eligible_students_count: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Alunos elegiveis" />
                  <input value={form.adhered_students_count} onChange={(e) => setForm((current) => ({ ...current, adhered_students_count: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Alunos que aderiram" />
                </div>

                {form.method !== 'REST_INGESTION' ? (
                  <section className="rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/10">
                    <div className="flex flex-col gap-4">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">Coleta individual</div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Identifique o participante e aplique o teste clicando diretamente na categoria correspondente. O resultado atualiza automaticamente a cada lancamento.</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <select value={form.respondent_profile} onChange={(e) => setForm((current) => ({ ...current, respondent_profile: e.target.value as AcceptabilityForm['respondent_profile'] }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                          <option value="STUDENT">Aluno</option>
                          <option value="PROFESSIONAL">Profissional</option>
                        </select>
                        <input value={participantDraft.label} onChange={(e) => setParticipantDraft((current) => ({ ...current, label: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Nome ou identificador" />
                        <input value={participantDraft.group_label} onChange={(e) => setParticipantDraft((current) => ({ ...current, group_label: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder={form.respondent_profile === 'PROFESSIONAL' ? 'Cargo / setor' : 'Turma / grupo'} />
                      </div>
                      <div className="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/60">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Categorias do teste</div>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Clique na categoria avaliada para registrar imediatamente o participante atual.</p>
                        <div className={`mt-4 grid gap-3 ${form.method === 'WITHIN_OUTSIDE' ? 'md:grid-cols-2' : 'md:grid-cols-5'}`}>
                          {getResponseOptions(form.method).map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => handleAddParticipant(option.value)}
                              className={`rounded-2xl border px-4 py-4 text-left transition hover:-translate-y-0.5 ${RESPONSE_TONES[option.value]}`}
                            >
                              <div className="text-sm font-bold">{option.label}</div>
                              <div className="mt-1 text-xs opacity-80">
                                {form.respondent_profile === 'PROFESSIONAL' ? 'Registrar profissional nesta categoria' : 'Registrar aluno nesta categoria'}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-sm text-slate-600 dark:text-slate-300">{form.respondent_entries.length} participante(s) registrado(s)</div>
                        <button type="button" onClick={() => setParticipantDraft(emptyParticipantDraft())} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Limpar identificacao</button>
                      </div>
                      {form.respondent_entries.length > 0 ? (
                        <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {form.respondent_entries.map((entry, index) => (
                              <div key={`${entry.response_code}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                                <div>
                                  <div className="font-semibold text-slate-900 dark:text-white">{entry.label || `${entry.respondent_type === 'PROFESSIONAL' ? 'Profissional' : 'Aluno'} ${index + 1}`}</div>
                                  <div className="text-slate-500 dark:text-slate-400">{entry.group_label || '-'} | {RESPONSE_LABELS[entry.response_code]}</div>
                                </div>
                                <button type="button" onClick={() => handleRemoveParticipant(index)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30">Remover</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {form.method === 'REST_INGESTION' ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={form.prepared_weight} onChange={(e) => setForm((current) => ({ ...current, prepared_weight: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Peso preparado (kg)" />
                    <input value={form.leftover_weight} onChange={(e) => setForm((current) => ({ ...current, leftover_weight: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Sobras (kg)" />
                    <input value={form.plate_waste_weight} onChange={(e) => setForm((current) => ({ ...current, plate_waste_weight: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Resto rejeitado (kg)" />
                    <input value={form.non_edible_weight} onChange={(e) => setForm((current) => ({ ...current, non_edible_weight: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Partes nao comestiveis (kg)" />
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">Resumo por categoria</div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">A plataforma consolida automaticamente as categorias aplicadas no teste. Este quadro substitui o lancamento manual de totais.</p>
                    <div className={`mt-4 grid gap-3 ${form.method === 'WITHIN_OUTSIDE' ? 'md:grid-cols-2' : 'md:grid-cols-5'}`}>
                      {getResponseOptions(form.method).map((option) => {
                        const value = option.value === 'LOVED'
                          ? displayedCategoryCounts.loved_count
                          : option.value === 'LIKED'
                            ? displayedCategoryCounts.liked_count
                            : option.value === 'INDIFFERENT'
                              ? displayedCategoryCounts.indifferent_count
                              : option.value === 'DISLIKED'
                                ? displayedCategoryCounts.disliked_count
                                : option.value === 'HATED'
                                  ? displayedCategoryCounts.hated_count
                                  : option.value === 'WITHIN'
                                    ? displayedCategoryCounts.within_count
                                    : displayedCategoryCounts.outside_count;
                        return (
                          <div key={option.value} className={`rounded-2xl border px-4 py-4 ${RESPONSE_TONES[option.value]}`}>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">{option.label}</div>
                            <div className="mt-2 text-3xl font-black">{value}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <textarea value={form.positive_feedback} onChange={(e) => setForm((current) => ({ ...current, positive_feedback: e.target.value }))} className="min-h-[90px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Pontos positivos observados" />
                <textarea value={form.negative_feedback} onChange={(e) => setForm((current) => ({ ...current, negative_feedback: e.target.value }))} className="min-h-[90px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Pontos negativos observados" />
                <textarea value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} className="min-h-[90px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Observacoes gerais" />
                <div className="flex justify-end">
                  <button onClick={handleSave} disabled={saving} className="rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Salvando...' : editingTest ? 'Atualizar teste' : 'Salvar teste'}</button>
                </div>
              </div>

              <aside className="rounded-[2rem] bg-slate-50 p-5 dark:bg-slate-950">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Painel didatico</div>
                <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">{METHOD_CARDS[form.method].title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{METHOD_CARDS[form.method].note}</p>
                <div className="mt-5 space-y-3">
                  {form.method !== 'REST_INGESTION' ? <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900"><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Participantes lancados</div><div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{preview.participantCount}</div></div> : null}
                  <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900"><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Indice de aceitacao</div><div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{formatPercent(preview.acceptance)}</div></div>
                  <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900"><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Corte minimo</div><div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{formatPercent(preview.threshold)}</div></div>
                  <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900"><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Indice de adesao</div><div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatPercent(preview.adhesion)}</div><div className="mt-1 text-xs text-slate-500">{preview.adhesionLabel}</div></div>
                  {form.method === 'REST_INGESTION' ? <div className="rounded-2xl bg-white px-4 py-3 dark:bg-slate-900"><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Resto e distribuicao</div><div className="mt-2 text-sm text-slate-600 dark:text-slate-300">Distribuido: {preview.distributed.toFixed(2)} kg | Rejeicao: {formatPercent(preview.rejection)}</div></div> : null}
                  <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${preview.approved ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'}`}>
                    {preview.approved ? 'Resultado dentro do corte recomendado pelo manual.' : 'Resultado abaixo do corte. O manual orienta reteste apos no minimo um bimestre.'}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PnaeAcceptanceTests;
