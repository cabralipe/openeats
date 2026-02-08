import React, { useEffect, useMemo, useState } from 'react';
import { createStockMovement, createSupply, deleteSupply, exportStockCsv, getStock, getSupplies, updateSupply } from '../api';
import { InventoryItem } from '../types';

const Inventory: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'register' | 'in' | 'out' | 'edit'>('register');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [selectedSupplyId, setSelectedSupplyId] = useState('');
  const [movement, setMovement] = useState({ quantity: '', movement_date: '', note: '' });
  const [supplyForm, setSupplyForm] = useState({ name: '', category: '', unit: 'kg', min_stock: '0', is_active: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'ok'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const categories = ['Todos', 'Grãos', 'Proteínas', 'Hortifruti', 'Mercearia'];

  const loadStock = (filters?: { q?: string; category?: string; low_stock?: boolean }) => {
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
          } as InventoryItem;
        });
        setItems(mapped);
      })
      .catch(() => setError('Não foi possível carregar o estoque.'));
  };

  const loadSupplies = (filters?: { q?: string; category?: string }) => {
    return getSupplies(filters)
      .then((data) => setSupplies(data))
      .catch(() => setError('Não foi possível carregar os insumos.'));
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadStock(), loadSupplies()]).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const category = categoryFilter === 'Todos' ? undefined : categoryFilter;
      const low_stock = stockFilter === 'all' ? undefined : stockFilter === 'low';
      loadStock({ q: search, category, low_stock });
      loadSupplies({ q: search, category });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, categoryFilter, stockFilter]);

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
    if (nextMode === 'edit' && item) {
      const supply = supplies.find((entry) => entry.id === item.id);
      setEditingId(item.id);
      setSupplyForm({
        name: item.name,
        category: item.category,
        unit: item.unit,
        min_stock: String(item.minQuantity),
        is_active: supply ? supply.is_active : true,
      });
    } else {
      setEditingId(null);
      setSupplyForm({ name: '', category: '', unit: 'kg', min_stock: '0', is_active: true });
      setMovement({ quantity: '', movement_date: new Date().toISOString().slice(0, 10), note: '' });
      setSelectedSupplyId(item?.id || '');
    }
  };

  const handleSaveSupply = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const payload = {
        name: supplyForm.name,
        category: supplyForm.category,
        unit: supplyForm.unit,
        min_stock: Number(supplyForm.min_stock),
        is_active: supplyForm.is_active,
      };
      if (mode === 'edit' && editingId) {
        await updateSupply(editingId, payload);
      } else {
        await createSupply(payload);
      }
      const category = categoryFilter === 'Todos' ? undefined : categoryFilter;
      const low_stock = stockFilter === 'all' ? undefined : stockFilter === 'low';
      await loadSupplies({ q: search, category });
      await loadStock({ q: search, category, low_stock });
      setShowModal(false);
    } catch {
      setError('Não foi possível salvar o insumo.');
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
      await loadStock({ q: search, category, low_stock });
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
      await loadSupplies({ q: search, category });
      await loadStock({ q: search, category, low_stock });
    } catch {
      setError('Não foi possível excluir o insumo.');
    }
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
          {categories.map((cat) => (
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
                <span className={`badge mt-1 ${item.status === 'critical' ? 'badge-danger' : 'badge-success'
                  }`}>
                  {item.status === 'critical' ? 'Estoque Baixo' : 'Adequado'}
                </span>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Categoria</label>
                    <input className="input" value={supplyForm.category} onChange={(e) => setSupplyForm({ ...supplyForm, category: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Unidade</label>
                    <select className="input" value={supplyForm.unit} onChange={(e) => setSupplyForm({ ...supplyForm, unit: e.target.value })}>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="l">l</option>
                      <option value="ml">ml</option>
                      <option value="unid">unid</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Estoque mínimo</label>
                    <input className="input" value={supplyForm.min_stock} onChange={(e) => setSupplyForm({ ...supplyForm, min_stock: e.target.value })} type="number" step="0.01" />
                  </div>
                  <label className="flex items-center gap-3 mt-7 cursor-pointer">
                    <input type="checkbox" checked={supplyForm.is_active} onChange={(e) => setSupplyForm({ ...supplyForm, is_active: e.target.checked })} className="w-5 h-5 rounded" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Ativo</span>
                  </label>
                </div>
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
    </div>
  );
};

export default Inventory;
