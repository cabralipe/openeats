import React, { useEffect, useMemo, useState } from 'react';
import { getPnaeAcceptanceCatalog, runPnaeAcceptanceSuite } from '../api';
import type {
  PnaeAcceptanceScenarioDefinition,
  PnaeAcceptanceScenarioResult,
  PnaeAcceptanceSuiteCatalog,
  PnaeAcceptanceSuiteRun,
} from '../types';

const formatDateTime = (value?: string) => {
  if (!value) return 'Ainda nao executado';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatDuration = (durationMs?: number) => {
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs)) return '--';
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(2)} s`;
};

const ResultBadge: React.FC<{ status?: 'PASSED' | 'FAILED' }> = ({ status }) => {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
        <span className="material-symbols-outlined text-sm">schedule</span>
        Aguardando execucao
      </span>
    );
  }

  const passed = status === 'PASSED';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
        passed
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
      }`}
    >
      <span className="material-symbols-outlined text-sm">{passed ? 'check_circle' : 'error'}</span>
      {passed ? 'Aprovado' : 'Falhou'}
    </span>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; hint: string; icon: string }> = ({ label, value, hint, icon }) => (
  <article className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
      <span className="material-symbols-outlined">{icon}</span>
    </div>
    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{value}</p>
    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{hint}</p>
  </article>
);

const ScenarioCard: React.FC<{
  scenario: PnaeAcceptanceScenarioDefinition;
  result?: PnaeAcceptanceScenarioResult;
}> = ({ scenario, result }) => {
  return (
    <article className="rounded-[28px] border border-slate-200/70 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
              <span className="material-symbols-outlined">fact_check</span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-500">{scenario.id}</p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{scenario.title}</h3>
            </div>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{scenario.description}</p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <ResultBadge status={result?.status} />
          <span className="text-xs font-medium text-slate-400">Duracao: {formatDuration(result?.duration_ms)}</span>
        </div>
      </div>

      {result?.details?.length ? (
        <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-4 dark:bg-slate-800/60">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Validacoes executadas</p>
          <div className="space-y-2">
            {result.details.map((detail) => (
              <div key={detail} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="material-symbols-outlined mt-0.5 text-base text-primary-500">task_alt</span>
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result?.error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 dark:border-rose-900/40 dark:bg-rose-950/20">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">Falha encontrada</p>
          <p className="text-sm leading-relaxed text-rose-700 dark:text-rose-200">{result.error}</p>
        </div>
      ) : null}
    </article>
  );
};

const PnaeAcceptanceTests: React.FC = () => {
  const [catalog, setCatalog] = useState<PnaeAcceptanceSuiteCatalog | null>(null);
  const [runResult, setRunResult] = useState<PnaeAcceptanceSuiteRun | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCatalog = async () => {
      setLoadingCatalog(true);
      setError('');
      try {
        const response = await getPnaeAcceptanceCatalog() as PnaeAcceptanceSuiteCatalog;
        setCatalog(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nao foi possivel carregar a bateria de testes.');
      } finally {
        setLoadingCatalog(false);
      }
    };
    loadCatalog();
  }, []);

  const handleRunSuite = async () => {
    setRunning(true);
    setError('');
    try {
      const response = await runPnaeAcceptanceSuite() as PnaeAcceptanceSuiteRun;
      setRunResult(response);
      if (!catalog) {
        setCatalog(response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel executar os testes de aceitabilidade.');
    } finally {
      setRunning(false);
    }
  };

  const scenarios = catalog?.scenarios || runResult?.scenarios || [];
  const resultsById = useMemo(() => {
    const entries = runResult?.results || [];
    return new Map(entries.map((result) => [result.id, result]));
  }, [runResult]);

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-950 via-slate-900 to-primary-900 px-6 py-8 text-white shadow-2xl sm:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-primary-100">
                Qualidade do modulo PNAE
              </span>
              <div>
                <h2 className="text-3xl font-black tracking-tight sm:text-5xl">Testes de aceitabilidade dentro da plataforma</h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base">
                  Esta bateria executa cenarios reais do PNAE pelo proprio sistema, validando workflow, restricoes,
                  integracoes operacionais e escopo por municipio sem sujar a base.
                </p>
              </div>
            </div>

            <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <span className="material-symbols-outlined text-2xl">shield_with_house</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-100">Modo de execucao</p>
                  <p className="text-base font-semibold text-white">Interno ao sistema</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-200">
                <p className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-emerald-300">task_alt</span>
                  Dados temporarios com rollback automatico
                </p>
                <p className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-emerald-300">task_alt</span>
                  Cenarios executados pelos mesmos endpoints do modulo
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Cenarios cadastrados"
            value={loadingCatalog ? '...' : String(scenarios.length)}
            hint="Cobrem criacao, validacao, workflow, geracao operacional e visibilidade por perfil."
            icon="checklist"
          />
          <SummaryCard
            label="Ultima execucao"
            value={runResult ? formatDateTime(runResult.executed_at) : 'Nao executado'}
            hint="Resultados aparecem logo abaixo, por cenario, sem sair da plataforma."
            icon="schedule"
          />
          <SummaryCard
            label="Status atual"
            value={runResult?.summary.status === 'FAILED' ? 'Falhas' : runResult ? 'Aprovado' : 'Pendente'}
            hint="Sempre que a bateria roda, todo o contexto criado para teste e descartado ao final."
            icon={runResult?.summary.status === 'FAILED' ? 'warning' : 'verified'}
          />
        </section>

        <section className="rounded-[32px] border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-500">Execucao assistida</p>
              <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Rodar bateria de aceitabilidade do PNAE</h3>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Use esta execucao para validar o modulo antes de homologacao, mudancas sensiveis ou liberacao para municipio.
              </p>
            </div>
            <button
              onClick={handleRunSuite}
              disabled={running || loadingCatalog}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-primary-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="material-symbols-outlined">{running ? 'progress_activity' : 'play_arrow'}</span>
              {running ? 'Executando cenarios...' : 'Executar bateria completa'}
            </button>
          </div>

          {runResult ? (
            <div className="mt-6 grid gap-4 rounded-[28px] bg-slate-50 p-5 dark:bg-slate-800/60 md:grid-cols-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Total</p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{runResult.summary.total}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Aprovados</p>
                <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-300">{runResult.summary.passed}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Falhas</p>
                <p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-300">{runResult.summary.failed}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Duracao</p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatDuration(runResult.summary.duration_ms)}</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200">
              {error}
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-500">Catalogo de cenarios</p>
              <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">O que a plataforma valida</h3>
            </div>
            <div className="text-xs font-medium text-slate-400">
              {runResult?.rolled_back ?? catalog?.rolled_back ? 'Rollback ativo apos cada cenario' : 'Persistencia habilitada'}
            </div>
          </div>

          {loadingCatalog ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              Carregando cenarios do modulo PNAE...
            </div>
          ) : (
            <div className="space-y-4">
              {scenarios.map((scenario) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  result={resultsById.get(scenario.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PnaeAcceptanceTests;
