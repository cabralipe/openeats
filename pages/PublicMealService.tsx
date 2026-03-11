import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getPublicMealService, submitPublicMealService } from '../api';

type MealCategory = {
  meal_type: string;
  meal_label: string;
  items: string[];
};

type MealServicePayload = {
  school: string;
  school_name: string;
  service_date: string;
  weekday: string;
  menu: { id: string; week_start: string; week_end: string } | null;
  categories: MealCategory[];
  existing_entries: Record<string, number>;
};

const PublicMealService: React.FC = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const slug = params.get('slug') || '';
  const token = params.get('token') || '';

  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<MealServicePayload | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'date' | 'questions' | 'summary' | 'success'>('date');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categories = data?.categories || [];
  const currentCategory = categories[currentIndex];

  const totalServed = useMemo(() => {
    return categories.reduce((sum, category) => sum + Number(counts[category.meal_type] || 0), 0);
  }, [categories, counts]);

  const handleLoad = async () => {
    if (!slug || !token) {
      setError('Link invalido.');
      return;
    }
    if (!serviceDate) {
      setError('Informe a data.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = await getPublicMealService(slug, token, serviceDate) as MealServicePayload;
      setData(payload);
      const nextCounts: Record<string, string> = {};
      payload.categories.forEach((category) => {
        const saved = payload.existing_entries?.[category.meal_type];
        nextCounts[category.meal_type] = saved !== undefined ? String(saved) : '';
      });
      setCounts(nextCounts);
      if (!payload.categories.length) {
        setError('Nao ha refeicoes cadastradas no cardapio para esta data.');
        setStep('date');
        return;
      }
      setCurrentIndex(0);
      setStep('questions');
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Nao foi possivel carregar o cardapio.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const advanceQuestion = () => {
    const value = Number(counts[currentCategory.meal_type] || 0);
    if (Number.isNaN(value) || value < 0) {
      setError('Informe um numero valido de porcoes.');
      return;
    }
    setError('');
    if (currentIndex >= categories.length - 1) {
      setStep('summary');
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const goBack = () => {
    setError('');
    if (step === 'summary') {
      setStep('questions');
      setCurrentIndex(categories.length - 1);
      return;
    }
    if (step === 'questions' && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      return;
    }
    if (step === 'questions' && currentIndex === 0) {
      setStep('date');
    }
  };

  const submit = async () => {
    if (!data) return;
    setSaving(true);
    setError('');
    try {
      await submitPublicMealService(slug, token, {
        service_date: data.service_date,
        items: categories.map((category) => ({
          meal_type: category.meal_type,
          served_count: Number(counts[category.meal_type] || 0),
        })),
      });
      setStep('success');
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Nao foi possivel enviar as refeicoes servidas.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-secondary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-6 text-white">
          <h1 className="text-xl font-bold">Registro de Refeicoes Servidas</h1>
          <p className="text-sm text-white/80 mt-1">{data?.school_name || 'Link da escola'}</p>
        </div>

        <div className="p-6 space-y-4">
          {step === 'date' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Data <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="input w-full"
                />
              </div>
              <button onClick={handleLoad} disabled={loading} className="btn-primary w-full">
                {loading ? 'Carregando...' : 'Avancar'}
              </button>
            </>
          )}

          {step === 'questions' && currentCategory && (
            <>
              <div className="text-sm text-slate-500">
                Etapa {currentIndex + 1} de {categories.length} • {data?.weekday}
              </div>
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-lg font-bold text-slate-900">{currentCategory.meal_label}</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {currentCategory.items.slice(0, 3).map((item, idx) => (
                    <li key={`${currentCategory.meal_type}-${idx}`}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Quantas porcoes foram servidas? <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={counts[currentCategory.meal_type] || ''}
                  onChange={(e) => setCounts((prev) => ({ ...prev, [currentCategory.meal_type]: e.target.value }))}
                  className="input w-full"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={goBack} className="btn-secondary flex-1">Voltar</button>
                <button onClick={advanceQuestion} className="btn-primary flex-1">Avancar</button>
              </div>
            </>
          )}

          {step === 'summary' && data && (
            <>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-800">{data.school_name}</p>
                <p className="text-sm text-slate-500">{data.service_date} • {data.weekday}</p>
              </div>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.meal_type} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                    <span className="text-slate-700">{category.meal_label}</span>
                    <span className="font-semibold text-slate-900">{Number(counts[category.meal_type] || 0)}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-primary-50 p-3 text-primary-700 text-sm font-medium">
                Total servido: {totalServed}
              </div>
              <div className="flex gap-3">
                <button onClick={goBack} className="btn-secondary flex-1">Voltar</button>
                <button onClick={submit} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="text-center space-y-4 py-4">
              <span className="material-symbols-outlined text-5xl text-success-500">check_circle</span>
              <p className="text-lg font-bold text-slate-900">Refeicoes enviadas com sucesso</p>
              <p className="text-sm text-slate-500">Total registrado: {totalServed}</p>
              <button
                onClick={() => {
                  setStep('date');
                  setData(null);
                  setCounts({});
                }}
                className="btn-primary w-full"
              >
                Novo lancamento
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-sm p-3">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicMealService;
