import React, { useEffect, useMemo, useState } from 'react';
import { createDelivery, getDeliveries, getDeliveryConferenceLink, getPublicLink, getSchools, getSupplies, sendDelivery } from '../api';

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
  const [consumptionLinkByDelivery, setConsumptionLinkByDelivery] = useState<Record<string, string>>({});
  const [signaturePreview, setSignaturePreview] = useState<{ image: string; title: string; submittedAt?: string; signedBy?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'new' | 'list'>('list');

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
      if (Array.isArray(parsed)) setResponsibles(parsed);
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
      if (!schoolId && schoolsData.length) setSchoolId(schoolsData[0].id);
    } catch {
      setError('Não foi possível carregar as entregas.');
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

  const addItemRow = () => setItems((prev) => [...prev, { supply: '', planned_quantity: '' }]);
  const removeItemRow = (index: number) => setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));

  const handleAddResponsible = () => {
    const name = newResponsibleName.trim();
    const phone = newResponsiblePhone.trim();
    if (!name) {
      setError('Informe o nome do responsável.');
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
    setSuccess('Responsável cadastrado.');
  };

  const handleRemoveResponsible = (id: string) => {
    persistResponsibles(responsibles.filter((item) => item.id !== id));
    if (selectedResponsibleId === id) setSelectedResponsibleId('');
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!isFormValid) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    const duplicates = items.map((i) => i.supply);
    if (duplicates.length !== new Set(duplicates).size) {
      setError('Não repita o mesmo insumo.');
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
      setSuccess('Entrega criada com sucesso!');
      setNotes('');
      setItems([{ supply: '', planned_quantity: '' }]);
      setActiveTab('list');
      await loadData();
    } catch {
      setError('Não foi possível criar a entrega.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (deliveryId: string) => {
    setError('');
    setSuccess('');
    try {
      await sendDelivery(deliveryId);
      setSuccess('Entrega enviada! Link de conferência habilitado.');
      await loadData();
    } catch {
      setError('Não foi possível enviar. Verifique o saldo.');
    }
  };

  const handleGenerateLink = async (deliveryId: string) => {
    try {
      const data = await getDeliveryConferenceLink(deliveryId);
      setLinkByDelivery((prev) => ({ ...prev, [deliveryId]: data.url }));
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${window.location.origin}/#${data.url}`);
        setSuccess('Link copiado!');
      }
    } catch {
      setError('Erro ao gerar link.');
    }
  };

  const handleGenerateConsumptionLink = async (deliveryId: string, school: string) => {
    try {
      const data = await getPublicLink(school);
      const url = `/public/consumption?slug=${data.slug}&token=${data.token}`;
      setConsumptionLinkByDelivery((prev) => ({ ...prev, [deliveryId]: url }));
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${window.location.origin}/#${url}`);
        setSuccess('Link copiado!');
      }
    } catch {
      setError('Erro ao gerar link.');
    }
  };

  const formatDateTime = (value?: string) => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'badge-warning';
      case 'SENT': return 'badge-primary';
      case 'CONFERRED': return 'badge-success';
      default: return 'badge';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'Rascunho';
      case 'SENT': return 'Enviada';
      case 'CONFERRED': return 'Conferida';
      default: return status;
    }
  };

  return (
    <div className="flex flex-col flex-1 pb-24 lg:pb-8">
      {/* Header & Tabs */}
      <div className="p-4 lg:p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Entregas</h1>
          <button onClick={() => setActiveTab('new')} className="btn-primary">
            <span className="material-symbols-outlined">add</span>
            <span className="hidden sm:inline">Nova Entrega</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
              }`}
          >
            Lista de Entregas
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'new'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
              }`}
          >
            Nova Entrega
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mx-4 lg:mx-6 mt-4 p-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 text-danger-600 text-sm flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined">error</span>
          {error}
          <button onClick={() => setError('')} className="ml-auto"><span className="material-symbols-outlined text-lg">close</span></button>
        </div>
      )}
      {success && (
        <div className="mx-4 lg:mx-6 mt-4 p-4 rounded-xl bg-success-50 dark:bg-success-900/20 text-success-600 text-sm flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined">check_circle</span>
          {success}
          <button onClick={() => setSuccess('')} className="ml-auto"><span className="material-symbols-outlined text-lg">close</span></button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4 lg:p-6">
        {activeTab === 'new' ? (
          <div className="card p-6 max-w-3xl mx-auto">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Planejar Entrega</h2>

            {/* Quick Responsibles */}
            <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Responsáveis salvos</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {responsibles.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedResponsibleId(item.id)}
                    className={`chip ${selectedResponsibleId === item.id ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : ''}`}
                  >
                    {item.name} {item.phone && `• ${item.phone}`}
                  </button>
                ))}
                {responsibles.length === 0 && (
                  <p className="text-xs text-slate-400">Nenhum responsável salvo</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_100px] gap-2">
                <input
                  value={newResponsibleName}
                  onChange={(e) => setNewResponsibleName(e.target.value)}
                  className="input"
                  placeholder="Nome do responsável"
                />
                <input
                  value={newResponsiblePhone}
                  onChange={(e) => setNewResponsiblePhone(e.target.value)}
                  className="input"
                  placeholder="Telefone"
                />
                <button type="button" onClick={handleAddResponsible} className="btn-primary">
                  Salvar
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Escola</label>
                  <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="input">
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>{school.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data da entrega</label>
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="input" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Observações</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Opcional" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Responsável</label>
                  <input value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} className="input" placeholder="Nome" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Telefone</label>
                  <input value={responsiblePhone} onChange={(e) => setResponsiblePhone(e.target.value)} className="input" placeholder="Telefone" />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Itens da entrega</label>
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_100px_40px] gap-2">
                    <select value={item.supply} onChange={(e) => updateItem(index, { supply: e.target.value })} className="input">
                      <option value="">Selecione o insumo</option>
                      {supplies.map((supply) => (
                        <option key={supply.id} value={supply.id}>{supply.name} ({supply.unit})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.planned_quantity}
                      onChange={(e) => updateItem(index, { planned_quantity: e.target.value })}
                      className="input"
                      placeholder="Qtd."
                    />
                    <button type="button" onClick={() => removeItemRow(index)} className="btn-ghost text-danger-500">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addItemRow} className="w-full btn-secondary border-dashed">
                  <span className="material-symbols-outlined">add</span>
                  Adicionar item
                </button>
              </div>

              <button disabled={loading || !isFormValid} type="submit" className="w-full btn-primary h-12">
                {loading ? 'Salvando...' : 'Criar Entrega'}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {['', 'DRAFT', 'SENT', 'CONFERRED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`chip shrink-0 ${statusFilter === status ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : ''}`}
                >
                  {status === '' ? 'Todos' : getStatusLabel(status)}
                </button>
              ))}
            </div>

            {/* Deliveries List */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {deliveries.map((delivery, index) => (
                <div key={delivery.id} className="card p-5 animate-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{delivery.school_name}</h3>
                      <p className="text-sm text-slate-500">{delivery.delivery_date}</p>
                    </div>
                    <span className={getStatusColor(delivery.status)}>{getStatusLabel(delivery.status)}</span>
                  </div>

                  {(delivery.responsible_name || delivery.responsible_phone) && (
                    <p className="text-xs text-slate-500 mb-2">
                      <span className="material-symbols-outlined text-sm align-middle mr-1">person</span>
                      {delivery.responsible_name || 'Não informado'}
                      {delivery.responsible_phone && ` • ${delivery.responsible_phone}`}
                    </p>
                  )}

                  <p className="text-xs text-slate-400 mb-3">{delivery.items?.length || 0} item(ns)</p>

                  {delivery.conference_signature && (
                    <div className="p-3 rounded-lg bg-success-50 dark:bg-success-900/20 mb-3">
                      <p className="text-xs text-success-600 font-medium">✓ Assinatura registrada</p>
                      {delivery.conference_submitted_at && (
                        <p className="text-[10px] text-success-500">{formatDateTime(delivery.conference_submitted_at)}</p>
                      )}
                      <button
                        onClick={() => setSignaturePreview({
                          image: delivery.conference_signature,
                          title: delivery.school_name,
                          submittedAt: delivery.conference_submitted_at,
                          signedBy: delivery.conference_signed_by
                        })}
                        className="text-xs text-primary-500 underline mt-1"
                      >
                        Ver assinatura
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {delivery.status === 'DRAFT' && (
                      <button onClick={() => handleSend(delivery.id)} className="btn-primary text-xs py-1.5">
                        Habilitar conferência
                      </button>
                    )}
                    <button onClick={() => handleGenerateLink(delivery.id)} className="btn-secondary text-xs py-1.5">
                      <span className="material-symbols-outlined text-sm">link</span>
                      Link escola
                    </button>
                    <button onClick={() => handleGenerateConsumptionLink(delivery.id, delivery.school)} className="btn-secondary text-xs py-1.5">
                      <span className="material-symbols-outlined text-sm">inventory</span>
                      Link consumo
                    </button>
                  </div>

                  {linkByDelivery[delivery.id] && (
                    <p className="text-xs text-primary-500 mt-2 break-all">{window.location.origin}/#{linkByDelivery[delivery.id]}</p>
                  )}
                </div>
              ))}

              {deliveries.length === 0 && (
                <div className="col-span-full empty-state">
                  <div className="empty-state-icon">
                    <span className="material-symbols-outlined text-3xl">local_shipping</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Nenhuma entrega</h3>
                  <p className="text-slate-500 mb-4">Crie sua primeira entrega para começar</p>
                  <button onClick={() => setActiveTab('new')} className="btn-primary">Nova Entrega</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Signature Preview Modal */}
      {signaturePreview && (
        <div className="modal-overlay" onClick={() => setSignaturePreview(null)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Assinatura</h3>
                <p className="text-sm text-slate-500">{signaturePreview.title}</p>
                {signaturePreview.submittedAt && (
                  <p className="text-xs text-slate-400">{formatDateTime(signaturePreview.submittedAt)}</p>
                )}
                {signaturePreview.signedBy && (
                  <p className="text-xs text-slate-500">Assinado por: {signaturePreview.signedBy}</p>
                )}
              </div>
              <button onClick={() => setSignaturePreview(null)} className="btn-ghost">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <img src={signaturePreview.image} alt="Assinatura" className="w-full rounded-xl border border-slate-200 dark:border-slate-700" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Deliveries;
