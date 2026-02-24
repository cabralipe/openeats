import React, { useEffect, useMemo, useState } from 'react';
import {
  createNutritionist,
  deactivateNutritionist,
  getAuditLogs,
  getNutritionists,
  updateNutritionist,
} from '../api';

type AuditLogItem = {
  id: string;
  user: string;
  user_email?: string;
  user_name?: string;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE' | string;
  method: string;
  path: string;
  action_route?: string;
  status_code?: number | null;
  request_payload?: unknown;
  payload_before?: unknown;
  payload_after?: unknown;
  created_at: string;
};

type AuditLogResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: AuditLogItem[];
};

type Nutritionist = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  date_joined: string;
};

const PAGE_SIZE = 20;

const JsonBlock: React.FC<{ value: unknown; emptyLabel?: string }> = ({ value, emptyLabel = 'Sem dados' }) => {
  if (value === null || value === undefined || value === '') {
    return <p className="text-xs text-slate-400">{emptyLabel}</p>;
  }
  return (
    <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-auto max-h-56">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
};

const Audit: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'logs' | 'nutritionists'>('logs');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [logsCount, setLogsCount] = useState(0);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logPage, setLogPage] = useState(1);
  const [logFilters, setLogFilters] = useState({
    user_id: '',
    action_type: '',
    method: '',
    path: '',
    date_from: '',
    date_to: '',
  });

  const [nutritionists, setNutritionists] = useState<Nutritionist[]>([]);
  const [nutritionistsLoading, setNutritionistsLoading] = useState(true);
  const [nutritionistQuery, setNutritionistQuery] = useState('');
  const [nutritionistStatus, setNutritionistStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showNutModal, setShowNutModal] = useState(false);
  const [editingNutritionist, setEditingNutritionist] = useState<Nutritionist | null>(null);
  const [savingNutritionist, setSavingNutritionist] = useState(false);
  const [nutForm, setNutForm] = useState({
    name: '',
    email: '',
    password: '',
    is_active: true,
  });

  const loadLogs = async (
    page = logPage,
    filtersOverride?: typeof logFilters,
  ) => {
    const filters = filtersOverride || logFilters;
    setLogsLoading(true);
    setError('');
    try {
      const data = await getAuditLogs({
        ...filters,
        page,
        page_size: PAGE_SIZE,
        action_type: (filters.action_type || undefined) as 'CREATE' | 'UPDATE' | 'DELETE' | undefined,
        method: filters.method || undefined,
      }) as AuditLogResponse;
      setLogs(Array.isArray(data?.results) ? data.results : []);
      setLogsCount(Number(data?.count || 0));
      setLogPage(page);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os logs de auditoria.');
    } finally {
      setLogsLoading(false);
    }
  };

  const loadNutritionists = async () => {
    setNutritionistsLoading(true);
    setError('');
    try {
      const data = await getNutritionists({
        q: nutritionistQuery || undefined,
        is_active:
          nutritionistStatus === 'all' ? undefined : nutritionistStatus === 'active',
      }) as Nutritionist[];
      setNutritionists(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as nutricionistas.');
    } finally {
      setNutritionistsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadNutritionists();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nutritionistQuery, nutritionistStatus]);

  const totalPages = Math.max(1, Math.ceil(logsCount / PAGE_SIZE));

  const openCreateNutritionist = () => {
    setEditingNutritionist(null);
    setNutForm({ name: '', email: '', password: '', is_active: true });
    setShowNutModal(true);
  };

  const openEditNutritionist = (nutritionist: Nutritionist) => {
    setEditingNutritionist(nutritionist);
    setNutForm({
      name: nutritionist.name || '',
      email: nutritionist.email || '',
      password: '',
      is_active: nutritionist.is_active,
    });
    setShowNutModal(true);
  };

  const submitNutritionist = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNutritionist(true);
    setError('');
    setSuccess('');
    try {
      if (editingNutritionist) {
        const payload: { name?: string; email?: string; password?: string; is_active?: boolean } = {
          name: nutForm.name.trim(),
          email: nutForm.email.trim().toLowerCase(),
          is_active: nutForm.is_active,
        };
        if (nutForm.password.trim()) payload.password = nutForm.password;
        await updateNutritionist(editingNutritionist.id, payload);
        setSuccess('Nutricionista atualizada.');
      } else {
        if (!nutForm.password.trim()) {
          throw new Error('Informe a senha para cadastrar.');
        }
        await createNutritionist({
          name: nutForm.name.trim() || 'Nutricionista',
          email: nutForm.email.trim().toLowerCase(),
          password: nutForm.password,
        });
        setSuccess('Nutricionista cadastrada.');
      }
      setShowNutModal(false);
      await loadNutritionists();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar a nutricionista.');
    } finally {
      setSavingNutritionist(false);
    }
  };

  const handleDeactivateNutritionist = async (nutritionist: Nutritionist) => {
    if (!window.confirm(`Desativar ${nutritionist.email}?`)) return;
    setError('');
    setSuccess('');
    try {
      await deactivateNutritionist(nutritionist.id);
      setSuccess('Nutricionista desativada.');
      await loadNutritionists();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível desativar a nutricionista.');
    }
  };

  const statusSummary = useMemo(() => {
    const active = nutritionists.filter((item) => item.is_active).length;
    return {
      total: nutritionists.length,
      active,
      inactive: nutritionists.length - active,
    };
  }, [nutritionists]);

  return (
    <div className="flex flex-col flex-1 pb-24 lg:pb-8">
      <div className="p-4 lg:p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Auditoria e Usuários</h1>
            <p className="text-sm text-slate-500 mt-1">
              Consulte logs de ações e gerencie o cadastro de nutricionistas.
            </p>
          </div>
          {activeTab === 'nutritionists' && (
            <button onClick={openCreateNutritionist} className="btn-primary">
              <span className="material-symbols-outlined text-base">person_add</span>
              Cadastrar nutricionista
            </button>
          )}
        </div>

        <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`chip ${activeTab === 'logs' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : ''}`}
          >
            <span className="material-symbols-outlined text-sm">history</span>
            Auditoria
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('nutritionists')}
            className={`chip ${activeTab === 'nutritionists' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : ''}`}
          >
            <span className="material-symbols-outlined text-sm">groups</span>
            Nutricionistas
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 lg:mx-6 mt-4 p-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 text-danger-600 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}
      {success && (
        <div className="mx-4 lg:mx-6 mt-4 p-4 rounded-xl bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          {success}
        </div>
      )}

      <div className="flex-1 p-4 lg:p-6">
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="card p-4 lg:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <input
                  className="input"
                  placeholder="Filtrar por rota/caminho"
                  value={logFilters.path}
                  onChange={(e) => setLogFilters((prev) => ({ ...prev, path: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="User ID (opcional)"
                  value={logFilters.user_id}
                  onChange={(e) => setLogFilters((prev) => ({ ...prev, user_id: e.target.value }))}
                />
                <select
                  className="input"
                  value={logFilters.action_type}
                  onChange={(e) => setLogFilters((prev) => ({ ...prev, action_type: e.target.value }))}
                >
                  <option value="">Ação (todas)</option>
                  <option value="CREATE">CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <select
                  className="input"
                  value={logFilters.method}
                  onChange={(e) => setLogFilters((prev) => ({ ...prev, method: e.target.value }))}
                >
                  <option value="">Método (todos)</option>
                  <option value="POST">POST</option>
                  <option value="PATCH">PATCH</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="GET">GET</option>
                </select>
                <input
                  className="input"
                  type="date"
                  value={logFilters.date_from}
                  onChange={(e) => setLogFilters((prev) => ({ ...prev, date_from: e.target.value }))}
                />
                <input
                  className="input"
                  type="date"
                  value={logFilters.date_to}
                  onChange={(e) => setLogFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => loadLogs(1)}
                  className="btn-primary"
                  disabled={logsLoading}
                >
                  <span className="material-symbols-outlined text-base">search</span>
                  Buscar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const resetFilters = {
                      user_id: '',
                      action_type: '',
                      method: '',
                      path: '',
                      date_from: '',
                      date_to: '',
                    };
                    setLogFilters(resetFilters);
                    loadLogs(1, resetFilters);
                  }}
                  className="btn-secondary"
                  disabled={logsLoading}
                >
                  Limpar filtros
                </button>
              </div>
            </div>

            <div className="card p-4 lg:p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">Logs</h2>
                  <p className="text-xs text-slate-500">
                    {logsCount} registro(s) • página {logPage} de {totalPages}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={logsLoading || logPage <= 1}
                    onClick={() => loadLogs(logPage - 1)}
                  >
                    <span className="material-symbols-outlined text-base">chevron_left</span>
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={logsLoading || logPage >= totalPages}
                    onClick={() => loadLogs(logPage + 1)}
                  >
                    Próxima
                    <span className="material-symbols-outlined text-base">chevron_right</span>
                  </button>
                </div>
              </div>

              {logsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 animate-pulse">
                      <div className="h-4 w-56 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                      <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded" />
                    </div>
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <span className="material-symbols-outlined text-3xl">history_toggle_off</span>
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Nenhum log encontrado</p>
                  <p className="text-sm text-slate-500 mt-1">Ajuste os filtros e tente novamente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <details
                      key={log.id}
                      className="group border border-slate-200 dark:border-slate-700 rounded-2xl p-4"
                    >
                      <summary className="list-none cursor-pointer">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`badge ${
                                log.action_type === 'DELETE'
                                  ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
                                  : log.action_type === 'CREATE'
                                    ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                                    : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                              }`}>
                                {log.action_type}
                              </span>
                              <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                {log.method}
                              </span>
                              {typeof log.status_code === 'number' && (
                                <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {log.status_code}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white break-all">
                              {log.path}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 break-all">
                              {(log.user_name || 'Usuário')} • {log.user_email || 'sem e-mail'} • {new Date(log.created_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-base group-open:rotate-180 transition-transform">expand_more</span>
                            Ver detalhes
                          </div>
                        </div>
                      </summary>
                      <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Request</p>
                          <JsonBlock value={log.request_payload} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Antes</p>
                          <JsonBlock value={log.payload_before} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Depois</p>
                          <JsonBlock value={log.payload_after} />
                        </div>
                      </div>
                      {log.action_route && (
                        <p className="mt-3 text-xs text-slate-500">
                          <span className="font-semibold">Rota:</span> {log.action_route}
                        </p>
                      )}
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'nutritionists' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="stat-card">
                <p className="stat-value">{nutritionistsLoading ? '...' : statusSummary.total}</p>
                <p className="stat-label">Total</p>
              </div>
              <div className="stat-card">
                <p className="stat-value text-success-600">{nutritionistsLoading ? '...' : statusSummary.active}</p>
                <p className="stat-label">Ativas</p>
              </div>
              <div className="stat-card">
                <p className="stat-value text-slate-500">{nutritionistsLoading ? '...' : statusSummary.inactive}</p>
                <p className="stat-label">Inativas</p>
              </div>
            </div>

            <div className="card p-4 lg:p-5">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <input
                  className="input"
                  placeholder="Buscar por e-mail"
                  value={nutritionistQuery}
                  onChange={(e) => setNutritionistQuery(e.target.value)}
                />
                <select
                  className="input min-w-52"
                  value={nutritionistStatus}
                  onChange={(e) => setNutritionistStatus(e.target.value as 'all' | 'active' | 'inactive')}
                >
                  <option value="all">Status: todos</option>
                  <option value="active">Somente ativas</option>
                  <option value="inactive">Somente inativas</option>
                </select>
              </div>
            </div>

            <div className="card p-4 lg:p-5">
              {nutritionistsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  ))}
                </div>
              ) : nutritionists.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <span className="material-symbols-outlined text-3xl">person_off</span>
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Nenhuma nutricionista cadastrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {nutritionists.map((nutritionist) => (
                    <div
                      key={nutritionist.id}
                      className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {nutritionist.name || 'Nutricionista'}
                          </p>
                          <span className={`badge ${nutritionist.is_active ? 'badge-success' : 'badge-warning'}`}>
                            {nutritionist.is_active ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 break-all">{nutritionist.email}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Cadastro: {new Date(nutritionist.date_joined).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openEditNutritionist(nutritionist)} className="btn-secondary">
                          <span className="material-symbols-outlined text-base">edit</span>
                          Editar
                        </button>
                        {nutritionist.is_active && (
                          <button
                            type="button"
                            onClick={() => handleDeactivateNutritionist(nutritionist)}
                            className="btn-danger"
                          >
                            <span className="material-symbols-outlined text-base">person_off</span>
                            Desativar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showNutModal && (
        <div className="modal-overlay p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {editingNutritionist ? 'Editar nutricionista' : 'Cadastrar nutricionista'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {editingNutritionist ? 'Atualize os dados do usuário.' : 'Cria um usuário com perfil nutricionista.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNutModal(false)}
                className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            <form onSubmit={submitNutritionist} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nome</label>
                <input
                  className="input"
                  value={nutForm.name}
                  onChange={(e) => setNutForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex.: Maria Silva"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">E-mail *</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={nutForm.email}
                  onChange={(e) => setNutForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="maria@semed.gov.br"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Senha {editingNutritionist ? '(opcional para alterar)' : '*'}
                </label>
                <input
                  className="input"
                  type="password"
                  value={nutForm.password}
                  onChange={(e) => setNutForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder={editingNutritionist ? 'Deixe em branco para manter' : 'Mínimo 8 caracteres'}
                  minLength={editingNutritionist ? undefined : 8}
                  required={!editingNutritionist}
                />
              </div>

              {editingNutritionist && (
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={nutForm.is_active}
                    onChange={(e) => setNutForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    className="w-5 h-5 rounded"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Usuária ativa</p>
                    <p className="text-xs text-slate-500">Desmarque para manter inativa.</p>
                  </div>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNutModal(false)} className="btn-secondary" disabled={savingNutritionist}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={savingNutritionist}>
                  {savingNutritionist ? 'Salvando...' : editingNutritionist ? 'Salvar alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Audit;
