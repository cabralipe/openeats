import React, { useEffect, useMemo, useState } from 'react';
import {
  createSupplierReceipt,
  getSchools,
  getSupplies,
  getSupplierReceipts,
  getSuppliers,
  startSupplierReceiptConference,
  submitSupplierReceiptConference,
} from '../api';

type DraftReceiptItem = {
  supply: string;
  raw_name: string;
  category: string;
  unit: string;
  expected_quantity: string;
};

type ConferenceLot = {
  id: string;
  lot_code: string;
  expiry_date: string;
  manufacture_date: string;
  received_quantity: string;
  note: string;
};

type ConferenceItemForm = {
  received_quantity: string;
  note: string;
  lots: ConferenceLot[];
};

const today = new Date().toISOString().slice(0, 10);

const statusLabel = (status?: string) => {
  if (status === 'DRAFT') return 'Rascunho';
  if (status === 'IN_CONFERENCE') return 'Em conferência';
  if (status === 'CONFERRED') return 'Conferido';
  if (status === 'CANCELLED') return 'Cancelado';
  return status || '-';
};

const statusChip = (status?: string) => {
  if (status === 'CONFERRED') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
  if (status === 'IN_CONFERENCE') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
  if (status === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
  return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
};

const createTextSignature = (name: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 700;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'italic 42px serif';
  ctx.fillText(name, 24, 95);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(24, 120);
  ctx.lineTo(canvas.width - 24, 120);
  ctx.stroke();
  return canvas.toDataURL('image/png');
};

const SupplierReceipts: React.FC = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [expectedDate, setExpectedDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [draftItems, setDraftItems] = useState<DraftReceiptItem[]>([
    { supply: '', raw_name: '', category: 'Outros', unit: 'kg', expected_quantity: '' },
  ]);

  const [conferenceForm, setConferenceForm] = useState<Record<string, ConferenceItemForm>>({});
  const [senderName, setSenderName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    const [suppliersRes, schoolsRes, suppliesRes, receiptsRes] = await Promise.allSettled([
      getSuppliers({ is_active: true }),
      getSchools({ is_active: true }),
      getSupplies({ is_active: true }),
      getSupplierReceipts(filterStatus ? { status: filterStatus } : undefined),
    ]);

    if (suppliersRes.status === 'fulfilled') {
      const data = suppliersRes.value as any[];
      setSuppliers(data);
      if (!supplierId && data.length) setSupplierId(data[0].id);
    }
    if (schoolsRes.status === 'fulfilled') setSchools(schoolsRes.value as any[]);
    if (suppliesRes.status === 'fulfilled') setSupplies(suppliesRes.value as any[]);
    if (receiptsRes.status === 'fulfilled') {
      const data = receiptsRes.value as any[];
      setReceipts(data);
      if (selectedReceipt) {
        const updated = data.find((r) => r.id === selectedReceipt.id);
        if (updated) {
          setSelectedReceipt(updated);
          initializeConferenceForm(updated);
        }
      }
    }

    const failed: string[] = [];
    if (suppliersRes.status === 'rejected') failed.push('fornecedores');
    if (schoolsRes.status === 'rejected') failed.push('escolas');
    if (suppliesRes.status === 'rejected') failed.push('insumos');
    if (receiptsRes.status === 'rejected') failed.push('recebimentos');
    if (failed.length) setError(`Não foi possível carregar: ${failed.join(', ')}.`);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const initializeConferenceForm = (receipt: any) => {
    const next: Record<string, ConferenceItemForm> = {};
    (receipt.items || []).forEach((item: any) => {
      next[item.id] = {
        received_quantity: String(item.received_quantity ?? item.expected_quantity ?? ''),
        note: item.divergence_note || '',
        lots: [],
      };
    });
    setConferenceForm(next);
    setSenderName(receipt.sender_signed_by || '');
    setReceiverName(receipt.receiver_signed_by || '');
  };

  const totalDraftQty = useMemo(
    () => draftItems.reduce((sum, item) => sum + (Number(item.expected_quantity) || 0), 0),
    [draftItems],
  );

  const filteredReceipts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((receipt) => {
      const supplier = String(receipt.supplier_name || '').toLowerCase();
      const school = String(receipt.school_name || 'estoque central').toLowerCase();
      return supplier.includes(q) || school.includes(q);
    });
  }, [receipts, searchQuery]);

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const [y, m, d] = value.split('-');
    if (!y || !m || !d) return value;
    return `${d}/${m}/${y}`;
  };

  const addDraftItem = () => {
    setDraftItems((prev) => [...prev, { supply: '', raw_name: '', category: 'Outros', unit: 'kg', expected_quantity: '' }]);
  };

  const updateDraftItem = (index: number, patch: Partial<DraftReceiptItem>) => {
    setDraftItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeDraftItem = (index: number) => {
    setDraftItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleCreateReceipt = async () => {
    setError('');
    setSuccess('');
    if (!supplierId) {
      setError('Selecione um fornecedor.');
      return;
    }
    const validItems = draftItems.filter((item) => Number(item.expected_quantity) > 0 && (item.supply || item.raw_name.trim()));
    if (!validItems.length) {
      setError('Adicione ao menos um item válido no recebimento.');
      return;
    }

    setSubmitting(true);
    try {
      await createSupplierReceipt({
        supplier: supplierId,
        school: schoolId || null,
        expected_date: expectedDate,
        notes,
        items: validItems.map((item) => ({
          supply: item.supply || null,
          raw_name: item.supply ? undefined : item.raw_name.trim(),
          category: item.supply ? undefined : (item.category || 'Outros'),
          unit: item.unit,
          expected_quantity: Number(item.expected_quantity),
        })),
      });
      setSuccess('Recebimento criado.');
      setNotes('');
      setDraftItems([{ supply: '', raw_name: '', category: 'Outros', unit: 'kg', expected_quantity: '' }]);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar o recebimento.');
    } finally {
      setSubmitting(false);
    }
  };

  const openConference = async (receipt: any) => {
    setError('');
    try {
      const started = receipt.status === 'DRAFT' ? await startSupplierReceiptConference(receipt.id) : receipt;
      setSelectedReceipt(started);
      initializeConferenceForm(started);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível iniciar a conferência.');
    }
  };

  const updateConferenceItem = (itemId: string, patch: Partial<ConferenceItemForm>) => {
    setConferenceForm((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  };

  const addLot = (itemId: string) => {
    setConferenceForm((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        lots: [
          ...(prev[itemId]?.lots || []),
          {
            id: crypto.randomUUID(),
            lot_code: '',
            expiry_date: '',
            manufacture_date: '',
            received_quantity: '',
            note: '',
          },
        ],
      },
    }));
  };

  const updateLot = (itemId: string, lotId: string, field: keyof ConferenceLot, value: string) => {
    setConferenceForm((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        lots: (prev[itemId]?.lots || []).map((lot) => (lot.id === lotId ? { ...lot, [field]: value } : lot)),
      },
    }));
  };

  const removeLot = (itemId: string, lotId: string) => {
    setConferenceForm((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        lots: (prev[itemId]?.lots || []).filter((lot) => lot.id !== lotId),
      },
    }));
  };

  const handleSubmitConference = async () => {
    if (!selectedReceipt) return;
    setError('');
    setSuccess('');

    if (!senderName.trim() || !receiverName.trim()) {
      setError('Informe o nome do entregador e do recebedor.');
      return;
    }

    const itemsPayload = (selectedReceipt.items || []).map((item: any) => {
      const entry = conferenceForm[item.id];
      const receivedQty = Number(entry?.received_quantity || 0);
      const lots = (entry?.lots || [])
        .filter((lot) => lot.lot_code.trim() || Number(lot.received_quantity) > 0 || lot.expiry_date)
        .map((lot) => ({
          lot_code: lot.lot_code.trim(),
          expiry_date: lot.expiry_date,
          manufacture_date: lot.manufacture_date || null,
          received_quantity: Number(lot.received_quantity || 0),
          note: lot.note || '',
        }));

      if (lots.length) {
        const invalidLot = lots.find((lot) => !lot.lot_code || !lot.expiry_date || !(lot.received_quantity >= 0));
        if (invalidLot) {
          throw new Error(`Preencha lote/código/validade/quantidade corretamente no item ${item.supply_name || item.raw_name}.`);
        }
        const sumLots = lots.reduce((sum, lot) => sum + lot.received_quantity, 0);
        if (Math.abs(sumLots - receivedQty) > 0.0001) {
          throw new Error(`A soma dos lotes deve ser igual ao recebido no item ${item.supply_name || item.raw_name}.`);
        }
      }

      return {
        item_id: item.id,
        received_quantity: receivedQty,
        note: entry?.note || '',
        lots: lots.length ? lots : undefined,
      };
    });

    setSubmitting(true);
    try {
      const senderSig = createTextSignature(senderName.trim());
      const receiverSig = createTextSignature(receiverName.trim());
      const updated = await submitSupplierReceiptConference(selectedReceipt.id, {
        items: itemsPayload,
        sender_signature_data: senderSig,
        sender_signer_name: senderName.trim(),
        receiver_signature_data: receiverSig,
        receiver_signer_name: receiverName.trim(),
      });
      setSelectedReceipt(updated);
      initializeConferenceForm(updated);
      setSuccess('Conferência do recebimento concluída com lotes.');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível concluir a conferência.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-full bg-background-light dark:bg-background-dark">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 px-4 lg:px-8 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Recebimentos</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie a entrada de insumos e conferência de lotes</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <span className="material-icons-outlined text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 text-[20px]">search</span>
              <input
                className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary w-full sm:w-64"
                placeholder="Buscar por fornecedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                type="text"
              />
            </div>
            <select className="input rounded-lg text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="DRAFT">Rascunho</option>
              <option value="IN_CONFERENCE">Em conferência</option>
              <option value="CONFERRED">Conferido</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
            <button className="btn-secondary" onClick={loadData}>Atualizar</button>
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-8 max-w-6xl mx-auto w-full space-y-8">
        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-4 flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
            <span className="material-icons-outlined">check_circle</span>
            <p className="text-sm font-medium">{success}</p>
            <button type="button" className="ml-auto text-emerald-400 hover:text-emerald-600" onClick={() => setSuccess('')}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
        )}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4 flex items-center gap-3 text-red-700 dark:text-red-400">
            <span className="material-icons-outlined">error</span>
            <p className="text-sm font-medium">{error}</p>
            <button type="button" className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError('')}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
        )}

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <span className="material-icons-outlined">add_box</span>
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Novo Recebimento</h3>
            </div>
            <span className="text-xs font-medium text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
              {draftItems.length} item(ns) selecionado(s)
            </span>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fornecedor</label>
                <select className="input rounded-lg py-2.5 text-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Selecione</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Destino (Opcional)</label>
                <select className="input rounded-lg py-2.5 text-sm" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                  <option value="">Estoque Central</option>
                  {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data Prevista</label>
                <input className="input rounded-lg py-2 text-sm" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Observações</label>
              <textarea
                className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-primary placeholder:text-slate-400"
                placeholder="Informações adicionais sobre o recebimento..."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Itens do Recebimento</h4>
                <button type="button" onClick={addDraftItem} className="text-primary hover:underline text-xs font-bold flex items-center gap-1">
                  <span className="material-icons-outlined text-sm">add</span> Adicionar Item
                </button>
              </div>
              <div className="space-y-3">
                {draftItems.map((item, index) => (
                  <div key={index} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-12 gap-3 items-start">
                    <div className="col-span-12 md:col-span-6 space-y-2">
                      <select
                        className="input rounded-lg bg-white dark:bg-slate-900 text-sm"
                        value={item.supply}
                        onChange={(e) => {
                          const selected = supplies.find((s) => s.id === e.target.value);
                          updateDraftItem(index, { supply: e.target.value, unit: selected?.unit || item.unit, raw_name: e.target.value ? '' : item.raw_name });
                        }}
                      >
                        <option value="">Item novo (digitar abaixo)</option>
                        {supplies.map((supply) => (
                          <option key={supply.id} value={supply.id}>{supply.name}</option>
                        ))}
                      </select>
                      {!item.supply && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input className="input rounded-lg bg-white dark:bg-slate-900 text-sm" placeholder="Nome do item" value={item.raw_name} onChange={(e) => updateDraftItem(index, { raw_name: e.target.value })} />
                          <input className="input rounded-lg bg-white dark:bg-slate-900 text-sm" placeholder="Categoria" value={item.category} onChange={(e) => updateDraftItem(index, { category: e.target.value })} />
                        </div>
                      )}
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <input className="input rounded-lg bg-white dark:bg-slate-900 text-sm" placeholder="Qtd" type="number" min="0" step="0.01" value={item.expected_quantity} onChange={(e) => updateDraftItem(index, { expected_quantity: e.target.value })} />
                    </div>
                    <div className="col-span-4 md:col-span-3">
                      <input className="input rounded-lg bg-white dark:bg-slate-900 text-sm" placeholder="Unidade" type="text" value={item.unit} onChange={(e) => updateDraftItem(index, { unit: e.target.value })} />
                    </div>
                    <div className="col-span-2 md:col-span-1 flex justify-center pt-1">
                      <button type="button" className="text-slate-400 hover:text-red-500 transition-colors" onClick={() => removeDraftItem(index)}>
                        <span className="material-icons-outlined">delete_outline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-sm text-slate-500 dark:text-slate-400">Total previsto:</span>
              <span className="text-xl font-bold ml-2 text-slate-900 dark:text-white">{totalDraftQty.toFixed(2)} <span className="text-sm font-normal text-slate-400">unidades (misto)</span></span>
            </div>
            <button disabled={submitting} onClick={handleCreateReceipt} className="bg-primary hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-bold transition-all shadow-md shadow-primary/20 disabled:opacity-60">
              {submitting ? 'Salvando...' : 'Criar Recebimento'}
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600">
                <span className="material-icons-outlined">history</span>
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Histórico de Recebimentos</h3>
            </div>
            <div className="flex gap-2">
              <button className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Ver todos</button>
              <button onClick={loadData} className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">Atualizar</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Fornecedor / Destino</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Data Prevista</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Itens</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td className="px-6 py-6 text-sm text-slate-500" colSpan={5}>Carregando...</td></tr>
                ) : filteredReceipts.length === 0 ? (
                  <tr><td className="px-6 py-6 text-sm text-slate-500" colSpan={5}>Nenhum recebimento encontrado.</td></tr>
                ) : (
                  filteredReceipts.map((receipt) => (
                    <tr
                      key={receipt.id}
                      onClick={() => { setSelectedReceipt(receipt); initializeConferenceForm(receipt); }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{receipt.supplier_name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <span className="material-icons-outlined text-[14px]">location_on</span> {receipt.school_name || 'Estoque Central'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{formatDate(receipt.expected_date)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{receipt.items?.length || 0} un</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusChip(receipt.status).replace('border ', '').replace(' border-', ' ')}`}>
                          {statusLabel(receipt.status).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="material-icons-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedReceipt && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Conferência de Recebimento</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{selectedReceipt.supplier_name}</span> • {formatDate(selectedReceipt.expected_date)} • {selectedReceipt.school_name || 'Estoque Central'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wide ${statusChip(selectedReceipt.status).replace('border ', '').replace(' border-', ' ')}`}>
                  {statusLabel(selectedReceipt.status)}
                </span>
                {selectedReceipt.status !== 'CONFERRED' && (
                  <button className="bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-800 px-4 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity" onClick={() => openConference(selectedReceipt)}>
                    Iniciar Conferência
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 space-y-8">
              {(selectedReceipt.items || []).map((item: any) => {
                const entry = conferenceForm[item.id] || { received_quantity: '', note: '', lots: [] };
                const lotSum = (entry.lots || []).reduce((sum, lot) => sum + (Number(lot.received_quantity) || 0), 0);
                const lotMatches = Math.abs(lotSum - Number(entry.received_quantity || 0)) <= 0.0001;
                return (
                  <div key={item.id} className="p-6 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/30 dark:bg-slate-800/10">
                    <div className="flex flex-col lg:flex-row justify-between items-start mb-6 gap-4">
                      <div>
                        <h4 className="text-xl font-bold text-slate-900 dark:text-white">{item.supply_name || item.raw_name}</h4>
                        <p className="text-sm text-slate-500 mt-1">
                          Previsto: <span className="font-bold">{Number(item.expected_quantity || 0).toFixed(2)} {item.unit}</span>
                          {item.supply ? '' : ' • Item novo (será cadastrado se não existir)'}
                        </p>
                      </div>
                      <div className="w-full lg:w-48">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Peso Real Recebido</label>
                        <input
                          className="w-full text-right text-lg font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg focus:ring-primary"
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.received_quantity}
                          onChange={(e) => updateConferenceItem(item.id, { received_quantity: e.target.value })}
                          disabled={selectedReceipt.status === 'CONFERRED'}
                        />
                      </div>
                    </div>

                    <input
                      className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg text-sm mb-6 focus:ring-primary"
                      placeholder="Observação do item (opcional)"
                      type="text"
                      value={entry.note}
                      onChange={(e) => updateConferenceItem(item.id, { note: e.target.value })}
                      disabled={selectedReceipt.status === 'CONFERRED'}
                    />

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Lotes do Item</h5>
                        {selectedReceipt.status !== 'CONFERRED' && (
                          <button type="button" onClick={() => addLot(item.id)} className="text-primary hover:underline text-xs font-bold flex items-center gap-1">
                            <span className="material-icons-outlined text-sm">add</span> Adicionar Lote
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {(entry.lots || []).map((lot) => (
                          <div key={lot.id} className="grid grid-cols-12 gap-3">
                            <input className="col-span-12 md:col-span-2 input rounded-lg bg-white dark:bg-slate-900 py-2 text-sm" placeholder="Código" type="text" value={lot.lot_code} onChange={(e) => updateLot(item.id, lot.id, 'lot_code', e.target.value)} disabled={selectedReceipt.status === 'CONFERRED'} />
                            <input className="col-span-12 md:col-span-3 input rounded-lg bg-white dark:bg-slate-900 py-2 text-sm" placeholder="Fab." type="date" value={lot.manufacture_date} onChange={(e) => updateLot(item.id, lot.id, 'manufacture_date', e.target.value)} disabled={selectedReceipt.status === 'CONFERRED'} />
                            <input className="col-span-12 md:col-span-3 input rounded-lg bg-white dark:bg-slate-900 py-2 text-sm" placeholder="Val." type="date" value={lot.expiry_date} onChange={(e) => updateLot(item.id, lot.id, 'expiry_date', e.target.value)} disabled={selectedReceipt.status === 'CONFERRED'} />
                            <input className="col-span-6 md:col-span-1 input rounded-lg bg-white dark:bg-slate-900 py-2 text-sm text-center" placeholder="Qtd" type="number" step="0.01" min="0" value={lot.received_quantity} onChange={(e) => updateLot(item.id, lot.id, 'received_quantity', e.target.value)} disabled={selectedReceipt.status === 'CONFERRED'} />
                            <input className="col-span-5 md:col-span-2 input rounded-lg bg-white dark:bg-slate-900 py-2 text-sm" placeholder="Obs do lote" type="text" value={lot.note} onChange={(e) => updateLot(item.id, lot.id, 'note', e.target.value)} disabled={selectedReceipt.status === 'CONFERRED'} />
                            <button type="button" className="col-span-1 text-red-400 hover:text-red-500 text-xs font-bold flex items-center justify-center disabled:opacity-40" disabled={selectedReceipt.status === 'CONFERRED'} onClick={() => removeLot(item.id, lot.id)}>
                              <span className="material-icons-outlined text-lg">delete_outline</span>
                            </button>
                          </div>
                        ))}
                        {(entry.lots || []).length === 0 && (
                          <div className="text-xs text-slate-400 italic">Sem lotes cadastrados (modo compatível). Adicione lote(s) para rastreabilidade.</div>
                        )}
                      </div>

                      <div className={`text-[10px] ${lotMatches || (entry.lots || []).length === 0 ? 'text-slate-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        Soma dos lotes: {lotSum.toFixed(2)} {item.unit}
                        {(entry.lots || []).length > 0 && !lotMatches ? ` • Divergente do total do item (${Number(entry.received_quantity || 0).toFixed(2)} ${item.unit})` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}

              {selectedReceipt.status !== 'CONFERRED' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 dark:border-slate-800 pt-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Entregador (Assinatura)</label>
                      <input className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg py-3 text-sm focus:ring-primary" placeholder="Nome completo do entregador" type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Recebedor (Assinatura)</label>
                      <input className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg py-3 text-sm focus:ring-primary" placeholder="Nome completo do recebedor" type="text" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl flex items-start gap-3">
                    <span className="material-icons-outlined text-primary text-sm mt-0.5">info</span>
                    <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed italic">
                      A assinatura digital é gerada automaticamente a partir do nome informado (modo administrativo rápido). Certifique-se de que os dados conferem com o romaneio de entrega físico.
                    </p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button disabled={submitting} onClick={handleSubmitConference} className="bg-primary hover:bg-blue-700 text-white px-10 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/30 flex items-center gap-2 disabled:opacity-60">
                      <span>{submitting ? 'Conferindo...' : 'Concluir Conferência'}</span>
                      <span className="material-icons-outlined">task_alt</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </div>

      <footer className="px-4 lg:px-8 py-6 text-center text-slate-400 dark:text-slate-500 text-xs border-t border-slate-200 dark:border-slate-800 mt-auto">
        © 2026 NutriSemed - Sistema de Gestão Nutricional Escolar. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default SupplierReceipts;
