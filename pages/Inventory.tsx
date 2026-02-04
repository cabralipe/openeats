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
      .catch(() => setError('Nao foi possivel carregar o estoque.'));
  };

  const loadSupplies = (filters?: { q?: string; category?: string }) => {
    return getSupplies(filters)
      .then((data) => setSupplies(data))
      .catch(() => setError('Nao foi possivel carregar os insumos.'));
  };

  useEffect(() => {
    let active = true;
    Promise.all([loadStock(), loadSupplies()]).then(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
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
    return { total, critical };
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
      setError('Nao foi possivel salvar o insumo.');
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
      setError('Nao foi possivel registrar a movimentacao.');
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
      setError('Nao foi possivel excluir o insumo.');
    }
  };

  return (
    <div className="flex flex-col flex-1 pb-24">
      {/* Hero / Stats */}
      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold mb-4">Painel de Estoque</h1>
        <div className="flex flex-wrap gap-4">
          <div className="flex min-w-[150px] flex-1 flex-col gap-2 rounded-xl p-4 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">inventory_2</span>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Total Itens</p>
            </div>
            <p className="text-[#0d141b] dark:text-white tracking-light text-2xl font-bold leading-tight">{stats.total}</p>
          </div>
          <div className="flex min-w-[150px] flex-1 flex-col gap-2 rounded-xl p-4 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500 text-sm">warning</span>
              <p className="text-red-600 dark:text-red-400 text-xs font-medium uppercase tracking-wider">Crítico</p>
            </div>
            <p className="text-red-700 dark:text-red-300 tracking-light text-2xl font-bold leading-tight">{stats.critical}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex overflow-x-auto gap-3 p-4 bg-background-light dark:bg-background-dark scrollbar-hide">
        <button onClick={() => openModal('register')} className="flex-none flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-lg">add</span> Cadastrar
        </button>
        <button onClick={() => openModal('in')} className="flex-none flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-lg">login</span> Entrada
        </button>
        <button onClick={() => openModal('out')} className="flex-none flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-lg">logout</span> Saída
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 px-4">
        <div className="flex border-b border-[#cfdbe7] dark:border-slate-700 gap-8 overflow-x-auto no-scrollbar">
          {['Todos', 'Graos', 'Proteinas', 'Hortifruti', 'Mercearia'].map((tab) => (
             <button key={tab} onClick={() => setCategoryFilter(tab)} className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 px-2 ${categoryFilter === tab ? 'border-b-primary text-primary' : 'border-b-transparent text-slate-500'}`}>
                <p className="text-sm font-bold leading-normal whitespace-nowrap">{tab}</p>
             </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-2">
        <label className="flex flex-col min-w-40 h-12 w-full">
          <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
            <div className="text-[#4c739a] dark:text-slate-400 flex border-none bg-[#e7edf3] dark:bg-slate-800 items-center justify-center pl-4 rounded-l-lg">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d141b] dark:text-white focus:outline-0 focus:ring-0 border-none bg-[#e7edf3] dark:bg-slate-800 placeholder:text-[#4c739a] px-4 rounded-l-none pl-2 text-base font-normal leading-normal" placeholder="Pesquisar insumo..." />
          </div>
        </label>
      </div>

      <div className="flex gap-3 px-4 pb-2 overflow-x-auto no-scrollbar">
        <button onClick={() => setStockFilter(stockFilter === 'all' ? 'low' : stockFilter === 'low' ? 'ok' : 'all')} className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-[#e7edf3] dark:bg-slate-800 pl-4 pr-2">
          <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal">
            Estoque: {stockFilter === 'all' ? 'Todos' : stockFilter === 'low' ? 'Critico' : 'Adequado'}
          </p>
          <span className="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
        </button>
        <button onClick={() => exportStockCsv()} className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-primary/10 text-primary pl-3 pr-3 text-sm font-semibold">
          <span className="material-symbols-outlined text-[18px]">download</span>
          Exportar CSV
        </button>
      </div>

      {/* Inventory List */}
      <div className="flex-1 flex flex-col gap-1 p-2 bg-slate-100 dark:bg-slate-950">
        {error && (
          <div className="text-red-600 text-sm px-2">{error}</div>
        )}
        {items.map((item) => (
          <div key={item.id} className={`flex gap-4 bg-white dark:bg-slate-900 px-4 py-4 rounded-xl border justify-between items-center shadow-sm mb-1 ${item.status === 'critical' ? 'border-red-100 dark:border-red-900/30' : 'border-slate-100 dark:border-slate-800'}`}>
            <div className="flex items-start gap-4">
              <div className={`flex items-center justify-center rounded-lg shrink-0 size-12 ${
                  item.status === 'critical' 
                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30' 
                  : item.category.toLowerCase().includes('prote') ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                }`}>
                <span className="material-symbols-outlined">
                    {item.status === 'critical' ? 'warning' : item.category.toLowerCase().includes('prote') ? 'egg' : 'check_circle'}
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <p className="text-[#0d141b] dark:text-white text-base font-bold leading-none mb-1">{item.name}</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-normal">{item.category} | Unidade: {item.unit}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      item.status === 'critical' 
                      ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  }`}>
                    {item.status === 'critical' ? 'Estoque Baixo' : 'Adequado'}
                  </span>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Mín: {item.minQuantity}{item.unit}</p>
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-lg font-bold ${item.status === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                {item.quantity}{item.unit}
              </p>
              <div className="flex gap-2 mt-2 justify-end">
                <button onClick={() => openModal('edit', item)} className="text-slate-400"><span className="material-symbols-outlined">edit</span></button>
                <button onClick={() => handleDelete(item)} className="text-red-500"><span className="material-symbols-outlined">delete</span></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
            <div className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 pb-8 shadow-2xl rounded-t-3xl animate-[slideUp_0.3s_ease-out]">
                <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-1 bg-primary h-6 rounded-full"></div>
                    <h3 className="text-lg font-bold">
                      {mode === 'register' && 'Cadastrar Insumo'}
                      {mode === 'edit' && 'Editar Insumo'}
                      {mode === 'in' && 'Entrada de Estoque'}
                      {mode === 'out' && 'Saida de Estoque'}
                    </h3>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400"><span className="material-symbols-outlined">close</span></button>
                </div>
                {(mode === 'register' || mode === 'edit') && (
                  <form onSubmit={handleSaveSupply} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nome</label>
                      <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm" value={supplyForm.name} onChange={(e) => setSupplyForm({ ...supplyForm, name: e.target.value })} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Categoria</label>
                        <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm" value={supplyForm.category} onChange={(e) => setSupplyForm({ ...supplyForm, category: e.target.value })} required />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Unidade</label>
                        <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm" value={supplyForm.unit} onChange={(e) => setSupplyForm({ ...supplyForm, unit: e.target.value })}>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="l">l</option>
                          <option value="ml">ml</option>
                          <option value="unit">unit</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Estoque minimo</label>
                        <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm" value={supplyForm.min_stock} onChange={(e) => setSupplyForm({ ...supplyForm, min_stock: e.target.value })} type="number" step="0.01" />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 mt-6">
                        <input type="checkbox" checked={supplyForm.is_active} onChange={(e) => setSupplyForm({ ...supplyForm, is_active: e.target.checked })} />
                        Ativo
                      </label>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button className="flex-1 bg-primary text-white font-bold py-3 rounded-xl shadow-md" type="submit">Salvar</button>
                    </div>
                  </form>
                )}
                {(mode === 'in' || mode === 'out') && (
                  <form onSubmit={handleMovement} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Insumo</label>
                      <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm" value={selectedSupplyId} onChange={(e) => setSelectedSupplyId(e.target.value)} required>
                        <option value="">Selecione um item...</option>
                        {supplies.map((supply) => (
                          <option key={supply.id} value={supply.id}>{supply.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Quantidade</label>
                        <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm" placeholder="0.00" type="number" step="0.01" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} required />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Data</label>
                        <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm" type="date" value={movement.movement_date} onChange={(e) => setMovement({ ...movement, movement_date: e.target.value })} required />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Observacao</label>
                      <textarea className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm h-20" placeholder="Motivo da movimentacao..." value={movement.note} onChange={(e) => setMovement({ ...movement, note: e.target.value })}></textarea>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button className="flex-1 bg-primary text-white font-bold py-3 rounded-xl shadow-md" type="submit">Salvar Movimentacao</button>
                    </div>
                  </form>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
