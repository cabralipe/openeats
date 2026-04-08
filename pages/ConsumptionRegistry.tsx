import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  exportConsumptionPdf,
  exportConsumptionXlsx,
  getSchools,
  getSchoolConsumption,
  getSchoolMealService,
  getStockMovements,
  submitSchoolConsumption,
  submitSchoolMealService,
} from '../api';
import { School, SchoolConsumptionPayload, SchoolMealServicePayload } from '../types';

type ConsumptionFormRow = {
  quantity: string;
  note: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const parseError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim() ? error.message : fallback;

const formatNumber = (value: unknown, decimals = 2) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value || 0));

const formatInteger = (value: unknown) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(value || 0));

const formatDate = (value?: string | null) =>
  value ? new Date(value.length <= 10 ? `${value}T12:00:00` : value).toLocaleDateString('pt-BR') : '-';

const toneByStatus: Record<string, string> = {
  BAIXO: 'bg-danger-50 text-danger-600 border-danger-200 dark:bg-danger-900/20 dark:text-danger-300 dark:border-danger-900/40',
  NORMAL: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40',
  ALTO: 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/20 dark:text-primary-300 dark:border-primary-900/40',
};

const ConsumptionRegistry: React.FC = () => {
  const navigate = useNavigate();

  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [referenceDate, setReferenceDate] = useState(today());
  const [consumptionData, setConsumptionData] = useState<SchoolConsumptionPayload | null>(null);
  const [mealData, setMealData] = useState<SchoolMealServicePayload | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [consumptionForm, setConsumptionForm] = useState<Record<string, ConsumptionFormRow>>({});
  const [mealCounts, setMealCounts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingPanels, setLoadingPanels] = useState(false);
  const [savingConsumption, setSavingConsumption] = useState(false);
  const [savingMealService, setSavingMealService] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadBase = async () => {
    setLoadingBase(true);
    setError('');
    try {
      const response = (await getSchools({ is_active: true })) as School[];
      setSchools(response);
      if (!selectedSchoolId && response.length) {
        setSelectedSchoolId(response[0].id);
      }
    } catch (loadError) {
      setError(parseError(loadError, 'Nao foi possivel carregar as escolas.'));
    } finally {
      setLoadingBase(false);
    }
  };

  const loadPanels = async (schoolId: string, dateValue: string) => {
    if (!schoolId) return;

    setLoadingPanels(true);
    setError('');
    try {
      const [consumptionResponse, mealResponse, movementResponse] = await Promise.all([
        getSchoolConsumption(schoolId),
        getSchoolMealService(schoolId, dateValue),
        getStockMovements({
          school: schoolId,
          type: 'OUT',
          date_from: dateValue,
          date_to: dateValue,
        }),
      ]);

      const nextConsumption = consumptionResponse as SchoolConsumptionPayload;
      const nextMeal = mealResponse as SchoolMealServicePayload;
      const nextMovements = Array.isArray(movementResponse) ? movementResponse : [];

      setConsumptionData(nextConsumption);
      setMealData(nextMeal);
      setMovements(nextMovements);
      setConsumptionForm((current) =>
        nextConsumption.items.reduce<Record<string, ConsumptionFormRow>>((acc, item) => {
          acc[item.supply.id] = current[item.supply.id] || { quantity: '', note: '' };
          return acc;
        }, {}),
      );
      setMealCounts(
        nextMeal.categories.reduce<Record<string, string>>((acc, category) => {
          const existing = nextMeal.existing_entries?.[category.meal_type];
          acc[category.meal_type] = existing !== undefined ? String(existing) : '';
          return acc;
        }, {}),
      );
    } catch (loadError) {
      setError(parseError(loadError, 'Nao foi possivel carregar o registro diario.'));
    } finally {
      setLoadingPanels(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (selectedSchoolId) {
      void loadPanels(selectedSchoolId, referenceDate);
    }
  }, [selectedSchoolId, referenceDate]);

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId) || null,
    [schools, selectedSchoolId],
  );

  const supplyById = useMemo(
    () =>
      (consumptionData?.items || []).reduce<Record<string, SchoolConsumptionPayload['items'][number]['supply']>>(
        (acc, item) => {
          acc[item.supply.id] = item.supply;
          return acc;
        },
        {},
      ),
    [consumptionData?.items],
  );

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return consumptionData?.items || [];
    return (consumptionData?.items || []).filter((item) => {
      const haystack = `${item.supply.name} ${item.supply.category}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [consumptionData?.items, search]);

  const pendingItems = useMemo(
    () =>
      (consumptionData?.items || []).filter((item) => Number(consumptionForm[item.supply.id]?.quantity || 0) > 0),
    [consumptionData?.items, consumptionForm],
  );

  const totalPlannedConsumption = useMemo(
    () => pendingItems.reduce((sum, item) => sum + Number(consumptionForm[item.supply.id]?.quantity || 0), 0),
    [consumptionForm, pendingItems],
  );

  const totalServed = useMemo(
    () =>
      (mealData?.categories || []).reduce(
        (sum, category) => sum + Number(mealCounts[category.meal_type] || 0),
        0,
      ),
    [mealCounts, mealData?.categories],
  );

  const movementTotal = useMemo(
    () => movements.reduce((sum, row) => sum + Number(row?.quantity || 0), 0),
    [movements],
  );

  const updateConsumptionRow = (supplyId: string, field: keyof ConsumptionFormRow, value: string) => {
    setConsumptionForm((current) => ({
      ...current,
      [supplyId]: {
        ...(current[supplyId] || { quantity: '', note: '' }),
        [field]: value,
      },
    }));
  };

  const handleSaveMealService = async () => {
    if (!selectedSchoolId || !mealData) return;

    setSavingMealService(true);
    setError('');
    setSuccessMessage('');
    try {
      await submitSchoolMealService(selectedSchoolId, {
        service_date: referenceDate,
        items: mealData.categories.map((category) => ({
          meal_type: category.meal_type,
          served_count: Number(mealCounts[category.meal_type] || 0),
        })),
      });
      setSuccessMessage('Refeicoes servidas atualizadas com sucesso.');
      await loadPanels(selectedSchoolId, referenceDate);
    } catch (saveError) {
      setError(parseError(saveError, 'Nao foi possivel salvar as refeicoes servidas.'));
    } finally {
      setSavingMealService(false);
    }
  };

  const handleSaveConsumption = async () => {
    if (!selectedSchoolId) return;

    const items = pendingItems.map((item) => ({
      supply: item.supply.id,
      quantity: Number(consumptionForm[item.supply.id]?.quantity || 0),
      movement_date: referenceDate,
      note: consumptionForm[item.supply.id]?.note || '',
    }));

    if (!items.length) {
      setError('Informe ao menos um item com quantidade maior que zero.');
      return;
    }

    setSavingConsumption(true);
    setError('');
    setSuccessMessage('');
    try {
      await submitSchoolConsumption(selectedSchoolId, { items });
      setSuccessMessage('Consumo da escola registrado com sucesso.');
      setConsumptionForm((current) =>
        Object.keys(current).reduce<Record<string, ConsumptionFormRow>>((acc, key) => {
          acc[key] = { quantity: '', note: '' };
          return acc;
        }, {}),
      );
      await loadPanels(selectedSchoolId, referenceDate);
    } catch (saveError) {
      setError(parseError(saveError, 'Nao foi possivel registrar o consumo.'));
    } finally {
      setSavingConsumption(false);
    }
  };

  if (loadingBase) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <div className="w-12 h-12 mx-auto border-4 border-slate-200 dark:border-slate-700 border-t-primary-500 rounded-full animate-spin mb-4"></div>
          <p>Carregando operacao escolar...</p>
        </div>
      </div>
    );
  }

  if (!schools.length) {
    return (
      <div className="p-6 lg:p-8">
        <div className="card p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">school</span>
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Nenhuma escola disponivel</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Cadastre ou habilite uma escola antes de registrar consumo e refeicoes servidas.
          </p>
          <div className="mt-6 flex justify-center">
            <button onClick={() => navigate('/admin/schools')} className="btn-primary">
              <span className="material-symbols-outlined">open_in_new</span>
              Ir para escolas
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 pb-24 lg:pb-8">
      <div className="px-4 lg:px-6 py-6">
        <div className="card p-5 lg:p-6 bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-600 text-white overflow-hidden relative">
          <div className="absolute inset-y-0 right-0 w-56 bg-white/10 blur-3xl pointer-events-none"></div>
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.24em] text-white/70">Operacao escolar</p>
              <h1 className="text-2xl lg:text-3xl font-bold mt-2">Consumo e refeicoes servidas</h1>
              <p className="text-sm text-white/80 mt-2">
                Registro interno por escola, com fechamento do dia e exportacao pronta para acompanhamento.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 xl:min-w-[48rem]">
              <select
                value={selectedSchoolId}
                onChange={(event) => setSelectedSchoolId(event.target.value)}
                className="input bg-white/95 text-slate-900 border-white/40"
              >
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={referenceDate}
                onChange={(event) => setReferenceDate(event.target.value)}
                className="input bg-white/95 text-slate-900 border-white/40"
              />
              <button
                onClick={() =>
                  exportConsumptionPdf({
                    school: selectedSchoolId,
                    date_from: referenceDate,
                    date_to: referenceDate,
                  })
                }
                className="btn-secondary border-white/40 bg-white/15 text-white hover:bg-white/20"
              >
                <span className="material-symbols-outlined">picture_as_pdf</span>
                PDF consumo
              </button>
              <button
                onClick={() =>
                  exportConsumptionXlsx({
                    school: selectedSchoolId,
                    date_from: referenceDate,
                    date_to: referenceDate,
                  })
                }
                className="btn-secondary border-white/40 bg-white/15 text-white hover:bg-white/20"
              >
                <span className="material-symbols-outlined">table_view</span>
                XLSX consumo
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="px-4 lg:px-6">
          <div className="rounded-xl bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-900/40 px-4 py-3 text-sm text-danger-700 dark:text-danger-300">
            {error}
          </div>
        </div>
      ) : null}

      {successMessage ? (
        <div className="px-4 lg:px-6 mt-4">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {successMessage}
          </div>
        </div>
      ) : null}

      <div className="px-4 lg:px-6 py-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Escola selecionada</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white mt-2">{selectedSchool?.name || '-'}</p>
          <p className="text-sm text-slate-500 mt-1">{consumptionData?.school?.municipality_name || '-'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Itens disponiveis</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
            {loadingPanels ? '...' : formatInteger(consumptionData?.summary.available_items)}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {formatInteger(consumptionData?.summary.low_stock)} item(ns) com estoque baixo
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Refeicoes do dia</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
            {loadingPanels ? '...' : formatInteger(totalServed)}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {mealData?.weekday || 'Sem cardapio carregado'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Saidas registradas</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
            {loadingPanels ? '...' : formatInteger(movements.length)}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Quantidade total: {formatNumber(movementTotal)}
          </p>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
        <section className="card p-5 lg:p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Fechamento de servico</p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-2">Refeicoes servidas</h2>
              <p className="text-sm text-slate-500 mt-2">
                Lance o total servido por categoria exibida no cardapio publicado da escola.
              </p>
            </div>
            {mealData?.menu ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-right">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Semana do menu</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatDate(mealData.menu.week_start)} a {formatDate(mealData.menu.week_end)}
                </p>
              </div>
            ) : null}
          </div>

          {!mealData?.categories.length ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500 text-center">
              Nenhuma categoria de refeicao encontrada para a data informada.
            </div>
          ) : (
            <div className="space-y-3">
              {mealData.categories.map((category) => (
                <div key={category.meal_type} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 dark:text-white">{category.meal_label}</p>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {formatInteger(category.items.length)} item(ns)
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {category.items.map((item, index) => (
                          <span
                            key={`${category.meal_type}-${index}`}
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="w-full lg:w-32">
                      <label className="text-xs uppercase tracking-wider text-slate-500">Qtd servida</label>
                      <input
                        type="number"
                        min={0}
                        value={mealCounts[category.meal_type] || ''}
                        onChange={(event) =>
                          setMealCounts((current) => ({
                            ...current,
                            [category.meal_type]: event.target.value,
                          }))
                        }
                        className="input mt-2 text-center text-lg font-semibold"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Total do dia</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatInteger(totalServed)}</p>
            </div>
            <button
              onClick={handleSaveMealService}
              disabled={savingMealService || !mealData?.categories.length}
              className="btn-primary"
            >
              <span className="material-symbols-outlined">restaurant</span>
              {savingMealService ? 'Salvando...' : 'Salvar refeicoes'}
            </button>
          </div>
        </section>

        <section className="card p-5 lg:p-6 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Baixa de estoque</p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-2">Consumo de insumos</h2>
              <p className="text-sm text-slate-500 mt-2">
                Registre apenas os itens efetivamente utilizados no preparo do dia.
              </p>
            </div>
            <div className="w-full lg:w-72">
              <label className="text-xs uppercase tracking-wider text-slate-500">Filtrar insumos</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input mt-2"
                placeholder="Buscar por nome ou categoria"
              />
            </div>
          </div>

          {!filteredItems.length ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500 text-center">
              Nenhum insumo com saldo disponivel para a escola selecionada.
            </div>
          ) : (
            <div className="space-y-3 max-h-[36rem] overflow-y-auto pr-1">
              {filteredItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 dark:text-white">{item.supply.name}</p>
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                          {item.supply.category}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            toneByStatus[item.status] || toneByStatus.NORMAL
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-2">
                        Saldo disponivel: <span className="font-semibold">{formatNumber(item.quantity)} {item.supply.unit}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Limite minimo: {formatNumber(item.min_stock)} {item.supply.unit}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[10rem,1fr] xl:w-[28rem]">
                      <div>
                        <label className="text-xs uppercase tracking-wider text-slate-500">Quantidade</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={consumptionForm[item.supply.id]?.quantity || ''}
                          onChange={(event) => updateConsumptionRow(item.supply.id, 'quantity', event.target.value)}
                          className="input mt-2 text-center font-semibold"
                          placeholder="0,00"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider text-slate-500">Observacao</label>
                        <input
                          value={consumptionForm[item.supply.id]?.note || ''}
                          onChange={(event) => updateConsumptionRow(item.supply.id, 'note', event.target.value)}
                          className="input mt-2"
                          placeholder="Ex.: preparo do almoco"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Itens no envio</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatInteger(pendingItems.length)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Quantidade total</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(totalPlannedConsumption)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Data do lancamento</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{formatDate(referenceDate)}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSaveConsumption}
                disabled={savingConsumption || !pendingItems.length}
                className="btn-primary"
              >
                <span className="material-symbols-outlined">inventory_2</span>
                {savingConsumption ? 'Salvando...' : 'Registrar consumo'}
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="px-4 lg:px-6 pb-6">
        <section className="card p-5 lg:p-6 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Historico do dia</p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-2">Baixas registradas em {formatDate(referenceDate)}</h2>
              <p className="text-sm text-slate-500 mt-2">
                Lancamentos internos de consumo para a escola selecionada.
              </p>
            </div>
            <button onClick={() => navigate('/admin/reports')} className="btn-secondary">
              <span className="material-symbols-outlined">open_in_new</span>
              Ir para relatorios
            </button>
          </div>

          {!movements.length ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500 text-center">
              Nenhum consumo registrado nesta data.
            </div>
          ) : (
            <div className="space-y-3">
              {movements.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {supplyById[row.supply]?.name || 'Insumo'}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {selectedSchool?.name || consumptionData?.school.name || '-'} • {formatDate(row.movement_date)}
                      </p>
                      {row.note ? <p className="text-xs text-slate-400 mt-1">{row.note}</p> : null}
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wider text-slate-500">Quantidade</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(row.quantity)} {supplyById[row.supply]?.unit || ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ConsumptionRegistry;
