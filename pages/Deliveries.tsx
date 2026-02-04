import React, { useEffect, useMemo, useState } from 'react';
import { createDelivery, getDeliveries, getDeliveryConferenceLink, getSchools, getSupplies, sendDelivery } from '../api';

const today = new Date().toISOString().slice(0, 10);
const RESPONSIBLES_STORAGE_KEY = 'semed_delivery_responsibles';

type DraftItem = { supply: string; planned_quantity: string };
type Responsible = { id: string; name: string; phone: string };

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

  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [selectedResponsibleId, setSelectedResponsibleId] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [responsiblePhone, setResponsiblePhone] = useState('');
  const [newResponsibleName, setNewResponsibleName] = useState('');
  const [newResponsiblePhone, setNewResponsiblePhone] = useState('');

  const persistResponsibles = (next: Responsible[]) => {
    setResponsibles(next);
    localStorage.setItem(RESPONSIBLES_STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    const saved = localStorage.getItem(RESPONSIBLES_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setResponsibles(parsed);
      }
    } catch {
      setResponsibles([]);
    }
  }, []);

  useEffect(() => {
    if (!selectedResponsibleId) return;
    const selected = responsibles.find((r) => r.id === selectedResponsibleId);
    if (!selected) return;
    setResponsibleName(selected.name);
    setResponsiblePhone(selected.phone);
  }, [selectedResponsibleId, responsibles]);

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

  const conferencesBySchool = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    deliveries
      .filter((delivery) => delivery.status !== 'DRAFT')
      .forEach((delivery) => {
        const key = delivery.school_name || 'Sem escola';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(delivery);
      });
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [deliveries]);

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, { supply: '', planned_quantity: '' }]);
  };

  const removeItemRow = (index: number) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const handleAddResponsible = () => {
    const name = newResponsibleName.trim();
    const phone = newResponsiblePhone.trim();
    if (!name) {
      setError('Informe o nome do responsavel para cadastrar.');
      return;
    }
    const next: Responsible[] = [
      { id: crypto.randomUUID(), name, phone },
      ...responsibles.filter((item) => !(item.name === name && item.phone === phone)),
    ];
    persistResponsibles(next);
    setSelectedResponsibleId(next[0].id);
    setResponsibleName(name);
    setResponsiblePhone(phone);
    setNewResponsibleName('');
    setNewResponsiblePhone('');
    setError('');
    setSuccess('Responsavel cadastrado para uso rapido.');
  };

  const handleRemoveResponsible = (id: string) => {
    const next = responsibles.filter((item) => item.id !== id);
    persistResponsibles(next);
    if (selectedResponsibleId === id) {
      setSelectedResponsibleId('');
    }
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
        responsible_name: responsibleName.trim() || undefined,
        responsible_phone: responsiblePhone.trim() || undefined,
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

        <div className="mb-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-3">
          <p className="text-sm font-semibold mb-2">Cadastro rapido de responsaveis</p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_140px] gap-2">
            <input value={newResponsibleName} onChange={(e) => setNewResponsibleName(e.target.value)} className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3" placeholder="Nome do responsavel" />
            <input value={newResponsiblePhone} onChange={(e) => setNewResponsiblePhone(e.target.value)} className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3" placeholder="Telefone" />
            <button type="button" onClick={handleAddResponsible} className="h-10 rounded-lg bg-primary text-white text-sm font-semibold">Cadastrar</button>
          </div>
          {responsibles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {responsibles.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelectedResponsibleId(item.id)} className={`h-8 px-3 rounded-full text-xs border ${selectedResponsibleId === item.id ? 'border-primary text-primary bg-primary/10' : 'border-slate-200 text-slate-600'}`}>
                  {item.name} {item.phone ? `• ${item.phone}` : ''}
                </button>
              ))}
            </div>
          )}
          {selectedResponsibleId && (
            <button type="button" onClick={() => handleRemoveResponsible(selectedResponsibleId)} className="mt-2 text-xs text-red-600 underline">
              Remover responsavel selecionado
            </button>
          )}
        </div>

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3" placeholder="Responsavel pela entrega" />
            <input value={responsiblePhone} onChange={(e) => setResponsiblePhone(e.target.value)} className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3" placeholder="Telefone do responsavel" />
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
              {(delivery.responsible_name || delivery.responsible_phone) && (
                <p className="text-xs text-slate-600 mt-1">
                  Responsavel: {delivery.responsible_name || 'Nao informado'}
                  {delivery.responsible_phone ? ` • ${delivery.responsible_phone}` : ''}
                </p>
              )}
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

      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <h3 className="text-lg font-bold mb-3">Conferencias por escola</h3>
        {conferencesBySchool.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma conferencia habilitada no momento.</p>
        )}
        <div className="flex flex-col gap-3">
          {conferencesBySchool.map(([schoolName, schoolDeliveries]) => (
            <div key={schoolName} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{schoolName}</p>
                <span className="text-xs text-slate-500">{schoolDeliveries.length} conferencia(s)</span>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {schoolDeliveries.map((delivery) => (
                  <div key={delivery.id} className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm">Entrega: {delivery.delivery_date}</p>
                      <span className={`text-[11px] font-bold uppercase ${delivery.status === 'CONFERRED' ? 'text-green-600' : 'text-amber-600'}`}>
                        {delivery.status}
                      </span>
                    </div>
                    {(delivery.responsible_name || delivery.responsible_phone) && (
                      <p className="text-xs text-slate-600 mt-1">
                        Responsavel: {delivery.responsible_name || 'Nao informado'}
                        {delivery.responsible_phone ? ` • ${delivery.responsible_phone}` : ''}
                      </p>
                    )}
                    {linkByDelivery[delivery.id] ? (
                      <p className="text-xs text-primary mt-1 break-all">{window.location.origin}/#{linkByDelivery[delivery.id]}</p>
                    ) : (
                      <button onClick={() => handleGenerateLink(delivery.id)} className="mt-2 h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-semibold">
                        Gerar link desta conferencia
                      </button>
                    )}
                  </div>
                ))}
              </div>
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
