import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getPublicSupplies, submitPublicConsumption } from '../api';

const PublicConsumption: React.FC = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const slug = params.get('slug') || '';
  const token = params.get('token') || '';

  const [supplies, setSupplies] = useState<any[]>([]);
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<Record<string, { quantity: string; note: string }>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!slug || !token) {
      setError('Link de consumo invalido.');
      setLoading(false);
      return;
    }

    setLoading(true);
    getPublicSupplies(slug, token)
      .then((data) => {
        setSupplies(data);
        const nextForm: Record<string, { quantity: string; note: string }> = {};
        data.forEach((supply: any) => {
          nextForm[supply.id] = { quantity: '', note: '' };
        });
        setForm(nextForm);
      })
      .catch(() => setError('Nao foi possivel carregar os insumos.'))
      .finally(() => setLoading(false));
  }, [slug, token]);

  const updateItem = (supplyId: string, field: 'quantity' | 'note', value: string) => {
    setForm((prev) => ({
      ...prev,
      [supplyId]: {
        ...prev[supplyId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError('');
    setSuccess('');

    const items = supplies
      .map((supply) => {
        const quantity = Number(form[supply.id]?.quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) return null;
        return {
          supply: supply.id,
          quantity,
          movement_date: movementDate,
          note: form[supply.id]?.note || '',
        };
      })
      .filter(Boolean) as Array<{ supply: string; quantity: number; movement_date: string; note?: string }>;

    if (!items.length) {
      setError('Informe ao menos um item com quantidade.');
      setSending(false);
      return;
    }

    try {
      await submitPublicConsumption(slug, token, { items });
      setSuccess('Consumo registrado com sucesso.');
      setForm((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          next[key] = { quantity: '', note: '' };
        });
        return next;
      });
    } catch {
      setError('Nao foi possivel registrar o consumo.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Carregando insumos...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-12">
      <div className="mx-auto max-w-3xl bg-white rounded-xl border border-slate-200 p-4">
        <h1 className="text-xl font-bold">Registro de consumo</h1>
        <p className="text-sm text-slate-600 mt-1">Informe as saidas do material utilizado na escola.</p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Data do consumo</span>
            <input
              type="date"
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 px-3"
            />
          </label>

          {supplies.map((supply) => (
            <div key={supply.id} className="rounded-lg border border-slate-200 p-3">
              <p className="font-semibold">{supply.name}</p>
              <p className="text-xs text-slate-500">Unidade: {supply.unit}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form[supply.id]?.quantity || ''}
                  onChange={(e) => updateItem(supply.id, 'quantity', e.target.value)}
                  className="h-10 rounded-lg border border-slate-200 px-3"
                  placeholder="Quantidade utilizada"
                />
                <input
                  value={form[supply.id]?.note || ''}
                  onChange={(e) => updateItem(supply.id, 'note', e.target.value)}
                  className="h-10 rounded-lg border border-slate-200 px-3"
                  placeholder="Observacao (opcional)"
                />
              </div>
            </div>
          ))}

          <button disabled={sending} type="submit" className="h-11 rounded-lg bg-primary text-white font-bold disabled:opacity-60">
            {sending ? 'Enviando...' : 'Registrar consumo'}
          </button>
        </form>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        {success && <p className="text-green-600 text-sm mt-3">{success}</p>}
      </div>
    </div>
  );
};

export default PublicConsumption;
