import React, { useEffect, useMemo, useState } from 'react';
import { getMe, getPnaeAcceptanceCatalog, runPnaeAcceptanceSuite } from '../api';
import {
  PnaeAcceptanceScenarioDefinition,
  PnaeAcceptanceSuiteCatalog,
  PnaeAcceptanceSuiteRun,
} from '../types';

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  role_display?: string;
};

const VIEWER_ROLES = new Set([
  'SEMED_ADMIN',
  'MUNICIPAL_MANAGER',
  'NUTRITIONIST',
  'SCHOOL_FEEDING_COORDINATOR',
  'SCHOOL_DIRECTOR',
  'CAE_COUNCILOR',
]);

const MANAGER_ROLES = new Set([
  'SEMED_ADMIN',
  'MUNICIPAL_MANAGER',
  'NUTRITIONIST',
  'SCHOOL_FEEDING_COORDINATOR',
]);

const parseErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim() ? error.message : fallback;

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR') : '-';

const formatDuration = (value?: number) => {
  const duration = Number(value || 0);
  if (duration < 1000) return `${duration} ms`;
  return `${(duration / 1000).toFixed(2)} s`;
};

const ResultTone = {
  PASSED:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300',
  FAILED:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300',
} as const;

const SummaryCard: React.FC<{
  label: string;
  value: string;
  tone?: string;
}> = ({ label, value, tone }) => (
  <div className={`rounded-3xl border p-5 shadow-sm ${tone || 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
    <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{label}</div>
    <div className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{value}</div>
  </div>
);

const ScenarioCard: React.FC<{
  scenario: PnaeAcceptanceScenarioDefinition;
  selected: boolean;
  disabled: boolean;
  onToggle: (scenarioId: string) => void;
}> = ({ scenario, selected, disabled, onToggle }) => (
  <button
    type="button"
    onClick={() => onToggle(scenario.id)}
    disabled={disabled}
    className={`rounded-[1.75rem] border p-5 text-left transition ${
      selected
        ? 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/20'
        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
    } ${disabled ? 'cursor-default opacity-70' : ''}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-slate-900 dark:text-white">{scenario.title}</div>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{scenario.description}</p>
      </div>
      <span
        className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
          selected
            ? 'border-blue-500 bg-blue-500 text-white'
            : 'border-slate-300 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900'
        }`}
      >
        {selected ? '✓' : ''}
      </span>
    </div>
  </button>
);

const PnaeAcceptanceSuite: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [catalog, setCatalog] = useState<PnaeAcceptanceSuiteCatalog | null>(null);
  const [lastRun, setLastRun] = useState<PnaeAcceptanceSuiteRun | null>(null);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const canViewPnae = Boolean(currentUser?.role && VIEWER_ROLES.has(currentUser.role));
  const canManagePnae = Boolean(currentUser?.role && MANAGER_ROLES.has(currentUser.role));

  const loadBase = async () => {
    setBootstrapping(true);
    setError('');
    try {
      const [userData, catalogData] = await Promise.all([
        getMe(),
        getPnaeAcceptanceCatalog(),
      ]);
      setCurrentUser(userData as CurrentUser);
      const nextCatalog = catalogData as PnaeAcceptanceSuiteCatalog;
      setCatalog(nextCatalog);
      setSelectedScenarioIds((current) =>
        current.length ? current : nextCatalog.scenarios.map((scenario) => scenario.id),
      );
    } catch (err) {
      setError(parseErrorMessage(err, 'Nao foi possivel carregar a suite de aceitacao.'));
    } finally {
      setBootstrapping(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  const selectedCount = selectedScenarioIds.length;
  const isAllSelected = Boolean(catalog && selectedCount === catalog.scenarios.length);

  const executionSummary = useMemo(() => {
    if (!lastRun) return null;
    return [
      { label: 'Cenarios executados', value: String(lastRun.summary.total) },
      {
        label: 'Aprovados',
        value: String(lastRun.summary.passed),
        tone: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20',
      },
      {
        label: 'Falhos',
        value: String(lastRun.summary.failed),
        tone: 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20',
      },
      { label: 'Duracao', value: formatDuration(lastRun.summary.duration_ms) },
    ];
  }, [lastRun]);

  const toggleScenario = (scenarioId: string) => {
    if (!canManagePnae) return;
    setSelectedScenarioIds((current) =>
      current.includes(scenarioId)
        ? current.filter((id) => id !== scenarioId)
        : [...current, scenarioId],
    );
  };

  const handleSelectAll = () => {
    if (!catalog || !canManagePnae) return;
    setSelectedScenarioIds(catalog.scenarios.map((scenario) => scenario.id));
  };

  const handleClearSelection = () => {
    if (!canManagePnae) return;
    setSelectedScenarioIds([]);
  };

  const handleRunSuite = async () => {
    if (!catalog || !canManagePnae) return;
    if (!selectedScenarioIds.length) {
      setError('Selecione ao menos um cenario para executar a suite.');
      return;
    }
    setRunning(true);
    setError('');
    try {
      const payload =
        selectedScenarioIds.length === catalog.scenarios.length
          ? undefined
          : { scenario_ids: selectedScenarioIds };
      const run = (await runPnaeAcceptanceSuite(payload)) as PnaeAcceptanceSuiteRun;
      setLastRun(run);
    } catch (err) {
      setError(parseErrorMessage(err, 'Nao foi possivel executar a suite de aceitacao.'));
    } finally {
      setRunning(false);
    }
  };

  if (bootstrapping) {
    return <div className="p-8 text-sm text-slate-500 dark:text-slate-400">Carregando suite de aceitacao do PNAE...</div>;
  }

  if (currentUser && !canViewPnae) {
    return (
      <div className="min-h-full bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <section className="rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">PNAE | SUITE DE ACEITACAO</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Acesso indisponivel</h1>
            <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
              Seu perfil atual nao possui permissao para acessar esta suite.
            </p>
          </section>
        </div>
      </div>
    );
  }

  if (!currentUser || !catalog) {
    return <div className="p-8 text-sm text-slate-500 dark:text-slate-400">{error || 'Nao foi possivel carregar os dados da suite.'}</div>;
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">PNAE | SUITE DE ACEITACAO</div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900 dark:text-white">Validacao interna da plataforma</h1>
              <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
                Execute a bateria interna do modulo PNAE dentro da propria aplicacao, com rollback automatico e resultado por cenario.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {catalog.execution_mode}
                </span>
                {catalog.rolled_back ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                    rollback automatico
                  </span>
                ) : null}
                {!canManagePnae ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    perfil somente leitura
                  </span>
                ) : null}
              </div>
            </div>
            {canManagePnae ? (
              <button
                type="button"
                onClick={handleRunSuite}
                disabled={running}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? 'Executando suite...' : 'Executar suite'}
              </button>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Suite" value={catalog.suite_name} />
          <SummaryCard label="Cenarios" value={String(catalog.scenarios.length)} />
          <SummaryCard label="Selecionados" value={String(selectedCount)} />
          <SummaryCard label="Ultima execucao" value={lastRun ? formatDateTime(lastRun.executed_at) : 'Nao executada'} />
        </div>

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Catalogo de cenarios</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Cada cenario executa um fluxo isolado da plataforma e desfaz os dados ao final.
              </p>
            </div>
            {canManagePnae ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleSelectAll} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  Selecionar tudo
                </button>
                <button type="button" onClick={handleClearSelection} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  Limpar
                </button>
                <span className="inline-flex items-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {isAllSelected ? 'Execucao completa' : 'Execucao parcial'}
                </span>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {catalog.scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                selected={selectedScenarioIds.includes(scenario.id)}
                disabled={!canManagePnae}
                onToggle={toggleScenario}
              />
            ))}
          </div>
        </section>

        {lastRun ? (
          <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Ultima execucao</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Executada em {formatDateTime(lastRun.executed_at)} por {lastRun.executed_by?.name || 'usuario autenticado'}.
                </p>
              </div>
              <span className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] ${ResultTone[lastRun.summary.status]}`}>
                {lastRun.summary.status === 'PASSED' ? 'suite aprovada' : 'suite com falhas'}
              </span>
            </div>

            {executionSummary ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {executionSummary.map((item) => (
                  <SummaryCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
                ))}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              {lastRun.results.map((result) => (
                <article
                  key={result.id}
                  className={`rounded-[1.75rem] border p-5 ${ResultTone[result.status]}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-lg font-bold">{result.title}</div>
                      <p className="mt-2 text-sm leading-6 opacity-90">{result.description}</p>
                    </div>
                    <div className="text-sm font-semibold">{formatDuration(result.duration_ms)}</div>
                  </div>
                  {result.details?.length ? (
                    <div className="mt-4 space-y-2 text-sm">
                      {result.details.map((detail) => (
                        <p key={detail}>{detail}</p>
                      ))}
                    </div>
                  ) : null}
                  {result.error ? <p className="mt-4 text-sm font-semibold">{result.error}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default PnaeAcceptanceSuite;
