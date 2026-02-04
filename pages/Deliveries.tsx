import React, { useEffect, useMemo, useState } from 'react';
import { createDelivery, getDeliveries, getDeliveryConferenceLink, getSchools, getSupplies, sendDelivery } from '../api';

const today = new Date().toISOString().slice(0, 10);

type DraftItem = { supply: string; planned_quantity: string };

const Deliveries: React.FC = () => {
  const [schools, setSchools] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([{ supply: '', planned_quantity: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [linkByDelivery, setLinkByDelivery] = useState<Record<string, string>>({});

  const loadData = async () => {
    setError('');
    try {
      const [schoolsData, suppliesData, deliveriesData] = await Promise.all([
        getSchools(),
        getSupplies({ is_active: true }),
        getDeliveries(statusFilter ? { status: statusFilter } : undefined),
      ]);
      setSchools(schoolsData);
      setSupplies(suppliesData);
      setDeliveries(deliveriesData);
      if (!schoolId && schoolsData.length) {
        setSchoolId(schoolsData[0].id);
      }
    } catch {
      setError('Nao foi possivel carregar as entregas.');
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const isFormValid = useMemo(() => {
    if (!schoolId || !deliveryDate) return false;
    return items.every((item) => item.supply && Number(item.planned_quantity) > 0);
  }, [schoolId, deliveryDate, items]);

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, { supply: '', planned_quantity: '' }]);
  };

  const removeItemRow = (index: number) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!isFormValid) {
      setError('Preencha escola, data e quantidades.');
      return;
    }

    const duplicates = items.map((i) => i.supply);
    if (duplicates.length !== new Set(duplicates).size) {
      setError('Nao repita o mesmo insumo na entrega.');
      return;
    }

    setLoading(true);
    try {
      await createDelivery({
        school: schoolId,
        delivery_date: deliveryDate,
        notes,
        items: items.map((item) => ({
          supply: item.supply,
          planned_quantity: Number(item.planned_quantity),
        })),
      });
      setSuccess('Entrega criada com sucesso.');
      setNotes('');
      setItems([{ supply: '', planned_quantity: '' }]);
      await loadData();
    } catch {
      setError('Nao foi possivel criar a entrega. Verifique o estoque e os dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (deliveryId: string) => {
    setError('');
    setSuccess('');
    try {
      await sendDelivery(deliveryId);
      setSuccess('Entrega enviada. O link de conferencia foi habilitado.');
      await loadData();
    } catch {
      setError('Nao foi possivel enviar a entrega. Verifique se ha saldo suficiente.');
    }
  };

  const handleGenerateLink = async (deliveryId: string) => {
    setError('');
    try {
      const data = await getDeliveryConferenceLink(deliveryId);
      setLinkByDelivery((prev) => ({ ...prev, [deliveryId]: data.url }));
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${window.location.origin}/#${data.url}`);
      }
    } catch {
      setError('Nao foi possivel gerar o link de conferencia.');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <h3 className="text-lg font-bold mb-3">Planejar entrega para escola</h3>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3">
              {schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3" />
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observacoes da entrega" className="h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3" />
          </div>

          <div className="flex flex-col gap-2">
            {items.map((item, index) => (
              <div key={`delivery-item-${index}`} className="grid grid-cols-[1fr_120px_48px] gap-2">
                <select value={item.supply} onChange={(e) => updateItem(index, { supply: e.target.value })} className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3">
                  <option value="">Selecione o insumo</option>
                  {supplies.map((supply) => (
                    <option key={supply.id} value={supply.id}>{supply.name} ({supply.unit})</option>
                  ))}
                </select>
                <input type="number" step="0.01" min="0.01" value={item.planned_quantity} onChange={(e) => updateItem(index, { planned_quantity: e.target.value })} className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3" placeholder="Qtd." />
                <button type="button" onClick={() => removeItemRow(index)} className="h-10 rounded-lg bg-red-50 text-red-600">x</button>
              </div>
            ))}
            <button type="button" onClick={addItemRow} className="h-10 rounded-lg border border-dashed border-primary text-primary font-semibold">+ Adicionar item</button>
          </div>

          <button disabled={loading || !isFormValid} className="h-11 rounded-lg bg-primary text-white font-bold disabled:opacity-60" type="submit">
            {loading ? 'Salvando...' : 'Salvar entrega'}
          </button>
        </form>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="text-lg font-bold">Entregas</h3>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm">
            <option value="">Todos</option>
            <option value="DRAFT">Rascunho</option>
            <option value="SENT">Enviado</option>
            <option value="CONFERRED">Conferido</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          {deliveries.map((delivery) => (
            <div key={delivery.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{delivery.school_name}</p>
                  <p className="text-xs text-slate-500">Entrega: {delivery.delivery_date}</p>
                </div>
                <span className="text-xs font-bold uppercase text-primary">{delivery.status}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">{delivery.items?.length || 0} item(ns)</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {delivery.status === 'DRAFT' && (
                  <button onClick={() => handleSend(delivery.id)} className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-semibold">Habilitar conferencia</button>
                )}
                <button onClick={() => handleGenerateLink(delivery.id)} className="h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold">Gerar link da escola</button>
              </div>
              {linkByDelivery[delivery.id] && (
                <p className="text-xs text-primary mt-2 break-all">{window.location.origin}/#{linkByDelivery[delivery.id]}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">{success}</p>}
    </div>
  );
};

export default Deliveries;
