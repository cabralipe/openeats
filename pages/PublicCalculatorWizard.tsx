import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { calculatePublicMenuProductionBySchool, getPublicMenuCurrent, getPublicSchools } from '../api';

type School = { id: string; name: string; slug: string; city?: string };

const mealLabels: Record<string, string> = {
  BREAKFAST1: 'Desjejum 1',
  SNACK1: 'Lanche 1',
  LUNCH: 'Almoço',
  BREAKFAST2: 'Desjejum 2',
  SNACK2: 'Lanche 2',
  DINNER_COFFEE: 'Café da noite',
  BREAKFAST: 'Café',
  SNACK: 'Lanche',
};

const dayCodeByWeekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const dayLabel: Record<string, string> = { MON: 'Segunda', TUE: 'Terça', WED: 'Quarta', THU: 'Quinta', FRI: 'Sexta' };

function dateToDayCode(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return dayCodeByWeekday[d.getDay()] || '';
}

function formatQty(value: any, unit?: string) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
}

function buildFilteredResult(result: any, selectedDay: string, selectedMeals: string[]) {
  const mealSet = new Set(selectedMeals);
  const filteredDays = (result?.days || [])
    .filter((d: any) => d.day_of_week === selectedDay)
    .map((d: any) => ({
      ...d,
      meals: (d.meals || []).filter((m: any) => mealSet.has(m.meal_type)),
    }))
    .filter((d: any) => d.meals.length > 0);

  const totalsMap = new Map<string, any>();
  filteredDays.forEach((day: any) => {
    (day.meals || []).forEach((meal: any) => {
      (meal.ingredients || []).forEach((ing: any) => {
        if (ing.qty_needed == null) return;
        const key = `${ing.supply_id}-${ing.unit}`;
        const prev = totalsMap.get(key) || {
          supply_id: ing.supply_id,
          supply_name: ing.supply_name,
          unit: ing.unit,
          qty_needed: 0,
          stock_available: ing.stock_available ?? null,
          stock_shortage: 0,
        };
        prev.qty_needed += Number(ing.qty_needed || 0);
        if (prev.stock_available != null && ing.stock_available != null) {
          prev.stock_available = Math.max(Number(prev.stock_available || 0), Number(ing.stock_available || 0));
        }
        totalsMap.set(key, prev);
      });
    });
  });

  const totals_week = Array.from(totalsMap.values())
    .map((row) => ({
      ...row,
      stock_shortage:
        row.stock_available == null ? null : Math.max(0, Number(row.qty_needed || 0) - Number(row.stock_available || 0)),
    }))
    .sort((a, b) => String(a.supply_name || '').localeCompare(String(b.supply_name || ''), 'pt-BR'));

  return { ...result, days: filteredDays, totals_week };
}

const PublicCalculatorWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [menuForDate, setMenuForDate] = useState<any | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [selectedMealTypes, setSelectedMealTypes] = useState<string[]>([]);
  const [studentsCount, setStudentsCount] = useState('300');
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');

  const loadSchools = async () => {
    if (schools.length) return;
    setSchoolsLoading(true);
    setError('');
    try {
      const data = await getPublicSchools();
      setSchools(Array.isArray(data) ? data : []);
    } catch {
      setError('Não foi possível carregar as escolas.');
    } finally {
      setSchoolsLoading(false);
    }
  };

  React.useEffect(() => {
    loadSchools();
  }, []);

  const availableMeals = useMemo(() => {
    if (!menuForDate?.items || !selectedDate) return [];
    const targetDay = dateToDayCode(selectedDate);
    const map = new Map<string, { meal_type: string; label: string; count: number }>();
    (menuForDate.items || [])
      .filter((item: any) => item.day_of_week === targetDay)
      .forEach((item: any) => {
        const key = item.meal_type;
        const entry = map.get(key) || { meal_type: key, label: mealLabels[key] || key, count: 0 };
        entry.count += 1;
        map.set(key, entry);
      });
    return Array.from(map.values());
  }, [menuForDate, selectedDate]);

  const selectedDayCode = useMemo(() => dateToDayCode(selectedDate), [selectedDate]);

  const filteredResult = useMemo(
    () => (result && selectedDayCode && selectedMealTypes.length ? buildFilteredResult(result, selectedDayCode, selectedMealTypes) : result),
    [result, selectedDayCode, selectedMealTypes],
  );

  const selectedDayResult = useMemo(() => filteredResult?.days?.[0] || null, [filteredResult]);

  const handleSchoolNext = () => {
    if (!selectedSchool) {
      setError('Selecione uma unidade escolar.');
      return;
    }
    setError('');
    setStep(2);
  };

  const loadMenuForDate = async (nextDate: string) => {
    if (!selectedSchool || !nextDate) return;
    setMenuLoading(true);
    setError('');
    setMenuForDate(null);
    setSelectedMealTypes([]);
    try {
      const data = await getPublicMenuCurrent(selectedSchool.slug, undefined, nextDate);
      setMenuForDate(data);
    } catch (err: any) {
      setError(err?.message || 'Nenhum cardápio publicado para esta data.');
    } finally {
      setMenuLoading(false);
    }
  };

  const handleDateChange = async (value: string) => {
    setSelectedDate(value);
    if (!value) {
      setMenuForDate(null);
      setSelectedMealTypes([]);
      return;
    }
    await loadMenuForDate(value);
  };

  const handleMealsNext = () => {
    if (!selectedDate) {
      setError('Selecione a data.');
      return;
    }
    if (!menuForDate?.week_start) {
      setError('Não foi possível localizar cardápio publicado para a data selecionada.');
      return;
    }
    if (!selectedMealTypes.length) {
      setError('Selecione pelo menos uma refeição.');
      return;
    }
    setError('');
    setStep(3);
  };

  const handleCalculate = async () => {
    if (!selectedSchool || !menuForDate?.week_start || !selectedMealTypes.length) return;
    const count = Number(studentsCount || 0);
    if (!Number.isFinite(count) || count <= 0) {
      setError('Informe uma quantidade de alunos válida.');
      return;
    }
    setCalculating(true);
    setError('');
    try {
      const students_by_meal_type = Object.fromEntries(selectedMealTypes.map((meal) => [meal, count]));
      const data = await calculatePublicMenuProductionBySchool(selectedSchool.slug, {
        week_start: menuForDate.week_start,
        students_by_meal_type,
        waste_percent: 5,
        include_stock: true,
      });
      setResult(data);
      setStep(4);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível calcular.');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 lg:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">Calculadora Pública de Produção</h1>
              <p className="text-sm text-slate-500 mt-1">Sem login: selecione escola, data, refeição e quantidade de alunos.</p>
            </div>
            <button onClick={() => navigate('/')} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
              Voltar ao login
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs font-semibold">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={`px-3 py-1 rounded-full ${step >= n ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {n === 4 ? 'Resultado' : `Passo ${n}`}
              </div>
            ))}
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

        {step === 1 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:p-6 space-y-4">
            <h2 className="font-semibold">Passo 1: Unidade Escolar</h2>
            {schoolsLoading ? (
              <p className="text-sm text-slate-500">Carregando escolas...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {schools.map((school) => (
                  <button
                    key={school.id}
                    onClick={() => setSelectedSchool(school)}
                    className={`text-left p-4 rounded-xl border ${selectedSchool?.id === school.id ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'}`}
                  >
                    <p className="font-semibold">{school.name}</p>
                    <p className="text-xs text-slate-500">{school.city || 'Sem cidade'}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={handleSchoolNext} className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold">Continuar</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:p-6 space-y-4">
            <h2 className="font-semibold">Passo 2: Data e Refeições</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Data <span className="text-red-500">*</span>
                </label>
                <input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} className="input" />
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
                <p className="font-medium">Escola</p>
                <p className="text-slate-600 dark:text-slate-300">{selectedSchool?.name}</p>
                {menuForDate?.week_start && (
                  <p className="text-xs text-slate-500 mt-1">
                    Cardápio encontrado automaticamente para a semana de {menuForDate.week_start}.
                  </p>
                )}
              </div>
            </div>

            {menuLoading && <p className="text-sm text-slate-500">Buscando cardápio da data selecionada...</p>}

            {!menuLoading && selectedDate && (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Refeições disponíveis {selectedDayCode ? `(${dayLabel[selectedDayCode] || selectedDayCode})` : ''} <span className="text-red-500">*</span>:
                </p>
                {availableMeals.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma refeição disponível para essa data.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableMeals.map((meal) => {
                      const checked = selectedMealTypes.includes(meal.meal_type);
                      return (
                        <label key={meal.meal_type} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${checked ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedMealTypes((prev) => e.target.checked ? [...prev, meal.meal_type] : prev.filter((m) => m !== meal.meal_type));
                            }}
                          />
                          <div>
                            <p className="font-medium">{meal.label}</p>
                            <p className="text-xs text-slate-500">{meal.count} item(ns) no cardápio</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">Voltar</button>
              <button onClick={handleMealsNext} className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold">Continuar</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:p-6 space-y-4">
            <h2 className="font-semibold">Passo 3: Quantidade de Alunos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Quantidade de alunos <span className="text-red-500">*</span>
                </label>
                <input type="number" min="1" value={studentsCount} onChange={(e) => setStudentsCount(e.target.value)} className="input" />
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
                <p><span className="font-medium">Data:</span> {selectedDate || '-'}</p>
                <p className="mt-1"><span className="font-medium">Refeições:</span> {selectedMealTypes.map((m) => mealLabels[m] || m).join(', ')}</p>
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">Voltar</button>
              <button onClick={handleCalculate} disabled={calculating} className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold disabled:opacity-50">
                {calculating ? 'Calculando...' : 'Ver Resultado'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && filteredResult && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Resultado do Cálculo</h2>
                  <p className="text-sm text-slate-500">
                    {selectedSchool?.name} • {selectedDate} • {selectedMealTypes.map((m) => mealLabels[m] || m).join(', ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.print()} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    Imprimir
                  </button>
                  <button onClick={() => navigate('/')} className="px-4 py-2 rounded-xl bg-primary text-white">
                    Voltar ao login
                  </button>
                </div>
              </div>
            </div>

            {selectedDayResult && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:p-6">
                <h3 className="font-semibold">Refeições calculadas do dia</h3>
                <div className="mt-3 space-y-3">
                  {(selectedDayResult.meals || []).map((meal: any, idx: number) => (
                    <div key={`${meal.meal_type}-${idx}`} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                      <p className="font-medium">{mealLabels[meal.meal_type] || meal.meal_type}{meal.meal_name ? ` • ${meal.meal_name}` : ''}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {meal.recipe_id ? `Com receita (${String(meal.recipe_id).slice(0, 8)})` : 'Sem receita associada'}
                        {meal.scale_factor != null ? ` • Escala ${Number(meal.scale_factor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:p-6">
              <h3 className="font-semibold">Insumos Necessários</h3>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2">Insumo</th>
                      <th>Qtd</th>
                      <th>Unid</th>
                      <th>Saldo</th>
                      <th>A Comprar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredResult.totals_week || []).map((row: any) => {
                      const shortage = Number(row.stock_shortage || 0) > 0;
                      return (
                        <tr key={`${row.supply_id}-${row.unit}`} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2">{row.supply_name}</td>
                          <td>{Number(row.qty_needed || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                          <td>{row.unit}</td>
                          <td>{formatQty(row.stock_available, row.unit)}</td>
                          <td className={shortage ? 'text-red-600 font-semibold' : 'text-slate-400'}>
                            {shortage ? formatQty(row.stock_shortage, row.unit) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                    {(!filteredResult.totals_week || filteredResult.totals_week.length === 0) && (
                      <tr><td colSpan={5} className="py-6 text-center text-slate-500">Nenhum insumo calculado para a seleção.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">Recalcular</button>
              <button onClick={() => { setStep(1); setResult(null); setMenuForDate(null); setSelectedMealTypes([]); setSelectedDate(''); }} className="px-4 py-2 rounded-xl bg-slate-800 text-white">
                Novo Cálculo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicCalculatorWizard;
