import React, { useEffect, useMemo, useState } from 'react';
import {
  createSupplier,
  createSupplierReceipt,
  deleteSupplier,
  deleteSupplierReceipt,
  getSupplyCategories,
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

const formatQtyBR = (value: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);

const decimalInputToNumber = (value: string) => {
  const normalized = String(value || '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const maskDecimalBR = (value: string) => {
  let v = String(value || '').replace(/[^\d,]/g, '');
  const firstComma = v.indexOf(',');
  if (firstComma >= 0) {
    v = v.slice(0, firstComma + 1) + v.slice(firstComma + 1).replace(/,/g, '');
  }
  const [intPart = '', decPart = ''] = v.split(',');
  const cleanInt = intPart.replace(/^0+(?=\d)/, '') || (intPart.startsWith('0') ? '0' : intPart);
  const limitedDec = decPart.slice(0, 2);
  return v.includes(',') ? `${cleanInt},${limitedDec}` : cleanInt;
};

const maskDateBR = (value: string) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 4);
  const p3 = digits.slice(4, 8);
  if (digits.length <= 2) return p1;
  if (digits.length <= 4) return `${p1}/${p2}`;
  return `${p1}/${p2}/${p3}`;
};

const isoToDateBR = (value?: string) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  return value;
};

const dateBRToISO = (value?: string) => {
  const masked = String(value || '').trim();
  if (!masked) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(masked)) return masked;
  const match = masked.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, d, m, y] = match;
  return `${y}-${m}-${d}`;
};

const statusLabel = (status?: string) => {
  if (status === 'DRAFT') return 'Rascunho';
  if (status === 'EXPECTED') return 'Aguardando entrega';
  if (status === 'IN_CONFERENCE') return 'Em conferência';
  if (status === 'CONFERRED') return 'Conferido';
  if (status === 'CANCELLED') return 'Cancelado';
  return status || '-';
};

const statusChip = (status?: string) => {
  if (status === 'CONFERRED') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
  if (status === 'EXPECTED') return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800';
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
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [expectedDate, setExpectedDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [draftItems, setDraftItems] = useState<DraftReceiptItem[]>([]);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState<DraftReceiptItem>({ supply: '', raw_name: '', category: 'Outros', unit: 'kg', expected_quantity: '' });

  const [conferenceForm, setConferenceForm] = useState<Record<string, ConferenceItemForm>>({});
  const [senderName, setSenderName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    document: '',
    contact_name: '',
    phone: '',
    email: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    const [suppliersRes, schoolsRes, suppliesRes, receiptsRes, categoriesRes] = await Promise.allSettled([
      getSuppliers({ is_active: true }),
      getSchools({ is_active: true }),
      getSupplies({ is_active: true }),
      getSupplierReceipts(filterStatus ? { status: filterStatus } : undefined),
      getSupplyCategories(),
    ]);

    if (suppliersRes.status === 'fulfilled') {
      const data = suppliersRes.value as any[];
      setSuppliers(data);
      if (data.length) {
        const stillExists = data.some((item) => item.id === supplierId);
        if (!supplierId || !stillExists) setSupplierId(data[0].id);
      } else {
        setSupplierId('');
      }
    }
    if (schoolsRes.status === 'fulfilled') setSchools(schoolsRes.value as any[]);
    if (suppliesRes.status === 'fulfilled') setSupplies(suppliesRes.value as any[]);
    if (categoriesRes.status === 'fulfilled') {
      const categories = (categoriesRes.value as string[]).filter((cat) => String(cat || '').trim());
      setAvailableCategories(Array.from(new Set(categories)).sort());
    }
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
        received_quantity: formatQtyBR(Number(item.received_quantity ?? item.expected_quantity ?? 0)),
        note: item.divergence_note || '',
        lots: [],
      };
    });
    setConferenceForm(next);
    setSenderName(receipt.sender_signed_by || '');
    setReceiverName(receipt.receiver_signed_by || '');
  };

  const totalDraftQty = useMemo(
    () => draftItems.reduce((sum, item) => sum + decimalInputToNumber(item.expected_quantity), 0),
    [draftItems],
  );

  const normalizeSupplyName = (value: string) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

  const findExistingSupplyByName = (rawName: string) => {
    const normalized = normalizeSupplyName(rawName);
    if (!normalized) return null;
    return supplies.find((supply) => normalizeSupplyName(supply.name) === normalized) || null;
  };

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
    return isoToDateBR(value) || value;
  };

  const openAddItemModal = () => {
    setEditingItemIndex(null);
    setItemForm({ supply: '', raw_name: '', category: 'Outros', unit: 'kg', expected_quantity: '' });
    setIsItemModalOpen(true);
  };

  const handleSaveItemForm = () => {
    if (!itemForm.supply && !itemForm.raw_name.trim()) {
      alert('Informe o insumo ou o nome do novo item.');
      return;
    }
    if (!itemForm.supply && !itemForm.category.trim()) {
      alert('Informe a categoria do novo item.');
      return;
    }
    if (editingItemIndex !== null) {
      setDraftItems((prev) => prev.map((item, i) => (i === editingItemIndex ? itemForm : item)));
    } else {
      setDraftItems((prev) => [...prev, itemForm]);
    }
    setIsItemModalOpen(false);
  };

  const removeDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateReceipt = async () => {
    setError('');
    setSuccess('');
    if (!supplierId) {
      setError('Selecione um fornecedor.');
      return;
    }
    const selectedSchool = schools.find((school) => school.id === schoolId);
    const destinationLabel = selectedSchool?.name || 'Estoque Central';
    const validItems = draftItems.filter((item) => decimalInputToNumber(item.expected_quantity) > 0 && (item.supply || item.raw_name.trim()));
    if (!validItems.length) {
      setError('Adicione ao menos um item válido no recebimento.');
      return;
    }
    if (schoolId) {
      const confirmedSchoolDestination = window.confirm(
        `Este recebimento sera lancado diretamente no estoque da escola "${destinationLabel}" e nao no estoque central. Deseja continuar?`,
      );
      if (!confirmedSchoolDestination) return;
    }

    setSubmitting(true);
    try {
      await createSupplierReceipt({
        supplier: supplierId,
        school: schoolId || null,
        expected_date: expectedDate,
        notes,
        items: validItems.map((item) => ({
          supply: (item.supply || findExistingSupplyByName(item.raw_name)?.id) || null,
          raw_name: (item.supply || findExistingSupplyByName(item.raw_name)?.id) ? undefined : item.raw_name.trim(),
          category: (item.supply || findExistingSupplyByName(item.raw_name)?.id) ? undefined : (item.category || 'Outros'),
          unit: item.supply
            ? (supplies.find((s) => s.id === item.supply)?.unit || item.unit)
            : (findExistingSupplyByName(item.raw_name)?.unit || item.unit),
          expected_quantity: decimalInputToNumber(item.expected_quantity),
        })),
      });
      setSuccess(`Recebimento criado com destino: ${destinationLabel}.`);
      setNotes('');
      setDraftItems([]);
      setSchoolId('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar o recebimento.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSupplier = async () => {
    setError('');
    setSuccess('');
    if (!supplierForm.name.trim()) {
      setError('Informe o nome do fornecedor.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createSupplier({
        name: supplierForm.name.trim(),
        document: supplierForm.document.trim() || undefined,
        contact_name: supplierForm.contact_name.trim() || undefined,
        phone: supplierForm.phone.trim() || undefined,
        email: supplierForm.email.trim() || undefined,
        is_active: true,
      });
      await loadData();
      setSupplierId(created.id);
      setSupplierForm({ name: '', document: '', contact_name: '', phone: '', email: '' });
      setShowSupplierForm(false);
      setSuccess('Fornecedor cadastrado com sucesso.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível cadastrar o fornecedor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplierId) {
      setError('Selecione um fornecedor para excluir.');
      return;
    }
    const supplier = suppliers.find((item) => item.id === supplierId);
    const supplierName = supplier?.name || 'este fornecedor';
    const confirmed = window.confirm(`Excluir ${supplierName}?`);
    if (!confirmed) return;

    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const response = await deleteSupplier(supplierId) as { detail?: string } | undefined;
      await loadData();
      setSuccess(response?.detail || 'Fornecedor excluído com sucesso.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível excluir o fornecedor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReceipt = async (receipt: any) => {
    const confirmed = window.confirm(`Excluir o recebimento de ${receipt.supplier_name} em ${formatDate(receipt.expected_date)}?`);
    if (!confirmed) return;

    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await deleteSupplierReceipt(receipt.id);
      if (selectedReceipt?.id === receipt.id) {
        setSelectedReceipt(null);
      }
      await loadData();
      setSuccess('Recebimento excluído com sucesso.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível excluir o recebimento.');
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
      const receivedQty = decimalInputToNumber(entry?.received_quantity || '');
      const lots = (entry?.lots || [])
        .filter((lot) => lot.lot_code.trim() || decimalInputToNumber(lot.received_quantity) > 0 || lot.expiry_date)
        .map((lot) => ({
          lot_code: lot.lot_code.trim(),
          expiry_date: dateBRToISO(lot.expiry_date),
          manufacture_date: dateBRToISO(lot.manufacture_date) || null,
          received_quantity: decimalInputToNumber(lot.received_quantity),
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
      setSuccess(`Conferência concluída. Entrada registrada em: ${updated?.school_name || 'Estoque Central'}.`);
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
              <span className="material-symbols-outlined text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 text-[20px]">search</span>
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
            <span className="material-symbols-outlined">check_circle</span>
            <p className="text-sm font-medium">{success}</p>
            <button type="button" className="ml-auto text-emerald-400 hover:text-emerald-600" onClick={() => setSuccess('')}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4 flex items-center gap-3 text-red-700 dark:text-red-400">
            <span className="material-symbols-outlined">error</span>
            <p className="text-sm font-medium">{error}</p>
            <button type="button" className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError('')}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <span className="material-symbols-outlined">add_box</span>
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
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fornecedor</label>
                  <div className="flex items-center gap-2">
                    {supplierId && (
                      <button
                        type="button"
                        onClick={handleDeleteSupplier}
                        disabled={submitting}
                        className="text-[11px] font-bold text-red-600 hover:underline disabled:opacity-60 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Excluir
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowSupplierForm((prev) => !prev)}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">{showSupplierForm ? 'close' : 'add'}</span>
                      {showSupplierForm ? 'Fechar' : 'Novo fornecedor'}
                    </button>
                  </div>
                </div>
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
                {!schoolId ? (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    Entrada no Estoque Central (origem das entregas para as escolas).
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    Entrada direta na escola selecionada. Este recebimento nao alimenta o estoque central.
                  </p>
                )}
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
                <button type="button" onClick={openAddItemModal} className="text-primary hover:underline text-xs font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">add</span> Adicionar Item
                </button>
              </div>
              <div className="space-y-3">
                {draftItems.length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-center">Nenhum item adicionado.</div>
                ) : (
                  draftItems.map((item, index) => (
                    <div key={index} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center transition-colors hover:border-primary/30 group">
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          {item.supply ? supplies.find((s) => s.id === item.supply)?.name : item.raw_name || 'Item não identificado'}
                          {!item.supply && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-widest font-bold">Novo</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 font-medium">
                          {item.expected_quantity} <span className="uppercase">{item.unit}</span>
                          {!item.supply && item.category && ` • ${item.category}`}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="text-slate-400 hover:text-primary transition-colors p-2" onClick={() => { setEditingItemIndex(index); setItemForm(item); setIsItemModalOpen(true); }} title="Editar item">
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button type="button" className="text-slate-400 hover:text-red-500 transition-colors p-2" onClick={() => removeDraftItem(index)} title="Excluir item">
                          <span className="material-symbols-outlined text-[20px]">delete_outline</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-sm text-slate-500 dark:text-slate-400">Total previsto:</span>
              <span className="text-xl font-bold ml-2 text-slate-900 dark:text-white">{formatQtyBR(totalDraftQty)} <span className="text-sm font-normal text-slate-400">unidades (misto)</span></span>
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
                <span className="material-symbols-outlined">history</span>
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
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Ações</th>
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
                          <span className="material-symbols-outlined text-[14px]">location_on</span> {receipt.school_name || 'Estoque Central'}
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
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteReceipt(receipt);
                            }}
                            disabled={submitting}
                            className="text-red-500 hover:text-red-600 disabled:opacity-50"
                            title="Excluir recebimento"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete_outline</span>
                          </button>
                          <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                        </div>
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
                const lotSum = (entry.lots || []).reduce((sum, lot) => sum + decimalInputToNumber(lot.received_quantity), 0);
                const lotMatches = Math.abs(lotSum - decimalInputToNumber(entry.received_quantity || '')) <= 0.0001;
                return (
                  <div key={item.id} className="p-6 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/30 dark:bg-slate-800/10">
                    <div className="flex flex-col lg:flex-row justify-between items-start mb-6 gap-4">
                      <div>
                        <h4 className="text-xl font-bold text-slate-900 dark:text-white">{item.supply_name || item.raw_name}</h4>
                        <p className="text-sm text-slate-500 mt-1">
                          Previsto: <span className="font-bold">{formatQtyBR(Number(item.expected_quantity || 0))} {item.unit}</span>
                          {item.supply ? '' : ' • Item novo (será cadastrado se não existir)'}
                        </p>
                      </div>
                      <div className="w-full lg:w-48">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Peso Real Recebido</label>
                        <input
                          className="w-full text-right text-lg font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg focus:ring-primary"
                          type="text"
                          inputMode="decimal"
                          value={entry.received_quantity}
                          onChange={(e) => updateConferenceItem(item.id, { received_quantity: maskDecimalBR(e.target.value) })}
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
                            <span className="material-symbols-outlined text-sm">add</span> Adicionar Lote
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {(entry.lots || []).map((lot) => (
                          <div key={lot.id} className="grid grid-cols-12 gap-3">
                            <input className="col-span-12 md:col-span-2 input rounded-lg bg-white dark:bg-slate-900 py-2 text-sm" placeholder="Código" type="text" value={lot.lot_code} onChange={(e) => updateLot(item.id, lot.id, 'lot_code', e.target.value)} disabled={selectedReceipt.status === 'CONFERRED'} />
                            <input className="col-span-12 md:col-span-3 input rounded-lg bg-white dark:bg-slate-900 py-2 text-sm" placeholder="Fab: dd/mm/aaaa" type="text" inputMode="numeric" value={lot.manufacture_date} onChange={(e) => updateLot(item.id, lot.id, 'manufacture_date', maskDateBR(e.target.value))} disabled={selectedReceipt.status === 'CONFERRED'} />
                            <input className="col-span-12 md:col-span-3 input rounded-lg bg-white dark:bg-slate-900 py-2 text-sm" placeholder="Val: dd/mm/aaaa" type="text" inputMode="numeric" value={lot.expiry_date} onChange={(e) => updateLot(item.id, lot.id, 'expiry_date', maskDateBR(e.target.value))} disabled={selectedReceipt.status === 'CONFERRED'} />
                            <input className="col-span-6 md:col-span-1 input rounded-lg bg-white dark:bg-slate-900 py-2 text-sm text-center" placeholder="Qtd" type="text" inputMode="decimal" value={lot.received_quantity} onChange={(e) => updateLot(item.id, lot.id, 'received_quantity', maskDecimalBR(e.target.value))} disabled={selectedReceipt.status === 'CONFERRED'} />
                            <input className="col-span-5 md:col-span-2 input rounded-lg bg-white dark:bg-slate-900 py-2 text-sm" placeholder="Obs do lote" type="text" value={lot.note} onChange={(e) => updateLot(item.id, lot.id, 'note', e.target.value)} disabled={selectedReceipt.status === 'CONFERRED'} />
                            <button type="button" className="col-span-1 text-red-400 hover:text-red-500 text-xs font-bold flex items-center justify-center disabled:opacity-40" disabled={selectedReceipt.status === 'CONFERRED'} onClick={() => removeLot(item.id, lot.id)}>
                              <span className="material-symbols-outlined text-lg">delete_outline</span>
                            </button>
                          </div>
                        ))}
                        {(entry.lots || []).length === 0 && (
                          <div className="text-xs text-slate-400 italic">Sem lotes cadastrados (modo compatível). Adicione lote(s) para rastreabilidade.</div>
                        )}
                      </div>

                      <div className={`text-[10px] font-medium ${(entry.lots || []).length === 0 ? 'text-slate-400' : lotMatches ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        Soma dos lotes: {formatQtyBR(lotSum)} {item.unit}
                        {(entry.lots || []).length > 0 && !lotMatches ? ` • Divergente do total do item (${formatQtyBR(decimalInputToNumber(entry.received_quantity || ''))} ${item.unit})` : ''}
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
                    <span className="material-symbols-outlined text-primary text-sm mt-0.5">info</span>
                    <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed italic">
                      A assinatura digital é gerada automaticamente a partir do nome informado (modo administrativo rápido). Certifique-se de que os dados conferem com o romaneio de entrega físico.
                    </p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button disabled={submitting} onClick={handleSubmitConference} className="bg-primary hover:bg-blue-700 text-white px-10 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/30 flex items-center gap-2 disabled:opacity-60">
                      <span>{submitting ? 'Conferindo...' : 'Concluir Conferência'}</span>
                      <span className="material-symbols-outlined">task_alt</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </div>

      {isItemModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">{editingItemIndex !== null ? 'edit_square' : 'add_box'}</span>
                {editingItemIndex !== null ? 'Editar Item' : 'Adicionar Item'}
              </h3>
              <button type="button" onClick={() => setIsItemModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Insumo</label>
                <select
                  className="input rounded-lg w-full bg-white dark:bg-slate-900 text-sm py-2.5 focus:ring-2 focus:ring-primary/50"
                  value={itemForm.supply}
                  onChange={(e) => {
                    const selected = supplies.find((s) => s.id === e.target.value);
                    setItemForm((prev) => ({ ...prev, supply: e.target.value, unit: selected?.unit || prev.unit, raw_name: e.target.value ? '' : prev.raw_name }));
                  }}
                >
                  <option value="">+ Cadastrar Novo Insumo</option>
                  {supplies.map((supply) => (
                    <option key={supply.id} value={supply.id}>{supply.name}</option>
                  ))}
                </select>
              </div>

              {!itemForm.supply && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20">
                  <div className="space-y-2 col-span-1 sm:col-span-2">
                    <label className="text-xs font-bold text-primary uppercase tracking-wider">Nome do Novo Item</label>
                    <input
                      className="input rounded-lg w-full bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary/50"
                      placeholder="Ex: Alface Crespa"
                      value={itemForm.raw_name}
                      onChange={(e) => {
                        const rawName = e.target.value;
                        const matched = findExistingSupplyByName(rawName);
                        setItemForm((prev) => ({
                          ...prev,
                          raw_name: rawName,
                          unit: matched?.unit || prev.unit,
                          category: matched?.category || prev.category,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-primary uppercase tracking-wider">Categoria</label>
                    <input
                      className="input rounded-lg w-full bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary/50"
                      placeholder="Ex: Hortifruti"
                      value={itemForm.category}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, category: e.target.value }))}
                      list="receipt-category-options"
                    />
                    <datalist id="receipt-category-options">
                      {availableCategories.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quantidade</label>
                  <input className="input rounded-lg w-full bg-white dark:bg-slate-900 text-sm py-2 focus:ring-2 focus:ring-primary/50" placeholder="0.00" type="text" inputMode="decimal" value={itemForm.expected_quantity} onChange={(e) => setItemForm((prev) => ({ ...prev, expected_quantity: maskDecimalBR(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Unidade</label>
                  <select
                    className="input rounded-lg w-full bg-white dark:bg-slate-900 text-sm py-2 focus:ring-2 focus:ring-primary/50"
                    value={itemForm.unit}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, unit: e.target.value }))}
                  >
                    <option value="kg">Kg</option>
                    <option value="g">g</option>
                    <option value="l">L</option>
                    <option value="ml">ml</option>
                    <option value="unit">Unidade</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
              <button type="button" onClick={() => setIsItemModalOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancelar</button>
              <button type="button" onClick={handleSaveItemForm} className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:bg-blue-700 transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">save</span>
                Salvar Item
              </button>
            </div>
          </div>
        </div>
      )}

      {showSupplierForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_business</span>
                Adicionar Fornecedor
              </h3>
              <button type="button" onClick={() => setShowSupplierForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nome do fornecedor *</label>
                  <input
                    className="input rounded-lg w-full bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary/50"
                    placeholder="Ex: Frutas Frescas Ltda"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Documento (CNPJ/CPF)</label>
                    <input
                      className="input rounded-lg w-full bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary/50"
                      placeholder="00.000.000/0000-00"
                      value={supplierForm.document}
                      onChange={(e) => setSupplierForm((prev) => ({ ...prev, document: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contato responsável</label>
                    <input
                      className="input rounded-lg w-full bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary/50"
                      placeholder="Nome do contato"
                      value={supplierForm.contact_name}
                      onChange={(e) => setSupplierForm((prev) => ({ ...prev, contact_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Telefone</label>
                    <input
                      className="input rounded-lg w-full bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary/50"
                      placeholder="(00) 00000-0000"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">E-mail</label>
                    <input
                      className="input rounded-lg w-full bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary/50"
                      placeholder="email@exemplo.com"
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
              <button type="button" onClick={() => setShowSupplierForm(false)} className="px-5 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancelar</button>
              <button type="button" onClick={handleCreateSupplier} disabled={submitting} className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60">
                <span className="material-symbols-outlined text-sm">save</span>
                {submitting ? 'Salvando...' : 'Salvar Fornecedor'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="px-4 lg:px-8 py-6 text-center text-slate-400 dark:text-slate-500 text-xs border-t border-slate-200 dark:border-slate-800 mt-auto">
        © 2026 NutriSemed - Sistema de Gestão Nutricional Escolar. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default SupplierReceipts;
