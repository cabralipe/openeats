import React, { useEffect, useMemo, useState } from 'react';
import { createStockMovement, createSupply, deleteSupply, exportStockCsv, getCentralLots, getStock, getSupplies, getSupplyCategories, getSupplyLots, updateSupply } from '../api';
import { InventoryItem } from '../types';

const NOVA_OPTIONS = [
  { value: '', label: 'Sem classificação' },
  { value: 'IN_NATURA', label: 'In natura ou minimamente processados' },
  { value: 'CULINARIOS', label: 'Ingredientes culinários processados' },
  { value: 'PROCESSADOS', label: 'Alimentos processados' },
  { value: 'ULTRAPROCESSADOS', label: 'Alimentos ultraprocessados' },
];

const NUTRITIONAL_OPTIONS = [
  { value: '', label: 'Sem classificação' },
  { value: 'CONSTRUTORES', label: 'Alimentos Construtores' },
  { value: 'ENERGETICOS', label: 'Alimentos Energéticos' },
  { value: 'REGULADORES', label: 'Alimentos Reguladores' },
  { value: 'ENERGETICOS_EXTRAS', label: 'Alimentos Energéticos Extras' },
];

const NOVA_TO_NUTRITIONAL: Record<string, string> = {
  IN_NATURA: 'CONSTRUTORES',
  CULINARIOS: 'ENERGETICOS',
  PROCESSADOS: 'REGULADORES',
  ULTRAPROCESSADOS: 'ENERGETICOS_EXTRAS',
};

const PRESET_CATEGORIES = ['Grãos', 'Proteínas', 'Hortifruti', 'Mercearia'];

const NOVA_COLORS: Record<string, string> = {
  IN_NATURA: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  CULINARIOS: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  PROCESSADOS: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  ULTRAPROCESSADOS: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const NUTRITIONAL_COLORS: Record<string, string> = {
  CONSTRUTORES: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  ENERGETICOS: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  REGULADORES: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  ENERGETICOS_EXTRAS: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
};

type CentralLotDestination = {
  school_id: string;
  school_name: string;
  quantity: number;
  last_delivery_date?: string;
};

type CentralLotRow = {
  id: string;
  supply_id: string;
  supply_name: string;
  unit: string;
  lot_code: string;
  status: string;
  expiry_date?: string;
  manufacture_date?: string;
  supplier_name?: string;
  central_quantity: number;
  days_to_expiry?: number | null;
  expiry_state: 'expired' | 'near_expiry' | 'ok' | 'unknown';
  sent_total: number;
  destinations: CentralLotDestination[];
};

const Inventory: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'register' | 'in' | 'out' | 'edit'>('register');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [selectedSupplyId, setSelectedSupplyId] = useState('');
  const [movement, setMovement] = useState({ quantity: '', movement_date: '', note: '' });
  const [supplyForm, setSupplyForm] = useState({
    name: '', category: 'Outros', unit: 'kg', min_stock: '0', is_active: true,
    nova_classification: '', nutritional_function: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'ok'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [lotsModal, setLotsModal] = useState<{ item: InventoryItem; lots: any[] } | null>(null);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [centralLotsModalOpen, setCentralLotsModalOpen] = useState(false);
  const [centralLotsLoading, setCentralLotsLoading] = useState(false);
  const [centralLotsDays, setCentralLotsDays] = useState(30);
  const [centralLotsData, setCentralLotsData] = useState<{ summary?: any; results: CentralLotRow[] }>({ results: [] });
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Merge preset + dynamic categories (deduplicated)
  const allCategories = useMemo(() => {
    const set = new Set([...PRESET_CATEGORIES, ...dynamicCategories]);
    set.delete('');
    set.delete('Outros');
    const sorted = Array.from(set).sort();
    return ['Todos', ...sorted, 'Outros'];
  }, [dynamicCategories]);

  // Categories available for the form dropdown (without 'Todos')
  const formCategories = useMemo(() => {
    const set = new Set([...PRESET_CATEGORIES, ...dynamicCategories]);
    set.delete('');
    const sorted = Array.from(set).sort();
    return [...sorted, 'Outros'];
  }, [dynamicCategories]);

  const loadStock = (
    filters?: { q?: string; category?: string; low_stock?: boolean; is_active?: boolean },
    suppressError = false,
  ) => {
    return getStock(filters)
      .then((data) => {
        const mapped = data.map((entry: any) => {
          const quantity = Number(entry.quantity);
          const minQuantity = Number(entry.supply.min_stock);
          const status = entry.is_low_stock ? 'critical' : 'adequate';
          return {
            id: entry.supply.id,
            name: entry.supply.name,
            category: entry.supply.category,
            unit: entry.supply.unit,
            quantity,
            minQuantity,
            status,
            nova_classification: entry.supply.nova_classification || '',
            nova_classification_display: entry.supply.nova_classification_display || '',
            nutritional_function: entry.supply.nutritional_function || '',
            nutritional_function_display: entry.supply.nutritional_function_display || '',
          } as InventoryItem;
        });
        setItems(mapped);
      })
      .catch(() => {
        if (!suppressError) setError('Não foi possível carregar o estoque.');
      });
  };

  const loadSupplies = (filters?: { q?: string; category?: string; is_active?: boolean }, suppressError = false) => {
    return getSupplies(filters)
      .then((data) => setSupplies(data))
      .catch(() => {
        if (!suppressError) setError('Não foi possível carregar os insumos.');
      });
  };

  const loadCategories = () => {
    return getSupplyCategories()
      .then((cats) => setDynamicCategories(cats))
      .catch(() => { /* ignore */ });
  };

  useEffect(() => {
    let cancelled = false;
    const loadInitialData = async () => {
      setIsLoading(true);
      setError('');
      const [stockRes, suppliesRes] = await Promise.allSettled([
        loadStock({ is_active: true }, true),
        loadSupplies({ is_active: true }, true),
      ]);
      await loadCategories();
      if (cancelled) return;
      const failed: string[] = [];
      if (stockRes.status === 'rejected') failed.push('estoque');
      if (suppliesRes.status === 'rejected') failed.push('insumos');
      if (failed.length) {
        setError(`Não foi possível carregar: ${failed.join(', ')}.`);
      }
      setIsLoading(false);
    };
    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const category = categoryFilter === 'Todos' ? undefined : categoryFilter;
      const low_stock = stockFilter === 'all' ? undefined : stockFilter === 'low';
      loadStock({ q: search, category, low_stock, is_active: true });
      loadSupplies({ q: search, category, is_active: true });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, categoryFilter, stockFilter]);

  useEffect(() => {
    setSelectedItemIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const stats = useMemo(() => {
    const total = items.length;
    const critical = items.filter((item) => item.status === 'critical').length;
    const adequate = total - critical;
    return { total, critical, adequate };
  }, [items]);

  const openModal = (nextMode: 'register' | 'in' | 'out' | 'edit', item?: InventoryItem) => {
    setMode(nextMode);
    setShowModal(true);
    setError('');
    setShowCustomCategory(false);
    setCustomCategoryInput('');
    if (nextMode === 'edit' && item) {
      const supply = supplies.find((entry) => entry.id === item.id);
      setEditingId(item.id);
      const cat = item.category || 'Outros';
      const isCustom = !formCategories.includes(cat) && cat !== 'Outros';
      setSupplyForm({
        name: item.name,
        category: isCustom ? '__custom__' : cat,
        unit: item.unit,
        min_stock: String(item.minQuantity),
        is_active: supply ? supply.is_active : true,
        nova_classification: item.nova_classification || '',
        nutritional_function: item.nutritional_function || '',
      });
      if (isCustom) {
        setShowCustomCategory(true);
        setCustomCategoryInput(cat);
      }
    } else {
      setEditingId(null);
      setSupplyForm({
        name: '', category: 'Outros', unit: 'kg', min_stock: '0', is_active: true,
        nova_classification: '', nutritional_function: '',
      });
      setMovement({ quantity: '', movement_date: new Date().toISOString().slice(0, 10), note: '' });
      setSelectedSupplyId(item?.id || '');
    }
  };

  const handleNovaChange = (value: string) => {
    const suggestedNutritional = NOVA_TO_NUTRITIONAL[value] || '';
    setSupplyForm({
      ...supplyForm,
      nova_classification: value,
      nutritional_function: suggestedNutritional,
    });
  };

  const handleCategorySelectChange = (value: string) => {
    if (value === '__custom__') {
      setShowCustomCategory(true);
      setSupplyForm({ ...supplyForm, category: '__custom__' });
    } else {
      setShowCustomCategory(false);
      setCustomCategoryInput('');
      setSupplyForm({ ...supplyForm, category: value });
    }
  };

  const resolvedCategory = () => {
    if (supplyForm.category === '__custom__') {
      return customCategoryInput.trim() || 'Outros';
    }
    return supplyForm.category || 'Outros';
  };

  const handleSaveSupply = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const payload = {
        name: supplyForm.name,
        category: resolvedCategory(),
        unit: supplyForm.unit,
        min_stock: Number(supplyForm.min_stock),
        is_active: supplyForm.is_active,
        nova_classification: supplyForm.nova_classification,
        nutritional_function: supplyForm.nutritional_function,
      };
      if (mode === 'edit' && editingId) {
        await updateSupply(editingId, payload);
      } else {
        await createSupply(payload);
      }
      const category = categoryFilter === 'Todos' ? undefined : categoryFilter;
      const low_stock = stockFilter === 'all' ? undefined : stockFilter === 'low';
      await loadSupplies({ q: search, category, is_active: true });
      await loadStock({ q: search, category, low_stock, is_active: true });
      await loadCategories();
      setShowModal(false);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar o insumo.');
    }
  };

  const handleMovement = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await createStockMovement({
        supply: selectedSupplyId,
        type: mode === 'in' ? 'IN' : 'OUT',
        quantity: Number(movement.quantity),
        movement_date: movement.movement_date,
        note: movement.note,
      });
      const category = categoryFilter === 'Todos' ? undefined : categoryFilter;
      const low_stock = stockFilter === 'all' ? undefined : stockFilter === 'low';
      await loadStock({ q: search, category, low_stock, is_active: true });
      setShowModal(false);
    } catch {
      setError('Não foi possível registrar a movimentação.');
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!confirm(`Excluir ${item.name}?`)) return;
    try {
      await deleteSupply(item.id);
      const category = categoryFilter === 'Todos' ? undefined : categoryFilter;
      const low_stock = stockFilter === 'all' ? undefined : stockFilter === 'low';
      setSelectedItemIds((prev) => prev.filter((id) => id !== item.id));
      await loadSupplies({ q: search, category, is_active: true });
      await loadStock({ q: search, category, low_stock, is_active: true });
      await loadCategories();
    } catch {
      setError('Não foi possível excluir o insumo.');
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) => (
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    ));
  };

  const isAllSelected = items.length > 0 && selectedItemIds.length === items.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItemIds([]);
      return;
    }
    setSelectedItemIds(items.map((item) => item.id));
  };

  const handleBulkDelete = async () => {
    if (!selectedItemIds.length) return;
    const confirmed = window.confirm(`Excluir ${selectedItemIds.length} item(ns) selecionado(s)?`);
    if (!confirmed) return;

    setError('');
    const results = await Promise.allSettled(selectedItemIds.map((itemId) => deleteSupply(itemId)));
    const failed = results.filter((result) => result.status === 'rejected').length;
    const category = categoryFilter === 'Todos' ? undefined : categoryFilter;
    const low_stock = stockFilter === 'all' ? undefined : stockFilter === 'low';
    await loadSupplies({ q: search, category, is_active: true });
    await loadStock({ q: search, category, low_stock, is_active: true });
    await loadCategories();
    setSelectedItemIds([]);
    if (failed > 0) {
      setError(`${failed} item(ns) não puderam ser excluídos.`);
    }
  };

  const handleOpenLots = async (item: InventoryItem) => {
    setError('');
    setLotsLoading(true);
    try {
      const lots = await getSupplyLots(item.id, { only_available: true });
      setLotsModal({ item, lots: Array.isArray(lots) ? lots : [] });
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os lotes do insumo.');
    } finally {
      setLotsLoading(false);
    }
  };

  const handleOpenCentralLots = async () => {
    setError('');
    setCentralLotsLoading(true);
    setCentralLotsModalOpen(true);
    try {
      const response = await getCentralLots({ days_to_expiry: centralLotsDays });
      setCentralLotsData({
        summary: response?.summary || {},
        results: Array.isArray(response?.results) ? response.results : [],
      });
    } catch (err: any) {
      setError(err?.message || 'Nao foi possivel carregar a central de lotes.');
    } finally {
      setCentralLotsLoading(false);
    }
  };

  const formatDateBr = (value?: string) => {
    if (!value) return '-';
    const [y, m, d] = String(value).split('-');
    return y && m && d ? `${d}/${m}/${y}` : value;
  };

  const lotStatusLabel = (status?: string) => {
    if (status === 'ACTIVE') return 'Ativo';
    if (status === 'EXPIRED') return 'Vencido';
    if (status === 'BLOCKED') return 'Bloqueado';
    if (status === 'DISCARDED') return 'Descartado';
    return status || '-';
  };

  const lotStatusClass = (status?: string) => {
    if (status === 'EXPIRED') return 'bg-danger-100 dark:bg-danger-900/30 text-danger-600';
    if (status === 'BLOCKED') return 'bg-warning-100 dark:bg-warning-900/30 text-warning-600';
    if (status === 'DISCARDED') return 'bg-slate-100 dark:bg-slate-800 text-slate-500';
    return 'bg-success-100 dark:bg-success-900/30 text-success-600';
  };

  const expiryStateLabel = (state?: string) => {
    if (state === 'expired') return 'Vencido';
    if (state === 'near_expiry') return 'Proximo do vencimento';
    if (state === 'ok') return 'Dentro do prazo';
    return 'Sem validade';
  };

  const expiryStateClass = (state?: string) => {
    if (state === 'expired') return 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400';
    if (state === 'near_expiry') return 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400';
    if (state === 'ok') return 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600';
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Grãos': 'grain',
      'Proteínas': 'egg',
      'Hortifruti': 'nutrition',
      'Mercearia': 'grocery',
    };
    return icons[category] || 'inventory_2';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Grãos': 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
      'Proteínas': 'bg-rose-100 dark:bg-rose-900/30 text-rose-600',
      'Hortifruti': 'bg-success-100 dark:bg-success-900/30 text-success-600',
      'Mercearia': 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600',
    };
    return colors[category] || 'bg-slate-100 dark:bg-slate-800 text-slate-600';
  };

  return (
    <div className="flex flex-col flex-1 pb-24 lg:pb-8">
      {/* Stats Header */}
      <div className="p-4 lg:p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Estoque</h1>
          <button onClick={() => exportStockCsv()} className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-lg">download</span>
            Exportar
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total</p>
          </div>
          <div className="card p-4 text-center border-success-200 dark:border-success-900/50">
            <p className="text-2xl lg:text-3xl font-bold text-success-600">{stats.adequate}</p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Adequado</p>
          </div>
          <div className={`card p-4 text-center ${stats.critical > 0 ? 'border-danger-200 dark:border-danger-900/50 bg-danger-50/50 dark:bg-danger-900/10' : ''}`}>
            <p className={`text-2xl lg:text-3xl font-bold ${stats.critical > 0 ? 'text-danger-600' : 'text-slate-900 dark:text-white'}`}>
              {stats.critical}
            </p>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Crítico</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 p-4 overflow-x-auto no-scrollbar">
        <button onClick={handleOpenCentralLots} className="btn-secondary shrink-0">
          <span className="material-symbols-outlined">inventory_2</span>
          Central de Lotes
        </button>
        <button onClick={() => openModal('register')} className="btn-primary shrink-0">
          <span className="material-symbols-outlined">add</span>
          Cadastrar
        </button>
        <button onClick={() => openModal('in')} className="btn-success shrink-0">
          <span className="material-symbols-outlined">login</span>
          Entrada
        </button>
        <button onClick={() => openModal('out')} className="btn shrink-0 bg-warning-500 text-white hover:bg-warning-600">
          <span className="material-symbols-outlined">logout</span>
          Saída
        </button>
      </div>

      {/* Category Tabs */}
      <div className="px-4 lg:px-6">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${categoryFilter === cat
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 lg:px-6 space-y-3">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-with-icon"
            placeholder="Pesquisar insumo..."
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setStockFilter(stockFilter === 'all' ? 'low' : stockFilter === 'low' ? 'ok' : 'all')}
            className={`chip ${stockFilter !== 'all' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : ''}`}
          >
            <span className="material-symbols-outlined text-sm">filter_list</span>
            {stockFilter === 'all' ? 'Todos' : stockFilter === 'low' ? 'Crítico' : 'Adequado'}
          </button>
          <button onClick={toggleSelectAll} className="chip">
            <span className="material-symbols-outlined text-sm">{isAllSelected ? 'check_box' : 'check_box_outline_blank'}</span>
            {isAllSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={selectedItemIds.length === 0}
            className="chip text-danger-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            Excluir ({selectedItemIds.length})
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 lg:mx-6 mb-4 p-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* Inventory List */}
      <div className="flex-1 px-4 lg:px-6 space-y-3">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined text-3xl">inventory_2</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Nenhum insumo encontrado</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">Cadastre seu primeiro insumo para começar</p>
            <button onClick={() => openModal('register')} className="btn-primary">
              <span className="material-symbols-outlined">add</span>
              Cadastrar Insumo
            </button>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              className={`card p-4 flex items-center gap-4 animate-fade-in ${item.status === 'critical' ? 'border-danger-200 dark:border-danger-900/50' : ''
                }`}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <input
                type="checkbox"
                checked={selectedItemIds.includes(item.id)}
                onChange={() => toggleItemSelection(item.id)}
                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 shrink-0"
              />
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.status === 'critical'
                ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-600'
                : getCategoryColor(item.category)
                }`}>
                <span className="material-symbols-outlined">
                  {item.status === 'critical' ? 'warning' : getCategoryIcon(item.category)}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-white truncate">{item.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {item.category} • Min: {item.minQuantity}{item.unit}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className={`badge ${item.status === 'critical' ? 'badge-danger' : 'badge-success'
                    }`}>
                    {item.status === 'critical' ? 'Estoque Baixo' : 'Adequado'}
                  </span>
                  {item.nova_classification_display && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${NOVA_COLORS[item.nova_classification || ''] || 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                      {item.nova_classification_display}
                    </span>
                  )}
                  {item.nutritional_function_display && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${NUTRITIONAL_COLORS[item.nutritional_function || ''] || 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                      {item.nutritional_function_display}
                    </span>
                  )}
                </div>
              </div>

              {/* Quantity */}
              <div className="text-right shrink-0">
                <p className={`text-xl font-bold ${item.status === 'critical' ? 'text-danger-600' : 'text-slate-900 dark:text-white'
                  }`}>
                  {item.quantity}
                  <span className="text-sm font-normal text-slate-500 ml-1">{item.unit}</span>
                </p>
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={() => handleOpenLots(item)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20"
                    title="Ver lotes e validades"
                  >
                    <span className="material-symbols-outlined text-primary-500 text-lg">inventory</span>
                  </button>
                  <button
                    onClick={() => openModal('edit', item)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="material-symbols-outlined text-slate-400 text-lg">edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20"
                  >
                    <span className="material-symbols-outlined text-danger-500 text-lg">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === 'in' ? 'bg-success-100 dark:bg-success-900/30' :
                  mode === 'out' ? 'bg-warning-100 dark:bg-warning-900/30' :
                    'bg-primary-100 dark:bg-primary-900/30'
                  }`}>
                  <span className={`material-symbols-outlined ${mode === 'in' ? 'text-success-500' :
                    mode === 'out' ? 'text-warning-500' :
                      'text-primary-500'
                    }`}>
                    {mode === 'register' ? 'add_circle' : mode === 'edit' ? 'edit' : mode === 'in' ? 'login' : 'logout'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {mode === 'register' && 'Cadastrar Insumo'}
                  {mode === 'edit' && 'Editar Insumo'}
                  {mode === 'in' && 'Entrada de Estoque'}
                  {mode === 'out' && 'Saída de Estoque'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            {/* Forms */}
            {(mode === 'register' || mode === 'edit') && (
              <form onSubmit={handleSaveSupply} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nome</label>
                  <input className="input" value={supplyForm.name} onChange={(e) => setSupplyForm({ ...supplyForm, name: e.target.value })} required />
                </div>

                {/* Category selector */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Categoria</label>
                  <select
                    className="input"
                    value={supplyForm.category}
                    onChange={(e) => handleCategorySelectChange(e.target.value)}
                  >
                    {formCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__custom__">+ Nova categoria...</option>
                  </select>
                  {showCustomCategory && (
                    <input
                      className="input mt-2"
                      placeholder="Digite o nome da nova categoria..."
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      autoFocus
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Unidade</label>
                    <select className="input" value={supplyForm.unit} onChange={(e) => setSupplyForm({ ...supplyForm, unit: e.target.value })}>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="l">l</option>
                      <option value="ml">ml</option>
                      <option value="unit">unid</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Estoque mínimo</label>
                    <input className="input" value={supplyForm.min_stock} onChange={(e) => setSupplyForm({ ...supplyForm, min_stock: e.target.value })} type="number" step="0.01" />
                  </div>
                </div>

                {/* NOVA Classification */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-4">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Classificação Nutricional (Opcional)
                  </p>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Grau de Processamento (NOVA)
                    </label>
                    <select
                      className="input"
                      value={supplyForm.nova_classification}
                      onChange={(e) => handleNovaChange(e.target.value)}
                    >
                      {NOVA_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Função Nutricional
                    </label>
                    <select
                      className="input"
                      value={supplyForm.nutritional_function}
                      onChange={(e) => setSupplyForm({ ...supplyForm, nutritional_function: e.target.value })}
                    >
                      {NUTRITIONAL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {supplyForm.nova_classification && NOVA_TO_NUTRITIONAL[supplyForm.nova_classification] && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        💡 Sugerido automaticamente com base na classificação NOVA
                      </p>
                    )}
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={supplyForm.is_active} onChange={(e) => setSupplyForm({ ...supplyForm, is_active: e.target.checked })} className="w-5 h-5 rounded" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Ativo</span>
                </label>

                <button className="w-full btn-primary h-12" type="submit">Salvar</button>
              </form>
            )}

            {(mode === 'in' || mode === 'out') && (
              <form onSubmit={handleMovement} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Insumo</label>
                  <select className="input" value={selectedSupplyId} onChange={(e) => setSelectedSupplyId(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {supplies.map((supply) => (
                      <option key={supply.id} value={supply.id}>{supply.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Quantidade</label>
                    <input className="input" placeholder="0.00" type="number" step="0.01" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Data</label>
                    <input className="input" type="date" value={movement.movement_date} onChange={(e) => setMovement({ ...movement, movement_date: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Observação</label>
                  <textarea className="input h-20 resize-none" placeholder="Motivo da movimentação..." value={movement.note} onChange={(e) => setMovement({ ...movement, note: e.target.value })}></textarea>
                </div>
                <button className={`w-full btn h-12 ${mode === 'in' ? 'btn-success' : 'bg-warning-500 text-white hover:bg-warning-600'}`} type="submit">
                  Registrar {mode === 'in' ? 'Entrada' : 'Saída'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Central Lots Management Modal */}
      {centralLotsModalOpen && (
        <div className="modal-overlay" onClick={() => !centralLotsLoading && setCentralLotsModalOpen(false)}>
          <div className="modal-content max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Central de Gerenciamento de Lotes</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Lotes da central, proximidade de vencimento e destinos de envio por escola.
                </p>
              </div>
              <button
                onClick={() => setCentralLotsModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                disabled={centralLotsLoading}
              >
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Proximo do vencimento em ate (dias)
                </label>
                <input
                  type="number"
                  min={0}
                  value={centralLotsDays}
                  onChange={(e) => setCentralLotsDays(Math.max(0, Number(e.target.value || 0)))}
                  className="input w-40"
                />
              </div>
              <button onClick={handleOpenCentralLots} disabled={centralLotsLoading} className="btn-secondary">
                <span className="material-symbols-outlined">refresh</span>
                {centralLotsLoading ? 'Atualizando...' : 'Atualizar painel'}
              </button>
            </div>

            {centralLotsLoading ? (
              <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                Carregando central de lotes...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">Lotes na central</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{Number(centralLotsData.summary?.total_lots || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-warning-200 dark:border-warning-900/40 p-3 bg-warning-50/40 dark:bg-warning-900/10">
                    <p className="text-[11px] uppercase tracking-wider text-warning-700 dark:text-warning-400">Proximos do vencimento</p>
                    <p className="text-xl font-bold text-warning-700 dark:text-warning-400">{Number(centralLotsData.summary?.near_expiry_lots || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-danger-200 dark:border-danger-900/40 p-3 bg-danger-50/40 dark:bg-danger-900/10">
                    <p className="text-[11px] uppercase tracking-wider text-danger-700 dark:text-danger-400">Vencidos</p>
                    <p className="text-xl font-bold text-danger-700 dark:text-danger-400">{Number(centralLotsData.summary?.expired_lots || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">Saldo total central</p>
                    <p className="text-xl font-bold text-primary-600 dark:text-primary-400">{Number(centralLotsData.summary?.total_central_quantity || 0).toFixed(2)}</p>
                  </div>
                </div>

                {!centralLotsData.results.length ? (
                  <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-500">
                    Nenhum lote encontrado para os filtros informados.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[62vh] overflow-y-auto pr-1">
                    {centralLotsData.results.map((lot) => (
                      <div key={lot.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-slate-900 dark:text-white">{lot.supply_name} • Lote {lot.lot_code}</p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${lotStatusClass(lot.status)}`}>
                                {lotStatusLabel(lot.status)}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${expiryStateClass(lot.expiry_state)}`}>
                                {expiryStateLabel(lot.expiry_state)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Validade: <span className="font-medium">{formatDateBr(lot.expiry_date)}</span>
                              {' • '}Fabricacao: <span className="font-medium">{formatDateBr(lot.manufacture_date)}</span>
                              {lot.days_to_expiry !== null && lot.days_to_expiry !== undefined ? ` • ${lot.days_to_expiry} dia(s)` : ''}
                            </p>
                            {lot.supplier_name && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Fornecedor: <span className="font-medium">{lot.supplier_name}</span>
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] uppercase tracking-wider text-slate-500">Saldo central</p>
                            <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
                              {Number(lot.central_quantity || 0).toFixed(2)}
                              <span className="text-sm font-normal text-slate-500 ml-1">{lot.unit}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Enviado: <span className="font-semibold">{Number(lot.sent_total || 0).toFixed(2)} {lot.unit}</span>
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Destinos do lote</p>
                          {!lot.destinations?.length ? (
                            <p className="text-xs text-slate-400 italic">Sem envios registrados para escolas.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {lot.destinations.map((destination) => (
                                <div key={`${lot.id}-${destination.school_id}`} className="rounded-lg bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-xs">
                                  <p className="font-semibold text-slate-700 dark:text-slate-300">{destination.school_name}</p>
                                  <p className="text-slate-500 dark:text-slate-400">
                                    Qtd enviada: {Number(destination.quantity || 0).toFixed(2)} {lot.unit}
                                  </p>
                                  <p className="text-slate-500 dark:text-slate-400">
                                    Ultima entrega: {formatDateBr(destination.last_delivery_date)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Lots Details Modal */}
      {(lotsModal || lotsLoading) && (
        <div className="modal-overlay" onClick={() => !lotsLoading && setLotsModal(null)}>
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Informações de Lotes</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {lotsModal?.item.name || 'Carregando...'} {lotsModal?.item.unit ? `• ${lotsModal.item.unit}` : ''}
                </p>
              </div>
              <button
                onClick={() => setLotsModal(null)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                disabled={lotsLoading}
              >
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            {lotsLoading ? (
              <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                Carregando lotes...
              </div>
            ) : !lotsModal || lotsModal.lots.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-500">
                Nenhum lote disponível no estoque central para este insumo.
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {lotsModal.lots.map((lot: any) => (
                  <div key={lot.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 dark:text-white">Lote {lot.lot_code}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${lotStatusClass(lot.status)}`}>
                            {lotStatusLabel(lot.status)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Validade: <span className="font-medium">{formatDateBr(lot.expiry_date)}</span>
                          {' • '}
                          Fabricação: <span className="font-medium">{formatDateBr(lot.manufacture_date)}</span>
                        </p>
                        {(lot.supplier_name || lot.supplier) && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Fornecedor: <span className="font-medium">{lot.supplier_name || 'Cadastrado'}</span>
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Saldo Central</p>
                        <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
                          {Number(lot.central_quantity || 0).toFixed(2)}
                          <span className="text-sm font-normal text-slate-500 ml-1">{lotsModal.item.unit}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
