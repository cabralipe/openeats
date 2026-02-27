import React, { useEffect, useMemo, useState } from 'react';
import {
  copyDelivery,
  createDelivery,
  deleteDelivery,
  getDeliveries,
  getDeliveryConferenceLink,
  getPublicLink,
  getSchools,
  getSupplies,
  sendDelivery,
  suggestDeliveryItemLots,
  updateDelivery,
} from '../api';

const today = new Date().toISOString().slice(0, 10);
const RESPONSIBLES_STORAGE_KEY = 'semed_delivery_responsibles';

type DraftItem = { supply: string; planned_quantity: string };
type Responsible = { id: string; name: string; phone: string };
type WizardStep = 1 | 2 | 3;

const Deliveries: React.FC = () => {
  const [schools, setSchools] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lotSuggestionLoadingByItem, setLotSuggestionLoadingByItem] = useState<Record<string, boolean>>({});
  const [suggestingAllLots, setSuggestingAllLots] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [linkByDelivery, setLinkByDelivery] = useState<Record<string, string>>({});
  const [consumptionLinkByDelivery, setConsumptionLinkByDelivery] = useState<Record<string, string>>({});
  const [signaturePreview, setSignaturePreview] = useState<{ image: string; title: string; submittedAt?: string; signedBy?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'new' | 'list'>('list');
  const [selectedDelivery, setSelectedDelivery] = useState<any | null>(null);
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);

  const [copyModalDelivery, setCopyModalDelivery] = useState<any | null>(null);
  const [copyTargetSchools, setCopyTargetSchools] = useState<string[]>([]);
  const [copyingDelivery, setCopyingDelivery] = useState(false);

  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [selectedResponsibleId, setSelectedResponsibleId] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [responsiblePhone, setResponsiblePhone] = useState('');
  const [newResponsibleName, setNewResponsibleName] = useState('');
  const [newResponsiblePhone, setNewResponsiblePhone] = useState('');

  const [creationStep, setCreationStep] = useState<WizardStep>(1);
  const [draftSupplyId, setDraftSupplyId] = useState('');
  const [draftQuantity, setDraftQuantity] = useState('');

  const buildAbsoluteHashUrl = (path: string) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${window.location.origin}/#${normalized}`;
  };

  const persistResponsibles = (next: Responsible[]) => {
    setResponsibles(next);
    localStorage.setItem(RESPONSIBLES_STORAGE_KEY, JSON.stringify(next));
  };

  const resetForm = () => {
    setSchoolId(schools[0]?.id || '');
    setDeliveryDate(today);
    setNotes('');
    setItems([]);
    setCreationStep(1);
    setDraftSupplyId('');
    setDraftQuantity('');
    setResponsibleName('');
    setResponsiblePhone('');
    setSelectedResponsibleId('');
    setEditingDeliveryId(null);
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
    const [schoolsRes, suppliesRes, deliveriesRes] = await Promise.allSettled([
      getSchools(),
      getSupplies({ is_active: true }),
      getDeliveries(statusFilter ? { status: statusFilter } : undefined),
    ]);

    if (schoolsRes.status === 'fulfilled') {
      const schoolsData = schoolsRes.value as any[];
      setSchools(schoolsData);
      if (!schoolId && schoolsData.length) setSchoolId(schoolsData[0].id);
    }
    if (suppliesRes.status === 'fulfilled') {
      setSupplies(suppliesRes.value as any[]);
    }
    if (deliveriesRes.status === 'fulfilled') {
      const deliveriesData = deliveriesRes.value as any[];
      setDeliveries(deliveriesData);
      if (selectedDelivery) {
        const updated = deliveriesData.find((d: any) => d.id === selectedDelivery.id);
        if (updated) setSelectedDelivery(updated);
      }
    }

    const failed: string[] = [];
    if (schoolsRes.status === 'rejected') failed.push('escolas');
    if (suppliesRes.status === 'rejected') failed.push('insumos');
    if (deliveriesRes.status === 'rejected') failed.push('entregas');
    if (failed.length) {
      setError(`Não foi possível carregar: ${failed.join(', ')}.`);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  useEffect(() => {
    const delivery = selectedDelivery;
    if (!delivery || delivery.status !== 'SENT') return;
    if (linkByDelivery[delivery.id]) return;

    getDeliveryConferenceLink(delivery.id)
      .then((data) => {
        setLinkByDelivery((prev) => ({ ...prev, [delivery.id]: data.url }));
      })
      .catch(() => {
        // Silent: user can still generate/copy manually via action buttons.
      });
  }, [selectedDelivery, linkByDelivery]);

  const selectedSchoolName = useMemo(() => schools.find((school) => school.id === schoolId)?.name || 'Não selecionada', [schools, schoolId]);

  const filteredDeliveries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return deliveries;
    return deliveries.filter((delivery) => {
      const school = (delivery.school_name || '').toLowerCase();
      const responsible = (delivery.responsible_name || '').toLowerCase();
      return school.includes(query) || responsible.includes(query);
    });
  }, [deliveries, searchQuery]);

  const isStep1Valid = useMemo(() => Boolean(schoolId && deliveryDate), [schoolId, deliveryDate]);
  const isStep2Valid = useMemo(() => items.length > 0, [items]);
  const isFormValid = useMemo(() => {
    if (!schoolId || !deliveryDate || items.length === 0) return false;
    return items.every((item) => item.supply && Number(item.planned_quantity) > 0);
  }, [schoolId, deliveryDate, items]);

  const getSupplyById = (supplyId: string) => supplies.find((s) => s.id === supplyId);

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

  const handleAddItem = () => {
    const supply = draftSupplyId;
    const quantity = Number(draftQuantity);

    if (!supply) {
      setError('Selecione um insumo.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Informe uma quantidade válida.');
      return;
    }
    if (items.some((item) => item.supply === supply)) {
      setError('Não repita o mesmo insumo.');
      return;
    }

    setItems((prev) => [...prev, { supply, planned_quantity: draftQuantity }]);
    setDraftSupplyId('');
    setDraftQuantity('');
    setError('');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateOrUpdate = async () => {
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

    const payload = {
      school: schoolId,
      delivery_date: deliveryDate,
      responsible_name: responsibleName.trim() || undefined,
      responsible_phone: responsiblePhone.trim() || undefined,
      notes,
      items: items.map((item) => ({
        supply: item.supply,
        planned_quantity: Number(item.planned_quantity),
      })),
    };

    setLoading(true);
    try {
      if (editingDeliveryId) {
        await updateDelivery(editingDeliveryId, payload);
        setSuccess('Entrega atualizada com sucesso!');
      } else {
        await createDelivery(payload);
        setSuccess('Entrega criada com sucesso!');
      }
      resetForm();
      setActiveTab('list');
      setSelectedDelivery(null);
      await loadData();
    } catch {
      setError(editingDeliveryId ? 'Não foi possível atualizar a entrega.' : 'Não foi possível criar a entrega.');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    resetForm();
    setActiveTab('new');
  };

  const startEditDelivery = (delivery: any) => {
    setEditingDeliveryId(delivery.id);
    setSchoolId(delivery.school);
    setDeliveryDate(delivery.delivery_date || today);
    setNotes(delivery.notes || '');
    setResponsibleName(delivery.responsible_name || '');
    setResponsiblePhone(delivery.responsible_phone || '');
    setItems((delivery.items || []).map((item: any) => ({
      supply: item.supply,
      planned_quantity: String(item.planned_quantity),
    })));
    setCreationStep(1);
    setDraftSupplyId('');
    setDraftQuantity('');
    setSelectedDelivery(null);
    setActiveTab('new');
  };

  const handleSend = async (deliveryId: string, keepDetailOpen = false) => {
    setError('');
    setSuccess('');
    try {
      await sendDelivery(deliveryId);
      setSuccess('Entrega enviada! Link de conferência habilitado.');
      await loadData();
      if (!keepDetailOpen) setSelectedDelivery(null);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar. Verifique o saldo.');
    }
  };

  const handleSuggestLotsForItem = async (deliveryId: string, itemId: string) => {
    setError('');
    setSuccess('');
    setLotSuggestionLoadingByItem((prev) => ({ ...prev, [itemId]: true }));
    try {
      await suggestDeliveryItemLots(deliveryId, itemId);
      await loadData();
      setSuccess('Sugestão FEFO atualizada para o item.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível gerar sugestão FEFO.');
    } finally {
      setLotSuggestionLoadingByItem((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleSuggestLotsForAllItems = async (delivery: any) => {
    const draftItems = (delivery?.items || []).filter((item: any) => Number(item.planned_quantity || 0) > 0);
    if (!draftItems.length) return;
    setError('');
    setSuccess('');
    setSuggestingAllLots(true);
    try {
      for (const item of draftItems) {
        setLotSuggestionLoadingByItem((prev) => ({ ...prev, [item.id]: true }));
        try {
          await suggestDeliveryItemLots(delivery.id, item.id);
        } finally {
          setLotSuggestionLoadingByItem((prev) => ({ ...prev, [item.id]: false }));
        }
      }
      await loadData();
      setSuccess('Sugestão FEFO atualizada para todos os itens da entrega.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível gerar as sugestões FEFO.');
    } finally {
      setSuggestingAllLots(false);
    }
  };

  const handleGenerateLink = async (deliveryId: string) => {
    try {
      const data = await getDeliveryConferenceLink(deliveryId);
      setLinkByDelivery((prev) => ({ ...prev, [deliveryId]: data.url }));
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(buildAbsoluteHashUrl(data.url));
        setSuccess('Link copiado!');
      }
    } catch {
      setError('Erro ao gerar link.');
    }
  };

  const handleGenerateConsumptionLink = async (deliveryId: string, school: string) => {
    try {
      const data = await getPublicLink(school);
      const search = new URLSearchParams({ slug: data.slug, token: data.token }).toString();
      const url = `/public/meal-service?${search}`;
      setConsumptionLinkByDelivery((prev) => ({ ...prev, [deliveryId]: url }));
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${window.location.origin}/#${url}`);
        setSuccess('Link de refeições servidas copiado!');
      }
    } catch {
      setError('Erro ao gerar link.');
    }
  };

  const handleDeleteDelivery = async (deliveryId: string) => {
    const confirmed = window.confirm('Excluir esta entrega em rascunho? Esta ação não pode ser desfeita.');
    if (!confirmed) return;
    setError('');
    setSuccess('');
    try {
      await deleteDelivery(deliveryId);
      setSuccess('Entrega em rascunho excluída.');
      setSelectedDelivery(null);
      await loadData();
    } catch {
      setError('Não foi possível excluir a entrega.');
    }
  };

  const openCopyModal = (delivery: any) => {
    setCopyModalDelivery(delivery);
    setCopyTargetSchools([]);
    setError('');
    setSuccess('');
  };

  const closeCopyModal = () => {
    setCopyModalDelivery(null);
    setCopyTargetSchools([]);
    setCopyingDelivery(false);
  };

  const toggleCopyTargetSchool = (targetSchoolId: string) => {
    setCopyTargetSchools((prev) => (
      prev.includes(targetSchoolId)
        ? prev.filter((id) => id !== targetSchoolId)
        : [...prev, targetSchoolId]
    ));
  };

  const handleCopyDelivery = async () => {
    if (!copyModalDelivery) return;
    if (!copyTargetSchools.length) {
      setError('Selecione ao menos uma escola para copiar a entrega.');
      return;
    }
    setError('');
    setSuccess('');
    setCopyingDelivery(true);
    try {
      const response = await copyDelivery(copyModalDelivery.id, copyTargetSchools);
      const count = Number(response?.count || copyTargetSchools.length);
      setSuccess(`Entrega copiada para ${count} escola(s) como rascunho.`);
      closeCopyModal();
      await loadData();
    } catch {
      setError('Não foi possível copiar a entrega.');
    } finally {
      setCopyingDelivery(false);
    }
  };

  const handleShareDelivery = async (delivery: any) => {
    try {
      const relativeUrl = linkByDelivery[delivery.id] || (await getDeliveryConferenceLink(delivery.id)).url;
      if (!linkByDelivery[delivery.id]) {
        setLinkByDelivery((prev) => ({ ...prev, [delivery.id]: relativeUrl }));
      }
      const absoluteUrl = buildAbsoluteHashUrl(relativeUrl);
      if (navigator.share) {
        await navigator.share({
          title: `Entrega - ${delivery.school_name}`,
          text: `Link da entrega para ${delivery.school_name}`,
          url: absoluteUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
        setSuccess('Link da entrega copiado!');
      }
    } catch {
      setError('Não foi possível compartilhar a entrega.');
    }
  };

  const handleCopyConferenceLink = async (delivery: any) => {
    try {
      const relativeUrl = linkByDelivery[delivery.id] || (await getDeliveryConferenceLink(delivery.id)).url;
      if (!linkByDelivery[delivery.id]) {
        setLinkByDelivery((prev) => ({ ...prev, [delivery.id]: relativeUrl }));
      }
      const absoluteUrl = buildAbsoluteHashUrl(relativeUrl);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
        setSuccess('Link da entrega copiado!');
        return;
      }
      setError('Copiar não suportado neste navegador.');
    } catch {
      setError('Não foi possível copiar o link da entrega.');
    }
  };

  const formatDateTime = (value?: string) => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('pt-BR');
    } catch {
      return value;
    }
  };

  const formatDateLong = (value?: string) => {
    if (!value) return '-';
    try {
      return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return value;
    }
  };

  const formatDateShort = (value?: string) => {
    if (!value) return '-';
    try {
      return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return value;
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

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return {
          stripe: 'bg-amber-500',
          chip: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500',
        };
      case 'SENT':
        return {
          stripe: 'bg-blue-500',
          chip: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        };
      case 'CONFERRED':
        return {
          stripe: 'bg-emerald-500',
          chip: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
        };
      default:
        return {
          stripe: 'bg-slate-400',
          chip: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
        };
    }
  };

  const renderWizard = () => (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCreationStep((prev) => (prev === 1 ? 1 : ((prev - 1) as WizardStep)))}
            className="w-9 h-9 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back_ios_new</span>
          </button>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingDeliveryId ? 'Editar Entrega' : 'Nova Entrega'}</h2>
          <div className="w-9" />
        </div>

        <div className="px-5 pt-5">
          <div className="flex items-center justify-center gap-3 pb-6">
            <div className="flex flex-col items-center min-w-[64px]">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${creationStep >= 1 ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
              <span className={`text-[10px] mt-2 font-semibold uppercase tracking-wider ${creationStep >= 1 ? 'text-primary-600' : 'text-slate-400'}`}>Detalhes</span>
            </div>
            <div className={`h-0.5 flex-1 rounded-full ${creationStep >= 2 ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className="flex flex-col items-center min-w-[64px]">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${creationStep >= 2 ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
              <span className={`text-[10px] mt-2 font-semibold uppercase tracking-wider ${creationStep >= 2 ? 'text-primary-600' : 'text-slate-400'}`}>Itens</span>
            </div>
            <div className={`h-0.5 flex-1 rounded-full ${creationStep >= 3 ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className="flex flex-col items-center min-w-[64px]">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${creationStep >= 3 ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-500'}`}>3</div>
              <span className={`text-[10px] mt-2 font-semibold uppercase tracking-wider ${creationStep >= 3 ? 'text-primary-600' : 'text-slate-400'}`}>Revisão</span>
            </div>
          </div>
        </div>

        <div className="px-5 pb-6 space-y-6 min-h-[420px]">
          {creationStep === 1 && (
            <>
              <section className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Escola</label>
                <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="input rounded-xl">
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Data de Entrega</label>
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="input rounded-xl" />
                </section>

                <section className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Observações</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input rounded-xl" placeholder="Opcional" type="text" />
                </section>
              </div>

              <section className="space-y-4 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Responsável pela Entrega</h3>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {responsibles.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedResponsibleId(item.id)}
                      className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border ${selectedResponsibleId === item.id
                        ? 'bg-blue-50 dark:bg-primary-900/20 border-primary-300 text-primary-700 dark:text-primary-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                    >
                      <span className="material-symbols-outlined text-sm">person</span>
                      {item.name} {item.phone && `• ${item.phone}`}
                    </button>
                  ))}
                </div>

                <div className="bg-slate-100/80 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Nome do responsável</label>
                    <input
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      className="input rounded-xl text-sm"
                      placeholder="Digite o nome completo"
                      type="text"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Telefone</label>
                    <input
                      value={responsiblePhone}
                      onChange={(e) => setResponsiblePhone(e.target.value)}
                      className="input rounded-xl text-sm"
                      placeholder="(00) 00000-0000"
                      type="tel"
                    />
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2">
                    <input
                      value={newResponsibleName}
                      onChange={(e) => setNewResponsibleName(e.target.value)}
                      className="input rounded-xl text-sm"
                      placeholder="Salvar novo responsável (nome)"
                    />
                    <input
                      value={newResponsiblePhone}
                      onChange={(e) => setNewResponsiblePhone(e.target.value)}
                      className="input rounded-xl text-sm"
                      placeholder="Telefone"
                    />
                    <button type="button" onClick={handleAddResponsible} className="btn-primary px-5">Salvar</button>
                  </div>
                </div>
              </section>
            </>
          )}

          {creationStep === 2 && (
            <>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Seleção de Itens</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Selecione os insumos e as quantidades para esta entrega.</p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Insumo</label>
                  <select
                    value={draftSupplyId}
                    onChange={(e) => setDraftSupplyId(e.target.value)}
                    className="input rounded-xl"
                  >
                    <option value="">Selecione o insumo</option>
                    {supplies.map((supply) => (
                      <option key={supply.id} value={supply.id}>{supply.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Quantidade</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={draftQuantity}
                      onChange={(e) => setDraftQuantity(e.target.value)}
                      className="input rounded-xl"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="w-full sm:w-24 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Unid.</label>
                    <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-medium text-center">
                      {draftSupplyId ? (getSupplyById(draftSupplyId)?.unit || '-') : '-'}
                    </div>
                  </div>
                </div>

                <button type="button" onClick={handleAddItem} className="w-full btn-secondary py-3.5 rounded-xl flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-xl">add_circle</span>
                  <span>Adicionar Item</span>
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-500 uppercase ml-1 tracking-wider">Itens Adicionados ({items.length})</h4>

                {items.map((item, index) => {
                  const supply = getSupplyById(item.supply);
                  return (
                    <div key={`${item.supply}-${index}`} className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-300">
                          <span className="material-symbols-outlined">inventory_2</span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{supply?.name || 'Insumo removido'}</p>
                          <p className="text-xs text-slate-500">{Number(item.planned_quantity).toFixed(2)} {supply?.unit || ''}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {creationStep === 3 && (
            <>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dados Gerais</h3>
                  <button type="button" onClick={() => setCreationStep(1)} className="text-primary-600 text-sm font-medium">Editar</button>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                  <p className="font-semibold text-slate-900 dark:text-white">{selectedSchoolName}</p>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Data da Entrega</p>
                      <p className="font-medium text-slate-900 dark:text-white">{deliveryDate || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Responsável</p>
                      <p className="font-medium text-slate-900 dark:text-white">{responsibleName || 'Não informado'}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Itens ({items.length})</h3>
                  <button type="button" onClick={() => setCreationStep(2)} className="text-primary-600 text-sm font-medium">Editar</button>
                </div>
                <div className="space-y-2">
                  {items.map((item, index) => {
                    const supply = getSupplyById(item.supply);
                    return (
                      <div key={`${item.supply}-${index}`} className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-300">
                            <span className="material-symbols-outlined">inventory_2</span>
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{supply?.name || 'Insumo removido'}</p>
                            <p className="text-xs text-slate-500">{Number(item.planned_quantity).toFixed(2)} {supply?.unit || ''}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {notes && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Observações</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">{notes}</p>
                </section>
              )}
            </>
          )}
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          {creationStep < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (creationStep === 1) {
                  if (!isStep1Valid) {
                    setError('Selecione a escola e a data da entrega.');
                    return;
                  }
                  setCreationStep(2);
                  return;
                }
                if (!isStep2Valid) {
                  setError('Adicione pelo menos um item para continuar.');
                  return;
                }
                setCreationStep(3);
              }}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white py-4 rounded-2xl font-bold"
            >
              {creationStep === 1 ? 'Próximo Passo' : 'Continuar'}
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={() => setCreationStep(2)} className="sm:flex-1 btn-secondary py-4 rounded-xl">Voltar</button>
              <button
                type="button"
                disabled={loading || !isFormValid}
                onClick={handleCreateOrUpdate}
                className="sm:flex-[2] bg-primary-500 hover:bg-primary-600 text-white font-bold py-4 rounded-xl disabled:opacity-60"
              >
                {loading ? 'Salvando...' : (editingDeliveryId ? 'Salvar Alterações' : 'Criar Entrega')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderList = () => (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-32">
      <header className="px-5 pt-4 pb-4 sticky top-0 z-40 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Entregas</h1>
          <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary-500/20">AS</div>
        </div>

        <div className="relative group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-200/50 dark:bg-slate-800/50 border-none rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary-500/20 transition-all text-sm placeholder:text-slate-500"
            placeholder="Buscar por escola..."
            type="text"
          />
        </div>

        <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar pb-1">
          {['', 'DRAFT', 'SENT', 'CONFERRED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap border transition-all ${statusFilter === status
                ? 'bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
            >
              {status === '' ? 'Todas' : getStatusLabel(status)}
            </button>
          ))}
        </div>
      </header>

      <main className="px-5 space-y-3">
        {filteredDeliveries.map((delivery) => {
          const statusUi = getStatusClasses(delivery.status);
          return (
            <button
              key={delivery.id}
              type="button"
              onClick={() => setSelectedDelivery(delivery)}
              className="relative w-full text-left overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all active:scale-[0.98]"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusUi.stripe}`} />
              <div className="p-4 pl-5">
                <div className="flex justify-between items-start mb-1 gap-3">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-tight">{delivery.school_name}</h3>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${statusUi.chip}`}>
                    {getStatusLabel(delivery.status)}
                  </span>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{formatDateLong(delivery.delivery_date)}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">inventory_2</span> {delivery.items?.length || 0} item(ns)
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">person</span> {delivery.responsible_name || 'Não informado'}
                  </span>
                </div>
                <div className="absolute right-4 bottom-4">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">chevron_right</span>
                </div>
              </div>
            </button>
          );
        })}

        {filteredDeliveries.length === 0 && (
          <div className="text-center py-10 text-sm text-slate-400">Nenhuma entrega encontrada.</div>
        )}
      </main>

      <button
        type="button"
        onClick={openCreate}
        className="fixed bottom-24 right-6 w-14 h-14 bg-primary-500 text-white rounded-full shadow-2xl shadow-primary-500/40 flex items-center justify-center transition-transform active:scale-90 z-50"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>
    </div>
  );

  const renderDetails = () => {
    const delivery = selectedDelivery;
    if (!delivery) return null;
    const statusLabel = getStatusLabel(delivery.status);
    const isDraft = delivery.status === 'DRAFT';
    const isSent = delivery.status === 'SENT';
    const isConferred = delivery.status === 'CONFERRED';
    const conferenceLink = linkByDelivery[delivery.id] ? buildAbsoluteHashUrl(linkByDelivery[delivery.id]) : '';
    const detailDate = formatDateShort(delivery.delivery_date);
    const itemCount = delivery.items?.length || 0;
    const statusChip = delivery.status === 'CONFERRED'
      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
      : delivery.status === 'SENT'
        ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
        : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';

    const renderItemLots = (item: any) => {
      const lots = item.lots || [];
      if (!lots.length) {
        return <p className="mt-2 text-[11px] text-slate-400">Sem lotes planejados.</p>;
      }
      const getLotStatusChip = (status?: string) => {
        if (status === 'EXPIRED') return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400';
        if (status === 'BLOCKED') return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
        if (status === 'DISCARDED') return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
        return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400';
      };
      const getLotStatusLabel = (status?: string) => {
        if (status === 'EXPIRED') return 'Vencido';
        if (status === 'BLOCKED') return 'Bloqueado';
        if (status === 'DISCARDED') return 'Descartado';
        if (status === 'ACTIVE') return 'Ativo';
        return status || 'Ativo';
      };
      return (
        <div className="mt-2 space-y-1.5">
          {lots.map((lot: any) => (
            <div key={lot.id || `${lot.lot}-${lot.lot_code}`} className="flex flex-wrap items-center justify-between gap-2 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-[11px]">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                  {lot.lot_code ? `Lote ${lot.lot_code}` : `Lote ${String(lot.lot || '').slice(0, 8)}`}
                </span>
                {lot.expiry_date && <span className="text-slate-400">Val. {lot.expiry_date}</span>}
                {lot.supplier_name && <span className="text-slate-500">Fornecedor: {lot.supplier_name}</span>}
                {lot.lot_status && (
                  <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${getLotStatusChip(lot.lot_status)}`}>
                    {getLotStatusLabel(lot.lot_status)}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="font-bold text-primary-600 dark:text-primary-400 block">
                  {Number(lot.planned_quantity || 0).toFixed(2)} {item.supply_unit || ''}
                </span>
                {lot.received_quantity != null && (
                  <span className="text-slate-500 dark:text-slate-400">
                    Receb.: {Number(lot.received_quantity || 0).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen">
        <div className="lg:hidden pb-56">
          <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDelivery(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
                </button>
                <div>
                  <h1 className="text-lg font-bold leading-tight">{delivery.school_name}</h1>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Detalhes da Entrega</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button type="button" className="w-10 h-10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined">notifications_none</span>
                </button>
                <button type="button" className="w-10 h-10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined">account_circle</span>
                </button>
              </div>
            </div>
          </header>

          <main className="p-4 space-y-6">
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-widest border ${statusChip}`}>{statusLabel}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">ID: #{String(delivery.id).slice(0, 6)}</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-primary-500">
                  <span className="material-symbols-outlined">calendar_today</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Data da Entrega</p>
                  <p className="font-semibold">{detailDate}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
                  <span className="material-symbols-outlined">person</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Responsável</p>
                  <p className="font-semibold">{delivery.responsible_name || 'Não informado'}</p>
                </div>
              </div>
            </div>

            {isSent && (
              <section className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Link de Conferência</h2>
                  <button
                    type="button"
                    onClick={() => handleCopyConferenceLink(delivery)}
                    className="text-xs font-semibold text-primary-600 dark:text-primary-400"
                  >
                    Copiar
                  </button>
                </div>
                <input
                  readOnly
                  value={conferenceLink}
                  onFocus={(e) => e.currentTarget.select()}
                  className="input rounded-xl font-mono text-xs"
                  placeholder="Gerando link..."
                />
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Itens da Entrega</h2>
                <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">{itemCount} Item{itemCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-700/50">
                {(delivery.items || []).map((item: any) => (
                  <div key={item.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                          <span className="material-symbols-outlined text-slate-400">restaurant</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.supply_name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-medium">Cod: {String(item.supply).slice(0, 6)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-lg text-primary-500">{Number(item.planned_quantity).toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{item.supply_unit || '-'}</p>
                      </div>
                    </div>
                    {renderItemLots(item)}
                    {isDraft && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSuggestLotsForItem(delivery.id, item.id)}
                          disabled={lotSuggestionLoadingByItem[item.id]}
                          className="text-xs font-semibold text-primary-600 dark:text-primary-400 disabled:opacity-50"
                        >
                          {lotSuggestionLoadingByItem[item.id] ? 'Regerando FEFO...' : 'Regerar FEFO'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 px-1">Observações</h2>
              <div className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center italic text-slate-400 dark:text-slate-500 text-sm">
                {delivery.notes || 'Sem observações para esta entrega.'}
              </div>
            </section>

            {isConferred && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 px-1">Autenticação</h2>
                <button
                  type="button"
                  onClick={() => {
                    if (!delivery.conference_signature) return;
                    setSignaturePreview({
                      image: delivery.conference_signature,
                      title: delivery.school_name,
                      submittedAt: delivery.conference_submitted_at,
                      signedBy: delivery.conference_signed_by,
                    });
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">draw</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Ver Assinatura Digital</p>
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">Assinado digitalmente</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-lg">chevron_right</span>
                </button>
              </section>
            )}
          </main>

          {isDraft ? (
            <footer className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 pb-8 space-y-3 z-50 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
              <button
                type="button"
                onClick={() => handleSend(delivery.id)}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                Confirmar Entrega
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => startEditDelivery(delivery)}
                  className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all"
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDelivery(delivery.id)}
                  className="flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all border border-red-100 dark:border-red-900/50"
                >
                  <span className="material-symbols-outlined text-lg">delete_outline</span>
                  Excluir
                </button>
              </div>
            </footer>
          ) : (
            <footer className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 pb-8 space-y-3 z-50 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
              <div className={`grid gap-3 ${isSent ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all"
                >
                  <span className="material-symbols-outlined text-lg">print</span>
                  Imprimir
                </button>
                {isSent && (
                  <button
                    type="button"
                    onClick={() => handleCopyConferenceLink(delivery)}
                    className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all border border-slate-200 dark:border-slate-700"
                  >
                    <span className="material-symbols-outlined text-lg">content_copy</span>
                    Copiar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleShareDelivery(delivery)}
                  className="flex items-center justify-center gap-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all border border-primary-100 dark:border-primary-900/50"
                >
                  <span className="material-symbols-outlined text-lg">share</span>
                  Compartilhar
                </button>
              </div>
            </footer>
          )}
        </div>

        <div className="hidden lg:block px-8 py-8 max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setSelectedDelivery(null)}
                className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-all"
              >
                <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">{delivery.school_name}</h1>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1 inline-block">Detalhes da Entrega</span>
              </div>
            </div>
            <div className="text-right">
              <span className={`px-3 py-1 rounded-full border text-xs font-bold tracking-wider uppercase ${statusChip}`}>{statusLabel}</span>
              <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase">ID: #{String(delivery.id).slice(0, 6)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 dark:bg-slate-700 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-8 shadow-sm">
            <div className="bg-white dark:bg-slate-900 p-6 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data da Entrega</span>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="material-symbols-outlined text-primary-500 text-[20px]">calendar_today</span>
                <span className="font-semibold">{detailDate}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Responsável</span>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="material-symbols-outlined text-primary-500 text-[20px]">person_outline</span>
                <span className="font-semibold">{delivery.responsible_name || 'Não informado'}</span>
              </div>
            </div>
          </div>

          {isSent && (
            <div className="mb-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Link de Conferência</h3>
                <button
                  type="button"
                  onClick={() => handleCopyConferenceLink(delivery)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400"
                >
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  Copiar
                </button>
              </div>
              <input
                readOnly
                value={conferenceLink}
                onFocus={(e) => e.currentTarget.select()}
                className="input rounded-xl font-mono text-xs"
                placeholder="Gerando link..."
              />
            </div>
          )}

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Itens da Entrega
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold">{itemCount} ITENS</span>
              </h3>
              {isDraft && (
                <button
                  type="button"
                  onClick={() => handleSuggestLotsForAllItems(delivery)}
                  disabled={suggestingAllLots}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-primary-200 dark:border-primary-900/50 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                  {suggestingAllLots ? 'Sugerindo FEFO...' : 'Sugerir lotes FEFO (todos)'}
                </button>
              )}
            </div>
            <div className="overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Qtd.</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Unid.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(delivery.items || []).map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors align-top">
                      <td className="px-6 py-5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{item.supply_name}</p>
                        <p className="text-[11px] text-slate-400 font-medium">Cod: {String(item.supply).slice(0, 6)}</p>
                        {renderItemLots(item)}
                        {isDraft && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => handleSuggestLotsForItem(delivery.id, item.id)}
                              disabled={lotSuggestionLoadingByItem[item.id]}
                              className="text-xs font-semibold text-primary-600 dark:text-primary-400 disabled:opacity-50"
                            >
                              {lotSuggestionLoadingByItem[item.id] ? 'Regerando FEFO...' : 'Regerar FEFO'}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right font-bold text-slate-700 dark:text-slate-300">{Number(item.planned_quantity).toFixed(2)}</td>
                      <td className="px-6 py-5 text-right text-slate-500 dark:text-slate-400 font-medium uppercase">{item.supply_unit || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4">Observações</h3>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 italic text-slate-400 dark:text-slate-500 text-sm">
              {delivery.notes || 'Sem observações para esta entrega.'}
            </div>
          </div>

          {isConferred && (
            <div className="mb-8">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4">Autenticação</h3>
              <button
                type="button"
                onClick={() => {
                  if (!delivery.conference_signature) return;
                  setSignaturePreview({
                    image: delivery.conference_signature,
                    title: delivery.school_name,
                    submittedAt: delivery.conference_submitted_at,
                    signedBy: delivery.conference_signed_by,
                  });
                }}
                className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">draw</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Ver Assinatura Digital</p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">Assinado digitalmente pelo receptor</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-400 text-lg">chevron_right</span>
              </button>
            </div>
          )}

          {isDraft ? (
            <div className="flex flex-col gap-4 sticky bottom-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl">
              <button
                type="button"
                onClick={() => handleSend(delivery.id)}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-4 px-6 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
              >
                Confirmar Entrega
              </button>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => startEditDelivery(delivery)}
                  className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3.5 px-4 rounded-2xl transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDelivery(delivery.id)}
                  className="flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-bold py-3.5 px-4 rounded-2xl transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[18px]">delete_outline</span>
                  Excluir
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sticky bottom-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl">
              <div className={`grid gap-4 ${isSent ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3.5 px-4 rounded-2xl transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  Imprimir
                </button>
                {isSent && (
                  <button
                    type="button"
                    onClick={() => handleCopyConferenceLink(delivery)}
                    className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3.5 px-4 rounded-2xl transition-all active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    Copiar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleShareDelivery(delivery)}
                  className="flex items-center justify-center gap-2 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-bold py-3.5 px-4 rounded-2xl transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[18px]">share</span>
                  Compartilhar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1">
      {error && (
        <div className="mx-4 lg:mx-6 mt-4 p-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 text-danger-600 text-sm flex items-center gap-2 animate-fade-in z-50">
          <span className="material-symbols-outlined">error</span>
          {error}
          <button onClick={() => setError('')} className="ml-auto"><span className="material-symbols-outlined text-lg">close</span></button>
        </div>
      )}
      {success && (
        <div className="mx-4 lg:mx-6 mt-4 p-4 rounded-xl bg-success-50 dark:bg-success-900/20 text-success-600 text-sm flex items-center gap-2 animate-fade-in z-50">
          <span className="material-symbols-outlined">check_circle</span>
          {success}
          <button onClick={() => setSuccess('')} className="ml-auto"><span className="material-symbols-outlined text-lg">close</span></button>
        </div>
      )}

      {activeTab === 'new' ? renderWizard() : selectedDelivery ? renderDetails() : renderList()}

      {copyModalDelivery && (
        <div className="modal-overlay" onClick={closeCopyModal}>
          <div className="modal-content max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Copiar Entrega</h3>
                <p className="text-sm text-slate-500">
                  Origem: {copyModalDelivery.school_name} • {copyModalDelivery.delivery_date}
                </p>
              </div>
              <button onClick={closeCopyModal} className="btn-ghost">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              Selecione uma ou mais escolas de destino. As novas entregas serão criadas em rascunho.
            </p>

            <div className="max-h-72 overflow-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
              {schools
                .filter((school) => school.id !== copyModalDelivery.school)
                .map((school) => (
                  <label
                    key={school.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <input
                      type="checkbox"
                      checked={copyTargetSchools.includes(school.id)}
                      onChange={() => toggleCopyTargetSchool(school.id)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-200">{school.name}</span>
                  </label>
                ))}
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={closeCopyModal} className="sm:flex-1 btn-secondary">Cancelar</button>
              <button
                type="button"
                onClick={handleCopyDelivery}
                disabled={copyingDelivery || copyTargetSchools.length === 0}
                className="sm:flex-1 btn-primary disabled:opacity-60"
              >
                {copyingDelivery ? 'Copiando...' : `Copiar para ${copyTargetSchools.length || 0} escola(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

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
