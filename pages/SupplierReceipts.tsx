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
    <div className="flex flex-col flex-1 p-4 lg:p-6 gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Recebimentos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cadastro de recebimento e conferência com registro de lotes por item.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input rounded-xl" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="DRAFT">Rascunho</option>
            <option value="IN_CONFERENCE">Em conferência</option>
            <option value="CONFERRED">Conferido</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
          <button className="btn-secondary" onClick={loadData}>Atualizar</button>
        </div>
      </div>

      {(error || success) && (
        <div className="space-y-2">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}
          {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm">{success}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 dark:text-slate-100">Novo Recebimento</h2>
            <span className="text-xs text-slate-400">{draftItems.length} item(ns)</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Fornecedor</label>
              <select className="input rounded-xl" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Selecione</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Destino (opcional)</label>
              <select className="input rounded-xl" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                <option value="">Estoque Central</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Data prevista</label>
              <input type="date" className="input rounded-xl" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Observações</label>
              <textarea className="input rounded-xl min-h-[72px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Itens previstos</h3>
              <button type="button" className="text-sm font-semibold text-primary-600" onClick={addDraftItem}>+ Adicionar</button>
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {draftItems.map((item, index) => (
                <div key={index} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      className="input rounded-lg flex-1"
                      value={item.supply}
                      onChange={(e) => {
                        const selected = supplies.find((s) => s.id === e.target.value);
                        updateDraftItem(index, {
                          supply: e.target.value,
                          unit: selected?.unit || item.unit,
                          raw_name: e.target.value ? '' : item.raw_name,
                        });
                      }}
                    >
                      <option value="">Item novo (digitar abaixo)</option>
                      {supplies.map((supply) => (
                        <option key={supply.id} value={supply.id}>{supply.name}</option>
                      ))}
                    </select>
                    <button type="button" className="text-slate-400 hover:text-red-500" onClick={() => removeDraftItem(index)}>
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>

                  {!item.supply && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input className="input rounded-lg" placeholder="Nome do item" value={item.raw_name} onChange={(e) => updateDraftItem(index, { raw_name: e.target.value })} />
                      <input className="input rounded-lg" placeholder="Categoria" value={item.category} onChange={(e) => updateDraftItem(index, { category: e.target.value })} />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input rounded-lg"
                      placeholder="Qtd prevista"
                      value={item.expected_quantity}
                      onChange={(e) => updateDraftItem(index, { expected_quantity: e.target.value })}
                    />
                    <input className="input rounded-lg" placeholder="Unidade" value={item.unit} onChange={(e) => updateDraftItem(index, { unit: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Total previsto</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{totalDraftQty.toFixed(2)}</span>
            </div>
            <button disabled={submitting} className="btn-primary w-full" onClick={handleCreateReceipt}>
              {submitting ? 'Salvando...' : 'Criar Recebimento'}
            </button>
          </div>
        </section>

        <section className="xl:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Recebimentos</h2>
              <span className="text-xs text-slate-400">{receipts.length} registro(s)</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[520px] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-sm text-slate-500">Carregando...</div>
              ) : receipts.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">Nenhum recebimento encontrado.</div>
              ) : (
                receipts.map((receipt) => (
                  <button
                    key={receipt.id}
                    type="button"
                    onClick={() => {
                      setSelectedReceipt(receipt);
                      initializeConferenceForm(receipt);
                    }}
                    className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selectedReceipt?.id === receipt.id ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{receipt.supplier_name}</p>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${statusChip(receipt.status)}`}>
                            {statusLabel(receipt.status)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {receipt.school_name ? `Destino: ${receipt.school_name}` : 'Destino: Estoque Central'} • {receipt.expected_date}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">{receipt.items?.length || 0} item(ns)</p>
                      </div>
                      <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedReceipt && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Conferência de Recebimento</h3>
                  <p className="text-xs text-slate-500">
                    {selectedReceipt.supplier_name} • {selectedReceipt.expected_date} • {selectedReceipt.school_name || 'Estoque Central'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedReceipt.status !== 'CONFERRED' && (
                    <button className="btn-secondary" onClick={() => openConference(selectedReceipt)}>Iniciar Conferência</button>
                  )}
                  <span className={`px-2 py-1 rounded-lg border text-xs font-bold uppercase ${statusChip(selectedReceipt.status)}`}>
                    {statusLabel(selectedReceipt.status)}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {(selectedReceipt.items || []).map((item: any) => {
                  const entry = conferenceForm[item.id] || { received_quantity: '', note: '', lots: [] };
                  const lotSum = (entry.lots || []).reduce((sum, lot) => sum + (Number(lot.received_quantity) || 0), 0);
                  const hasLots = (entry.lots || []).length > 0;
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{item.supply_name || item.raw_name}</p>
                          <p className="text-xs text-slate-500">
                            Previsto: {item.expected_quantity} {item.unit}
                            {item.supply ? '' : ' • Item novo (será cadastrado se não existir)'}
                          </p>
                        </div>
                        <div className="w-full sm:w-48">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input rounded-lg"
                            value={entry.received_quantity}
                            onChange={(e) => updateConferenceItem(item.id, { received_quantity: e.target.value })}
                            disabled={selectedReceipt.status === 'CONFERRED'}
                          />
                        </div>
                      </div>

                      <input
                        className="input rounded-lg"
                        placeholder="Observação do item (opcional)"
                        value={entry.note}
                        onChange={(e) => updateConferenceItem(item.id, { note: e.target.value })}
                        disabled={selectedReceipt.status === 'CONFERRED'}
                      />

                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Lotes do item</p>
                            <p className="text-xs text-slate-500">
                              {hasLots ? `Soma dos lotes: ${lotSum.toFixed(2)} ${item.unit}` : 'Sem lotes cadastrados (compatibilidade).'}
                            </p>
                          </div>
                          {selectedReceipt.status !== 'CONFERRED' && (
                            <button type="button" className="text-sm font-semibold text-primary-600" onClick={() => addLot(item.id)}>
                              + Lote
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {(entry.lots || []).map((lot) => (
                            <div key={lot.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-white dark:bg-slate-900">
                              <input className="input rounded-lg md:col-span-1" placeholder="Código" value={lot.lot_code} onChange={(e) => updateLot(item.id, lot.id, 'lot_code', e.target.value)} disabled={selectedReceipt.status === 'CONFERRED'} />
                              <input type="date" className="input rounded-lg md:col-span-1" value={lot.expiry_date} onChange={(e) => updateLot(item.id, lot.id, 'expiry_date', e.target.value)} disabled={selectedReceipt.status === 'CONFERRED'} />
                              <input type="date" className="input rounded-lg md:col-span-1" value={lot.manufacture_date} onChange={(e) => updateLot(item.id, lot.id, 'manufacture_date', e.target.value)} disabled={selectedReceipt.status === 'CONFERRED'} />
                              <input type="number" min="0" step="0.01" className="input rounded-lg md:col-span-1" placeholder="Qtd" value={lot.received_quantity} onChange={(e) => updateLot(item.id, lot.id, 'received_quantity', e.target.value)} disabled={selectedReceipt.status === 'CONFERRED'} />
                              <input className="input rounded-lg md:col-span-2" placeholder="Obs. do lote" value={lot.note} onChange={(e) => updateLot(item.id, lot.id, 'note', e.target.value)} disabled={selectedReceipt.status === 'CONFERRED'} />
                              {selectedReceipt.status !== 'CONFERRED' && (
                                <div className="md:col-span-6 flex justify-end">
                                  <button type="button" className="text-xs text-red-600 font-semibold" onClick={() => removeLot(item.id, lot.id)}>
                                    Remover lote
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {selectedReceipt.status !== 'CONFERRED' && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Entregador (assinatura)</label>
                      <input className="input rounded-lg" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Nome do entregador" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Recebedor (assinatura)</label>
                      <input className="input rounded-lg" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Nome do recebedor" />
                    </div>
                    <div className="md:col-span-2 text-xs text-slate-500">
                      A assinatura digital é gerada automaticamente a partir do nome informado (modo administrativo rápido).
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <button className="btn-primary" disabled={submitting} onClick={handleSubmitConference}>
                        {submitting ? 'Conferindo...' : 'Concluir Conferência'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SupplierReceipts;
