import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { calculatePublicMenuProduction, getPublicCalculatorMeta } from '../api';

const mealTypes = ['BREAKFAST1', 'SNACK1', 'LUNCH', 'BREAKFAST2', 'SNACK2', 'DINNER_COFFEE'] as const;

const PublicCalculator: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<any | null>(null);
  const [weekStart, setWeekStart] = useState('');
  const [studentsDefault, setStudentsDefault] = useState('300');
  const [studentsByMeal, setStudentsByMeal] = useState<Record<string, string>>({});
  const [wastePercent, setWastePercent] = useState('5');
  const [includeStock, setIncludeStock] = useState(true);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    getPublicCalculatorMeta(token)
      .then((data: any) => {
        setMeta(data);
        setWeekStart(data?.current_published_menu?.week_start || '');
      })
      .catch((err: any) => setError(err?.message || 'Não foi possível carregar os dados da calculadora.'));
  }, [token]);

  const studentsPayload = useMemo(() => {
    const payload: Record<string, number> = { DEFAULT: Number(studentsDefault || 0) };
    mealTypes.forEach((meal) => {
      const value = studentsByMeal[meal];
      if (value !== undefined && value !== '') payload[meal] = Number(value);
    });
    return payload;
  }, [studentsDefault, studentsByMeal]);

  const handleCalculate = async () => {
    if (!token || !weekStart) return;
    setLoading(true);
    setError('');
    try {
      const data = await calculatePublicMenuProduction(token, {
        week_start: weekStart,
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
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 lg:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:p-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Calculadora de Ingredientes</h1>
          <p className="text-sm text-slate-500 mt-1">
            {meta?.school?.name ? `Escola: ${meta.school.name}` : 'Carregando escola...'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Semana</span>
              <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Alunos (DEFAULT)</span>
              <input value={studentsDefault} onChange={(e) => setStudentsDefault(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">% Perda</span>
              <input value={wastePercent} onChange={(e) => setWastePercent(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {mealTypes.map((meal) => (
              <label key={meal} className="block">
                <span className="text-xs font-semibold text-slate-500">{meal}</span>
                <input
                  value={studentsByMeal[meal] || ''}
                  onChange={(e) => setStudentsByMeal((prev) => ({ ...prev, [meal]: e.target.value }))}
                  placeholder="Opcional"
                  className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
                />
              </label>
            ))}
          </div>

          <label className="mt-4 inline-flex items-center gap-3">
            <input type="checkbox" checked={includeStock} onChange={(e) => setIncludeStock(e.target.checked)} />
            <span className="text-sm">Incluir estoque da escola</span>
          </label>

          <div className="mt-4">
            <button onClick={handleCalculate} disabled={loading || !token || !weekStart} className="px-4 py-2 rounded-xl bg-primary text-white font-semibold disabled:opacity-50">
              {loading ? 'Calculando...' : 'Calcular'}
            </button>
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        {result && (
          <>
            {result.warnings?.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/30 p-4">
                <h2 className="font-semibold text-amber-700 dark:text-amber-300">Avisos</h2>
                <ul className="mt-2 text-sm list-disc pl-5">
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
          </>
        )}
      </div>
    </div>
  );
};

export default PublicCalculator;

