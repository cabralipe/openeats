import React, { useEffect, useMemo, useState } from 'react';

import { calculateMenuProduction, getMenus, getSchools, getRecipes } from '../api';

const mealTypes = ['BREAKFAST1', 'SNACK1', 'LUNCH', 'BREAKFAST2', 'SNACK2', 'DINNER_COFFEE'] as const;
const weekdayOrder = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

const weekdayLabels: Record<string, string> = {
  MON: 'Segunda',
  TUE: 'Terça',
  WED: 'Quarta',
  THU: 'Quinta',
  FRI: 'Sexta',
  SAT: 'Sábado',
  SUN: 'Domingo',
};

const mealTypeLabels: Record<string, string> = {
  BREAKFAST1: 'Café 1',
  SNACK1: 'Lanche 1',
  LUNCH: 'Almoço',
  BREAKFAST2: 'Café 2',
  SNACK2: 'Lanche 2',
  DINNER_COFFEE: 'Jantar/Café',
};

const mealTypeIcons: Record<string, string> = {
  BREAKFAST1: 'breakfast_dining',
  SNACK1: 'cookie',
  LUNCH: 'lunch_dining',
  BREAKFAST2: 'breakfast_dining',
  SNACK2: 'bakery_dining',
  DINNER_COFFEE: 'coffee',
};

function parseDateSafe(value?: string) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(base: Date, days: number) {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDatePt(date?: Date | null) {
  if (!date) return '';
  return date.toLocaleDateString('pt-BR');
}

function formatDayOfMonth(date?: Date | null) {
  if (!date) return '';
  return String(date.getDate());
}

function weekdayIndex(dayKey?: string) {
  const idx = weekdayOrder.indexOf((dayKey || '') as any);
  return idx >= 0 ? idx : 999;
}

function offsetFromMenuWeekStart(dayKey?: string) {
  const offsets: Record<string, number> = {
    MON: 0,
    TUE: 1,
    WED: 2,
    THU: 3,
    FRI: 4,
    SAT: 5,
    SUN: 6,
  };
  return offsets[dayKey || ''];
}

function formatQty(value: any, unit?: string) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
}

function getMealRecipeId(meal: any) {
  return meal?.recipe_id || meal?.recipe || null;
}

function getRecipePrepMeta(recipe: any) {
  const tags = recipe?.tags || {};
  const prepTime = Number((tags as any)?.prep_time_minutes);
  const prepTimeMinutes = Number.isFinite(prepTime) && prepTime >= 0 ? prepTime : null;
  const prepSteps = Array.isArray((tags as any)?.prep_steps)
    ? (tags as any).prep_steps.map((step: any) => String(step || '').trim()).filter(Boolean)
    : [];
  return { prepTimeMinutes, prepSteps };
}

const MenuProductionCalculator: React.FC = () => {
  const [schools, setSchools] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [studentsDefault, setStudentsDefault] = useState('300');
  const [studentsByMeal, setStudentsByMeal] = useState<Record<string, string>>({});
  const [wastePercent, setWastePercent] = useState('5');
  const [includeStock, setIncludeStock] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [recipesCatalog, setRecipesCatalog] = useState<any[]>([]);

  useEffect(() => {
    getSchools()
      .then((data) => {
        setSchools(data as any[]);
        if ((data as any[])?.length) setSchoolId((data as any[])[0].id);
      })
      .catch(() => setError('Não foi possível carregar escolas.'));
  }, []);

  useEffect(() => {
    getRecipes({ active: true })
      .then((data) => setRecipesCatalog(Array.isArray(data) ? data : []))
      .catch(() => {
        // optional for results enrichment only
      });
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    const params: any = { school: schoolId };
    if (weekStart) params.week_start = weekStart;
    getMenus(params)
      .then((data) => {
        const menuList = Array.isArray(data) ? data : [];
        setMenus(menuList);
        if (weekStart) {
          const exact = menuList.find((m) => m.week_start === weekStart);
          setSelectedMenuId(exact?.id || '');
        } else {
          setSelectedMenuId(menuList[0]?.id || '');
        }
      })
      .catch(() => setError('Não foi possível carregar cardápios.'));
  }, [schoolId, weekStart]);

  const studentsPayload = useMemo(() => {
    const payload: Record<string, number> = {};
    if (studentsDefault !== '') payload.DEFAULT = Number(studentsDefault || 0);
    mealTypes.forEach((meal) => {
      const value = studentsByMeal[meal];
      if (value !== undefined && value !== '') payload[meal] = Number(value);
    });
    return payload;
  }, [studentsDefault, studentsByMeal]);

  const mealsWithoutRecipe = useMemo(() => {
    if (!result?.days) return [];
    const items: Array<{ key: string; day: string; mealType: string; mealName: string; mode?: string }> = [];
    (result.days || []).forEach((day: any) => {
      (day.meals || []).forEach((meal: any, index: number) => {
        if (getMealRecipeId(meal)) return;
        items.push({
          key: `${day.day_of_week}-${meal.meal_type}-${index}`,
          day: day.day_of_week,
          mealType: meal.meal_type || '-',
          mealName: meal.meal_name || '',
          mode: meal.mode,
        });
      });
    });
    return items;
  }, [result]);

  const daysWithMeta = useMemo(() => {
    if (!result?.days) return [];
    const weekStartDate = parseDateSafe(result?.week_start);
    return [...(result.days || [])]
      .sort((a: any, b: any) => weekdayIndex(a.day_of_week) - weekdayIndex(b.day_of_week))
      .map((day: any) => {
        const offset = offsetFromMenuWeekStart(day.day_of_week);
        const date = weekStartDate && offset !== undefined ? addDays(weekStartDate, offset) : null;
        return {
          ...day,
          label: weekdayLabels[day.day_of_week] || day.day_of_week,
          date,
          dayNumber: formatDayOfMonth(date),
        };
      });
  }, [result]);

  useEffect(() => {
    if (!daysWithMeta.length) {
      setSelectedDayKey('');
      return;
    }
    setSelectedDayKey((prev) => (
      prev && daysWithMeta.some((d: any) => d.day_of_week === prev)
        ? prev
        : daysWithMeta[0].day_of_week
    ));
  }, [daysWithMeta]);

  const selectedDay = useMemo(
    () => daysWithMeta.find((d: any) => d.day_of_week === selectedDayKey) || daysWithMeta[0] || null,
    [daysWithMeta, selectedDayKey],
  );

  const selectedDayIngredientRows = useMemo(() => {
    if (!selectedDay) return [];
    const rows: any[] = [];
    (selectedDay.meals || []).forEach((meal: any, mealIndex: number) => {
      (meal.ingredients || []).forEach((ing: any, ingIndex: number) => {
        rows.push({
          id: `${meal.meal_type}-${mealIndex}-${ing.supply_id}-${ing.unit}-${ingIndex}`,
          mealType: meal.meal_type,
          mealName: meal.meal_name || '',
          mealMode: meal.mode,
          recipeId: getMealRecipeId(meal),
          scaleFactor: meal.scale_factor,
          ...ing,
        });
      });
    });
    return rows.sort((a, b) => {
      const shortageA = Number(a.stock_shortage || 0);
      const shortageB = Number(b.stock_shortage || 0);
      if (shortageA !== shortageB) return shortageB - shortageA;
      return String(a.supply_name || '').localeCompare(String(b.supply_name || ''), 'pt-BR');
    });
  }, [selectedDay]);

  const weeklyMetrics = useMemo(() => {
    const totals = result?.totals_week || [];
    const criticalCount = totals.filter((row: any) => Number(row.stock_shortage || 0) > 0).length;
    const totalItems = totals.length || 0;
    const attendedItems = totals.filter((row: any) => Number(row.stock_shortage || 0) <= 0).length;
    const attendedPct = totalItems ? Math.round((attendedItems / totalItems) * 100) : 0;
    const totalShortageRows = totals.filter((row: any) => Number(row.stock_shortage || 0) > 0);
    return {
      criticalCount,
      attendedPct,
      shortageHighlights: totalShortageRows.slice(0, 3).map((row: any) => row.supply_name).filter(Boolean),
    };
  }, [result]);

  const focusRecipeMeal = useMemo(() => {
    if (!selectedDay?.meals) return null;
    const recipeMeals = (selectedDay.meals || []).filter((m: any) => !!getMealRecipeId(m));
    if (!recipeMeals.length) return null;
    return [...recipeMeals].sort((a: any, b: any) => (Number(b.scale_factor || 0) - Number(a.scale_factor || 0)))[0];
  }, [selectedDay]);

  const recipeById = useMemo(() => {
    const map = new Map<string, any>();
    recipesCatalog.forEach((recipe: any) => {
      if (recipe?.id) map.set(String(recipe.id), recipe);
    });
    return map;
  }, [recipesCatalog]);

  const focusRecipeDetails = useMemo(() => {
    const recipeId = getMealRecipeId(focusRecipeMeal);
    if (!recipeId) return null;
    return recipeById.get(String(recipeId)) || null;
  }, [focusRecipeMeal, recipeById]);

  const handleCalculate = async () => {
    if (!selectedMenuId) {
      setError('Selecione um cardápio.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await calculateMenuProduction(selectedMenuId, {
        students_by_meal_type: studentsPayload,
        waste_percent: Number(wastePercent || 0),
        include_stock: includeStock,
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível calcular.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="space-y-6">
        <div className="max-w-6xl">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Calculadora de Produção</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Siga os passos abaixo para configurar o cálculo de insumos com base no cardápio e receitas associadas.
          </p>
        </div>

        <div className="max-w-6xl grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 text-primary rounded-lg flex items-center justify-center font-bold">1</div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase text-xs tracking-widest">Parâmetros Gerais</h4>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Escola Selecionada</label>
                  <select
                    value={schoolId}
                    onChange={(e) => setSchoolId(e.target.value)}
                    className="block w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 py-3 px-4"
                  >
                    {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Semana de Referência (week_start)</label>
                  <input
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="block w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 py-3 px-4"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cardápio</label>
                  <select
                    value={selectedMenuId}
                    onChange={(e) => setSelectedMenuId(e.target.value)}
                    className="block w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 py-3 px-4"
                  >
                    <option value="">Selecione</option>
                    {menus.map((m) => <option key={m.id} value={m.id}>{m.name || m.school_name} • {m.week_start} • {m.status}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Alunos DEFAULT (Total)</label>
                  <div className="relative">
                    <input
                      value={studentsDefault}
                      onChange={(e) => setStudentsDefault(e.target.value)}
                      className="block w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 py-3 pl-12 pr-4"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-3 text-slate-400">groups</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">% Perda Estimada</label>
                    <span className="text-sm font-bold text-primary">{wastePercent || '0'}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="1"
                    value={Number(wastePercent || 0)}
                    onChange={(e) => setWastePercent(e.target.value)}
                    className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                    <span>0%</span>
                    <span>25%</span>
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={includeStock} onChange={(e) => setIncludeStock(e.target.checked)} className="w-5 h-5 rounded" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Incluir saldo de estoque no cálculo</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 text-primary rounded-lg flex items-center justify-center font-bold">2</div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase text-xs tracking-widest">Distribuição por Refeição</h4>
                </div>
                <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium">
                  {selectedMenuId ? 'Cardápio selecionado' : 'Selecione um cardápio'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mealTypes.map((meal) => {
                  const customValue = studentsByMeal[meal] || '';
                  const usingDefault = customValue === '';
                  return (
                    <div
                      key={meal}
                      className={`p-4 rounded-xl border-2 ${usingDefault
                        ? 'border-primary/20 bg-primary/5 dark:bg-primary/10'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">
                              {mealTypeIcons[meal] || 'restaurant'}
                            </span>
                          </div>
                          <div>
                            <h5 className="font-bold text-sm">{meal}</h5>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">{mealTypeLabels[meal] || meal}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${usingDefault
                          ? 'bg-primary/10 text-primary'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200'
                          }`}>
                          {usingDefault ? 'usa DEFAULT' : 'custom'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Qtd. Alunos</label>
                        <input
                          value={customValue}
                          onChange={(e) => setStudentsByMeal((prev) => ({ ...prev, [meal]: e.target.value }))}
                          placeholder="usa DEFAULT"
                          className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/50 rounded-lg h-10 px-3"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-6">
                <button disabled className="px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl opacity-70">
                  <span className="material-symbols-outlined mr-2 align-middle text-xl">picture_as_pdf</span>
                  Exportar PDF
                </button>
                <button onClick={handleCalculate} disabled={loading} className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-blue-600 disabled:opacity-50">
                  <span className="material-symbols-outlined mr-2 align-middle text-xl">{loading ? 'hourglass_top' : 'play_circle'}</span>
                  {loading ? 'Calculando...' : 'Calcular Produção'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {result && (
        <div className="space-y-6">
          {weeklyMetrics.criticalCount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-4 rounded-xl flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-500">warning</span>
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-bold">Atenção:</span>{' '}
                Existem {weeklyMetrics.criticalCount} insumos com estoque crítico para esta semana
                {weeklyMetrics.shortageHighlights.length ? ` (${weeklyMetrics.shortageHighlights.join(', ')}).` : '.'}
              </div>
            </div>
          )}

          {mealsWithoutRecipe.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/30 p-4">
              <h2 className="font-semibold text-red-700 dark:text-red-300">Associe uma receita para calcular a produção</h2>
              <p className="mt-1 text-sm text-red-700 dark:text-red-200">
                Os itens abaixo estão no cardápio sem receita associada. Sem receita, o cálculo não usa base de rendimento e ingredientes da receita.
              </p>
              <ul className="mt-3 text-sm text-red-700 dark:text-red-200 list-disc pl-5 space-y-1">
                {mealsWithoutRecipe.map((item) => (
                  <li key={item.key}>
                    {(weekdayLabels[item.day] || item.day)} • {mealTypeLabels[item.mealType] || item.mealType}
                    {item.mealName ? ` • ${item.mealName}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-lg font-bold">Planejamento Semanal</h2>
              <span className="text-sm text-slate-500">
                Semana de {formatDatePt(parseDateSafe(result.week_start))} a {formatDatePt(parseDateSafe(result.week_end))}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {daysWithMeta.map((day: any) => {
                const isActive = selectedDay?.day_of_week === day.day_of_week;
                const meals = day.meals || [];
                return (
                  <button
                    key={day.day_of_week}
                    onClick={() => setSelectedDayKey(day.day_of_week)}
                    className={`group flex flex-col p-4 rounded-2xl text-left transition-all border ${isActive
                      ? 'border-primary bg-white dark:bg-slate-900 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                  >
                    <span className={`text-xs font-bold uppercase tracking-widest mb-1 ${isActive ? 'text-primary' : 'text-slate-400'}`}>
                      {day.label}
                    </span>
                    <span className={`text-2xl font-bold mb-2 ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                      {day.dayNumber || '-'}
                    </span>
                    <div className={`flex -space-x-2 ${meals.length ? '' : 'opacity-50'}`}>
                      {meals.slice(0, 4).map((meal: any, idx: number) => (
                        <div key={`${meal.meal_type}-${idx}`} className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[10px] text-slate-600 dark:text-slate-300">
                            {mealTypeIcons[meal.meal_type] || 'restaurant'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/30">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">shopping_basket</span>
                    Insumos Necessários
                  </h3>
                  {selectedDay && (
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded uppercase">
                      {selectedDay.label}
                      {selectedDay.date ? ` • ${formatDatePt(selectedDay.date)}` : ''}
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/30 dark:bg-slate-800/30 text-xs font-bold text-slate-500 uppercase">
                      <tr>
                        <th className="px-6 py-4">Ingrediente</th>
                        <th className="px-6 py-4 text-center">Modo</th>
                        <th className="px-6 py-4 text-right">Qtd. Necessária</th>
                        <th className="px-6 py-4 text-right">Saldo Estoque</th>
                        <th className="px-6 py-4 text-right">A Comprar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedDayIngredientRows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                            Nenhum insumo calculado para este dia.
                          </td>
                        </tr>
                      )}
                      {selectedDayIngredientRows.map((row: any) => {
                        const shortage = Number(row.stock_shortage || 0);
                        const hasShortage = shortage > 0;
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{row.supply_name}</p>
                              <p className="text-xs text-slate-500">
                                {mealTypeLabels[row.mealType] || row.mealType}
                                {row.mealName ? ` • ${row.mealName}` : ''}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${row.source === 'RECIPE'
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : row.source === 'RULE'
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}>
                                {row.source}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-medium">{formatQty(row.qty_needed, row.unit)}</td>
                            <td className={`px-6 py-4 text-right ${hasShortage ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                              {formatQty(row.stock_available, row.unit)}
                            </td>
                            <td className={`px-6 py-4 text-right ${hasShortage ? 'font-bold text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                              {hasShortage ? formatQty(row.stock_shortage, row.unit) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-orange-500">menu_book</span>
                    Refeições do Dia
                  </h3>
                  {selectedDay && <span className="text-xs font-semibold text-slate-500">{selectedDay.label}</span>}
                </div>
                <div className="p-4 space-y-3">
                  {(selectedDay?.meals || []).length === 0 && (
                    <div className="text-sm text-slate-500 p-2">Sem refeições neste dia.</div>
                  )}
                  {(selectedDay?.meals || []).map((meal: any, idx: number) => (
                    <div key={`${meal.meal_type}-${idx}`} className="border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {mealTypeLabels[meal.meal_type] || meal.meal_type}
                            {meal.meal_name ? ` • ${meal.meal_name}` : ''}
                          </p>
                          <p className="text-xs text-slate-500">
                            Modo: {meal.mode}
                            {getMealRecipeId(meal) ? ` • Receita ${String(getMealRecipeId(meal)).slice(0, 8)}` : ' • Sem receita'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {meal.scale_factor != null && (
                            <span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              Escala {Number(meal.scale_factor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded ${getMealRecipeId(meal)
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300'
                            }`}>
                            {getMealRecipeId(meal) ? 'Com receita' : 'Sem receita'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-orange-500">menu_book</span>
                    Modo de Preparo
                  </h3>
                  {getMealRecipeId(focusRecipeMeal) && (
                    <span className="text-xs text-slate-500 font-medium">
                      Ref {String(getMealRecipeId(focusRecipeMeal)).slice(0, 8)}
                    </span>
                  )}
                </div>
                <div className="p-6">
                  {focusRecipeMeal ? (
                    (() => {
                      const recipe = focusRecipeDetails;
                      const prepMeta = getRecipePrepMeta(recipe);
                      const fallbackSteps = String(recipe?.instructions || '')
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean);
                      const steps = prepMeta.prepSteps.length ? prepMeta.prepSteps : fallbackSteps;
                      return (
                        <div className="space-y-5">
                          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Receita em Foco</p>
                            <p className="font-semibold">
                              {recipe?.name || focusRecipeMeal.meal_name || (mealTypeLabels[focusRecipeMeal.meal_type] || focusRecipeMeal.meal_type)}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              {mealTypeLabels[focusRecipeMeal.meal_type] || focusRecipeMeal.meal_type}
                              {focusRecipeMeal.scale_factor != null
                                ? ` • Escala ${Number(focusRecipeMeal.scale_factor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`
                                : ''}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            <div className="p-3 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center gap-3">
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                                <span className="material-symbols-outlined text-blue-500 text-xl">timer</span>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Tempo de Preparo</p>
                                <p className="text-sm font-semibold">
                                  {prepMeta.prepTimeMinutes != null ? `${prepMeta.prepTimeMinutes} minutos` : 'Não informado'}
                                </p>
                              </div>
                            </div>
                            <div className="p-3 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center gap-3">
                              <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                                <span className="material-symbols-outlined text-green-500 text-xl">groups</span>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Rendimento Base</p>
                                <p className="text-sm font-semibold">
                                  {recipe?.servings_base ? `${recipe.servings_base} porções` : 'Não informado'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {steps.length > 0 ? (
                              steps.map((step: string, index: number) => (
                                <div key={`prep-step-${index}`} className="flex gap-4">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0 border border-primary/20">
                                    {index + 1}
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">Etapa {index + 1}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step}</p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500">Receita sem etapas cadastradas.</p>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-sm text-slate-500">
                      Nenhuma refeição com receita associada no dia selecionado.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-primary text-white p-6 rounded-2xl shadow-lg shadow-primary/20">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">summarize</span>
                  Resumo da Semana
                </h3>
                <div className="space-y-4">
                  <div className="pb-4 border-b border-white/20">
                    <p className="text-xs text-white/70 uppercase font-bold tracking-wider mb-1">Itens Calculados</p>
                    <p className="text-3xl font-bold">
                      {(result.totals_week || []).length}
                      <span className="text-lg font-normal opacity-80"> insumos</span>
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span>Insumos Críticos</span>
                      <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {weeklyMetrics.criticalCount}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Estoque Atendido</span>
                      <span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {weeklyMetrics.attendedPct}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Itens sem receita</span>
                      <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {mealsWithoutRecipe.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {result.warnings?.length > 0 && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500">warning</span>
                    Warnings
                  </h3>
                  <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc pl-5 space-y-2 max-h-56 overflow-y-auto">
                    {result.warnings.map((w: string) => <li key={w}>{w}</li>)}
                  </ul>
                </div>
              )}

              {mealsWithoutRecipe.length > 0 && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-500">rule</span>
                    Itens sem Receita
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {mealsWithoutRecipe.map((item) => (
                      <div key={`side-${item.key}`} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <p className="text-sm font-semibold">
                          {mealTypeLabels[item.mealType] || item.mealType}
                          {item.mealName ? ` • ${item.mealName}` : ''}
                        </p>
                        <p className="text-xs text-slate-500">{weekdayLabels[item.day] || item.day}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="font-semibold">Totais da Semana</h2>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2">Insumo</th>
                    <th>Qtd</th>
                    <th>Unid</th>
                    <th>Saldo</th>
                    <th>Falta</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.totals_week || []).map((row: any) => (
                    <tr key={`${row.supply_id}-${row.unit}`} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{row.supply_name}</td>
                      <td>{row.qty_needed ?? '-'}</td>
                      <td>{row.unit}</td>
                      <td>{row.stock_available ?? '-'}</td>
                      <td className={Number(row.stock_shortage || 0) > 0 ? 'text-red-600 font-semibold' : ''}>{row.stock_shortage ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuProductionCalculator;
