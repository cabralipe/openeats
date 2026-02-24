import React, { useEffect, useMemo, useState } from 'react';

import { calculateMenuProduction, getMenus, getSchools } from '../api';

const mealTypes = ['BREAKFAST1', 'SNACK1', 'LUNCH', 'BREAKFAST2', 'SNACK2', 'DINNER_COFFEE'] as const;

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

  useEffect(() => {
    getSchools()
      .then((data) => {
        setSchools(data as any[]);
        if ((data as any[])?.length) setSchoolId((data as any[])[0].id);
      })
      .catch(() => setError('Não foi possível carregar escolas.'));
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
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:p-6">
        <h1 className="text-xl font-bold">Calculadora de Produção</h1>
        <p className="text-sm text-slate-500 mt-1">Calcula ingredientes por aluno com receita estruturada + fallback por regra/alias.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Escola</span>
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm">
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Semana (week_start)</span>
            <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" />
          </label>
          <label className="block lg:col-span-2">
            <span className="text-xs font-semibold text-slate-500">Cardápio</span>
            <select value={selectedMenuId} onChange={(e) => setSelectedMenuId(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm">
              <option value="">Selecione</option>
              {menus.map((m) => <option key={m.id} value={m.id}>{m.name || m.school_name} • {m.week_start} • {m.status}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Alunos DEFAULT</span>
            <input value={studentsDefault} onChange={(e) => setStudentsDefault(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">% Perda</span>
            <input value={wastePercent} onChange={(e) => setWastePercent(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" />
          </label>
          <label className="flex items-center gap-3 mt-6">
            <input type="checkbox" checked={includeStock} onChange={(e) => setIncludeStock(e.target.checked)} />
            <span className="text-sm">Incluir saldo de estoque</span>
          </label>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3">
          {mealTypes.map((meal) => (
            <label key={meal} className="block">
              <span className="text-xs font-semibold text-slate-500">{meal}</span>
              <input
                value={studentsByMeal[meal] || ''}
                onChange={(e) => setStudentsByMeal((prev) => ({ ...prev, [meal]: e.target.value }))}
                placeholder="usa DEFAULT"
                className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
              />
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={handleCalculate} disabled={loading} className="px-4 py-2 rounded-xl bg-primary text-white font-semibold disabled:opacity-50">
            {loading ? 'Calculando...' : 'Calcular'}
          </button>
          <button disabled className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400">
            Exportar PDF (TODO)
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {result && (
        <>
          {result.warnings?.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/30 p-4">
              <h2 className="font-semibold text-amber-700 dark:text-amber-300">Warnings</h2>
              <ul className="mt-2 text-sm text-amber-700 dark:text-amber-200 list-disc pl-5">
                {result.warnings.map((w: string) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="font-semibold">Totais da Semana</h2>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b border-slate-200 dark:border-slate-700"><th className="py-2">Insumo</th><th>Qtd</th><th>Unid</th><th>Saldo</th><th>Falta</th></tr></thead>
                <tbody>
                  {(result.totals_week || []).map((row: any) => (
                    <tr key={`${row.supply_id}-${row.unit}`} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{row.supply_name}</td>
                      <td>{row.qty_needed ?? '-'}</td>
                      <td>{row.unit}</td>
                      <td>{row.stock_available ?? '-'}</td>
                      <td className={row.stock_shortage > 0 ? 'text-red-600 font-semibold' : ''}>{row.stock_shortage ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(result.days || []).map((day: any) => (
            <div key={day.day_of_week} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <h3 className="font-semibold">{day.day_of_week}</h3>
              <div className="space-y-4 mt-3">
                {(day.meals || []).map((meal: any, idx: number) => (
                  <div key={`${meal.meal_type}-${idx}`} className="border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{meal.meal_type} {meal.meal_name ? `• ${meal.meal_name}` : ''}</p>
                        <p className="text-xs text-slate-500">Modo: {meal.mode}{meal.recipe_id ? ` • Receita ${String(meal.recipe_id).slice(0, 8)}` : ''}</p>
                      </div>
                      <span className="text-xs text-slate-500">{meal.scale_factor != null ? `Escala ${meal.scale_factor}` : ''}</span>
                    </div>
                    <div className="overflow-x-auto mt-2">
                      <table className="w-full text-xs">
                        <thead><tr className="text-left border-b border-slate-200 dark:border-slate-700"><th className="py-1">Insumo</th><th>Fonte</th><th>Qtd</th><th>Saldo</th><th>Falta</th></tr></thead>
                        <tbody>
                          {(meal.ingredients || []).map((ing: any) => (
                            <tr key={`${ing.supply_id}-${ing.unit}`} className="border-b border-slate-100 dark:border-slate-800">
                              <td className="py-1">{ing.supply_name}</td>
                              <td>{ing.source}</td>
                              <td>{ing.qty_needed ?? '-'} {ing.unit}</td>
                              <td>{ing.stock_available ?? '-'}</td>
                              <td className={ing.stock_shortage > 0 ? 'text-red-600 font-semibold' : ''}>{ing.stock_shortage ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default MenuProductionCalculator;

