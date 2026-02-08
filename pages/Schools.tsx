import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSchool, deleteSchool, getPublicLink, getSchools, getSchoolStock, updateSchool } from '../api';
import { School } from '../types';

const Schools: React.FC = () => {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    is_active: true,
  });
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [addressFilter, setAddressFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [stockModal, setStockModal] = useState<{ school: School; data: any } | null>(null);
  const [stockLoading, setStockLoading] = useState(false);

  const locationLabel = useMemo(() => {
    return (school: School) => school.location || 'Sem endereço';
  }, []);

  const loadSchools = (filters?: { q?: string; is_active?: boolean; city?: string; address?: string }) => {
    return getSchools(filters)
      .then((data) => {
        const mapped = data.map((school: any) => ({
          id: school.id,
          name: school.name,
          location: [school.address, school.city].filter(Boolean).join(' • ') || 'Sem endereço',
          status: school.is_active ? 'active' : 'pending',
          publicSlug: school.public_slug,
          publicToken: school.public_token,
        }));
        setSchools(mapped);
      })
      .catch(() => setError('Não foi possível carregar as escolas.'));
  };

  useEffect(() => {
    setIsLoading(true);
    loadSchools().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active';
      loadSchools({ q: search, is_active: isActive, city: cityFilter, address: addressFilter });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, statusFilter, cityFilter, addressFilter]);

  const openPublicMenu = async (school: School) => {
    try {
      const link = await getPublicLink(school.id);
      navigate(`/public/menu?slug=${link.slug}&token=${link.token}`);
    } catch {
      setError('Não foi possível gerar o link público.');
    }
  };

  const openPublicConsumption = async (school: School) => {
    try {
      const link = await getPublicLink(school.id);
      navigate(`/public/consumption?slug=${link.slug}&token=${link.token}`);
    } catch {
      setError('Não foi possível gerar o link público.');
    }
  };

  const openSchoolStock = async (school: School) => {
    setStockLoading(true);
    try {
      const data = await getSchoolStock(school.id);
      setStockModal({ school, data });
    } catch {
      setError('Não foi possível carregar o estoque da escola.');
    } finally {
      setStockLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', address: '', city: '', is_active: true });
    setShowModal(true);
  };

  const openEdit = (school: School) => {
    setEditing(school);
    const [address, city] = school.location.split(' • ');
    setForm({
      name: school.name,
      address: address || '',
      city: city || '',
      is_active: school.status === 'active',
    });
    setShowModal(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      if (editing) {
        await updateSchool(editing.id, form);
      } else {
        await createSchool(form);
      }
      setShowModal(false);
      const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active';
      await loadSchools({ q: search, is_active: isActive, city: cityFilter, address: addressFilter });
    } catch {
      setError('Não foi possível salvar a escola.');
    }
  };

  const handleDelete = async (school: School) => {
    if (!confirm(`Excluir ${school.name}?`)) return;
    try {
      await deleteSchool(school.id);
      const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active';
      await loadSchools({ q: search, is_active: isActive, city: cityFilter, address: addressFilter });
    } catch {
      setError('Não foi possível excluir a escola.');
    }
  };

  // Generate avatar color from school name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-primary-500', 'bg-secondary-500', 'bg-accent-500',
      'bg-success-500', 'bg-warning-500', 'bg-pink-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="flex flex-col flex-1 pb-24 lg:pb-8">
      {/* Header */}
      <div className="p-4 lg:p-6 space-y-4">
        {/* Title & Add Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Escolas</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {schools.length} escola{schools.length !== 1 ? 's' : ''} cadastrada{schools.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary">
            <span className="material-symbols-outlined">add</span>
            <span className="hidden sm:inline">Nova Escola</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-with-icon"
            placeholder="Pesquisar escola..."
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setStatusFilter(statusFilter === 'all' ? 'active' : statusFilter === 'active' ? 'pending' : 'all')}
            className={`chip shrink-0 ${statusFilter !== 'all' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : ''}`}
          >
            <span className="material-symbols-outlined text-sm">filter_list</span>
            {statusFilter === 'all' ? 'Todos' : statusFilter === 'active' ? 'Ativas' : 'Pendentes'}
          </button>

          <div className="chip shrink-0">
            <span className="material-symbols-outlined text-sm">location_city</span>
            <input
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-transparent outline-none w-20 text-sm"
              placeholder="Cidade"
            />
          </div>

          <div className="chip shrink-0">
            <span className="material-symbols-outlined text-sm">home_pin</span>
            <input
              value={addressFilter}
              onChange={(e) => setAddressFilter(e.target.value)}
              className="bg-transparent outline-none w-20 text-sm"
              placeholder="Bairro"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mb-4 p-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* Schools Grid */}
      <div className="flex-1 px-4 lg:px-6">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : schools.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined text-3xl">school</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Nenhuma escola encontrada</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">Cadastre sua primeira escola para começar</p>
            <button onClick={openCreate} className="btn-primary">
              <span className="material-symbols-outlined">add</span>
              Cadastrar Escola
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {schools.map((school, index) => (
              <div
                key={school.id}
                className="card p-5 hover:shadow-card-hover animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl ${getAvatarColor(school.name)} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                    {school.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{school.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{locationLabel(school)}</p>
                  </div>
                  <span className={`badge shrink-0 ${school.status === 'active' ? 'badge-success' : 'badge-warning'
                    }`}>
                    {school.status === 'active' ? 'Ativa' : 'Pendente'}
                  </span>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => openEdit(school)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-slate-500">edit</span>
                    <span className="text-[10px] font-medium text-slate-500">Editar</span>
                  </button>
                  <button
                    onClick={() => openPublicMenu(school)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-primary-500">link</span>
                    <span className="text-[10px] font-medium text-slate-500">Link</span>
                  </button>
                  <button
                    onClick={() => openPublicConsumption(school)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-accent-500">inventory_2</span>
                    <span className="text-[10px] font-medium text-slate-500">Consumo</span>
                  </button>
                  <button
                    onClick={() => handleDelete(school)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-danger-500">delete</span>
                    <span className="text-[10px] font-medium text-slate-500">Excluir</span>
                  </button>
                </div>

                {/* Menu Button */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => openSchoolStock(school)}
                    disabled={stockLoading}
                    className="btn bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400 hover:bg-success-100 dark:hover:bg-success-900/30"
                  >
                    <span className="material-symbols-outlined">warehouse</span>
                    Estoque
                  </button>
                  <button
                    onClick={() => navigate('/admin/editor')}
                    className="btn bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30"
                  >
                    <span className="material-symbols-outlined">restaurant_menu</span>
                    Cardápio
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary-500">school</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editing ? 'Editar Escola' : 'Nova Escola'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nome</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome da escola"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Endereço</label>
                  <input
                    className="input"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Rua, número"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cidade</label>
                  <input
                    className="input"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Escola ativa</p>
                  <p className="text-xs text-slate-500">Aparecer nas listagens e relatórios</p>
                </div>
              </label>

              <button type="submit" className="w-full btn-primary h-12">
                <span className="material-symbols-outlined">check</span>
                {editing ? 'Salvar Alterações' : 'Cadastrar Escola'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Stock Modal */}
      {stockModal && (
        <div className="modal-overlay" onClick={() => setStockModal(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-content max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-success-500">warehouse</span>
                  Estoque da Escola
                </h2>
                <p className="text-sm text-slate-500">{stockModal.school.name}</p>
              </div>
              <button onClick={() => setStockModal(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 p-5 bg-slate-50 dark:bg-slate-800/50">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stockModal.data.summary?.total_items || 0}</p>
                <p className="text-xs text-slate-500 uppercase">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success-500">{stockModal.data.summary?.normal_stock || 0}</p>
                <p className="text-xs text-slate-500 uppercase">Normal</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-danger-500">{stockModal.data.summary?.low_stock || 0}</p>
                <p className="text-xs text-slate-500 uppercase">Baixo</p>
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {stockModal.data.items?.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
                  <p>Nenhum insumo no estoque desta escola</p>
                  <p className="text-xs mt-1">O estoque será atualizado quando entregas forem conferidas</p>
                </div>
              ) : (
                stockModal.data.items?.map((item: any) => (
                  <div
                    key={item.supply?.id}
                    className={`p-3 rounded-xl border ${item.status === 'BAIXO'
                        ? 'border-danger-200 bg-danger-50 dark:border-danger-900/50 dark:bg-danger-900/10'
                        : item.status === 'ALTO'
                          ? 'border-success-200 bg-success-50 dark:border-success-900/50 dark:bg-success-900/10'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">{item.supply?.name}</p>
                        <p className="text-xs text-slate-500">{item.supply?.category}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {Number(item.quantity).toFixed(2)} <span className="text-sm font-normal text-slate-500">{item.supply?.unit}</span>
                        </p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.status === 'BAIXO'
                            ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                            : item.status === 'ALTO'
                              ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setStockModal(null)} className="btn-secondary w-full">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default Schools;
