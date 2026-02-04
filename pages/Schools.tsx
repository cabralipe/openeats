import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSchool, deleteSchool, getPublicLink, getSchools, updateSchool } from '../api';
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

    const locationLabel = useMemo(() => {
      return (school: School) => school.location || 'Sem endereco';
    }, []);

    const loadSchools = (filters?: { q?: string; is_active?: boolean; city?: string; address?: string }) => {
      return getSchools(filters)
        .then((data) => {
          const mapped = data.map((school: any) => ({
            id: school.id,
            name: school.name,
            location: [school.address, school.city].filter(Boolean).join(' • ') || 'Sem endereco',
            status: school.is_active ? 'active' : 'pending',
            publicSlug: school.public_slug,
            publicToken: school.public_token,
          }));
          setSchools(mapped);
        })
        .catch(() => setError('Nao foi possivel carregar as escolas.'));
    };

    useEffect(() => {
      let active = true;
      loadSchools().then(() => {
        if (!active) return;
      });
      return () => {
        active = false;
      };
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
        setError('Nao foi possivel gerar o link publico.');
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
        setError('Nao foi possivel salvar a escola.');
      }
    };

    const handleDelete = async (school: School) => {
      if (!confirm(`Excluir ${school.name}?`)) return;
      try {
        await deleteSchool(school.id);
        const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active';
        await loadSchools({ q: search, is_active: isActive, city: cityFilter, address: addressFilter });
      } catch {
        setError('Nao foi possivel excluir a escola.');
      }
    };

  return (
    <div className="flex flex-col flex-1 pb-24">
      {/* Action Button */}
      <div className="flex px-4 py-3">
        <button onClick={openCreate} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 flex-1 bg-primary text-white gap-2 text-sm font-bold leading-normal tracking-[0.015em] active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-white text-[20px]">add</span>
          <span className="truncate">Cadastrar Nova Escola</span>
        </button>
      </div>

      {/* SearchBar */}
      <div className="px-4 py-1">
        <label className="flex flex-col min-w-40 h-12 w-full">
          <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
            <div className="text-[#4c739a] dark:text-slate-400 flex border-none bg-[#e7edf3] dark:bg-slate-800 items-center justify-center pl-4 rounded-l-lg">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d141b] dark:text-white focus:outline-0 focus:ring-0 border-none bg-[#e7edf3] dark:bg-slate-800 placeholder:text-[#4c739a] px-4 rounded-l-none pl-2 text-base font-normal leading-normal" placeholder="Pesquisar escola..." />
          </div>
        </label>
      </div>

      {/* Chips / Filters */}
      <div className="flex gap-3 p-4 overflow-x-auto no-scrollbar">
        <button onClick={() => setStatusFilter(statusFilter === 'all' ? 'active' : statusFilter === 'active' ? 'pending' : 'all')} className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-[#e7edf3] dark:bg-slate-800 pl-4 pr-2">
          <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal">
            Status: {statusFilter === 'all' ? 'Todos' : statusFilter === 'active' ? 'Ativas' : 'Pendentes'}
          </p>
          <span className="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
        </button>
        <div className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-[#e7edf3] dark:bg-slate-800 pl-3 pr-2">
          <span className="material-symbols-outlined text-[18px] text-slate-500">location_city</span>
          <input value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="bg-transparent outline-none text-sm text-[#0d141b] dark:text-slate-200 placeholder:text-slate-400 w-28" placeholder="Cidade" />
        </div>
        <div className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-[#e7edf3] dark:bg-slate-800 pl-3 pr-2">
          <span className="material-symbols-outlined text-[18px] text-slate-500">home_pin</span>
          <input value={addressFilter} onChange={(e) => setAddressFilter(e.target.value)} className="bg-transparent outline-none text-sm text-[#0d141b] dark:text-slate-200 placeholder:text-slate-400 w-28" placeholder="Bairro" />
        </div>
      </div>

      {/* Table/List Representation for Mobile */}
      <div className="flex flex-col gap-3 px-4">
        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}
        {schools.map((school) => (
          <div key={school.id} className="flex flex-col p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col">
                <span className="text-[#0d141b] dark:text-white font-bold text-base">{school.name}</span>
                <span className="text-[#4c739a] dark:text-slate-400 text-sm">{locationLabel(school)}</span>
              </div>
              <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${
                school.status === 'active' 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              }`}>
                {school.status === 'active' ? 'Ativo' : 'Pendente'}
              </span>
            </div>
            <div className="flex gap-2 mt-2 border-t dark:border-slate-800 pt-3">
              <button onClick={() => openEdit(school)} className="flex-1 flex items-center justify-center gap-1 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0d141b] dark:text-white text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700">
                <span className="material-symbols-outlined text-sm">edit</span> Editar
              </button>
              <button onClick={() => openPublicMenu(school)} className="flex-1 flex items-center justify-center gap-1 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0d141b] dark:text-white text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700">
                <span className="material-symbols-outlined text-sm">link</span> Link
              </button>
              <button onClick={() => navigate('/admin/editor')} className="flex-1 flex items-center justify-center gap-1 h-9 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20">
                <span className="material-symbols-outlined text-sm">restaurant_menu</span> Cardápio
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => handleDelete(school)} className="flex-1 flex items-center justify-center gap-1 h-9 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100">
                <span className="material-symbols-outlined text-sm">delete</span> Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 pb-8 shadow-2xl rounded-t-3xl animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 bg-primary h-6 rounded-full"></div>
                <h3 className="text-lg font-bold">{editing ? 'Editar Escola' : 'Nova Escola'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nome</label>
                <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Endereco</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cidade</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Ativa
              </label>
              <div className="flex gap-3 pt-2">
                <button className="flex-1 bg-primary text-white font-bold py-3 rounded-xl shadow-md" type="submit">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schools;
