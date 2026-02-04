import React from 'react';
import { MOCK_SCHOOLS } from '../constants';
import { useNavigate } from 'react-router-dom';

const Schools: React.FC = () => {
    const navigate = useNavigate();

  return (
    <div className="flex flex-col flex-1 pb-24">
      {/* Action Button */}
      <div className="flex px-4 py-3">
        <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 flex-1 bg-primary text-white gap-2 text-sm font-bold leading-normal tracking-[0.015em] active:scale-95 transition-transform">
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
            <input className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d141b] dark:text-white focus:outline-0 focus:ring-0 border-none bg-[#e7edf3] dark:bg-slate-800 placeholder:text-[#4c739a] px-4 rounded-l-none pl-2 text-base font-normal leading-normal" placeholder="Pesquisar escola..." />
          </div>
        </label>
      </div>

      {/* Chips / Filters */}
      <div className="flex gap-3 p-4 overflow-x-auto no-scrollbar">
        {['Cidade', 'Bairro', 'Status'].map((filter) => (
          <button key={filter} className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-[#e7edf3] dark:bg-slate-800 pl-4 pr-2">
            <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal">{filter}</p>
            <span className="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
          </button>
        ))}
      </div>

      {/* Table/List Representation for Mobile */}
      <div className="flex flex-col gap-3 px-4">
        {MOCK_SCHOOLS.map((school) => (
          <div key={school.id} className="flex flex-col p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col">
                <span className="text-[#0d141b] dark:text-white font-bold text-base">{school.name}</span>
                <span className="text-[#4c739a] dark:text-slate-400 text-sm">{school.location}</span>
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
              <button className="flex-1 flex items-center justify-center gap-1 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0d141b] dark:text-white text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700">
                <span className="material-symbols-outlined text-sm">edit</span> Editar
              </button>
              <button onClick={() => navigate('/public/menu')} className="flex-1 flex items-center justify-center gap-1 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0d141b] dark:text-white text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700">
                <span className="material-symbols-outlined text-sm">link</span> Link
              </button>
              <button onClick={() => navigate('/admin/editor')} className="flex-1 flex items-center justify-center gap-1 h-9 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20">
                <span className="material-symbols-outlined text-sm">restaurant_menu</span> Cardápio
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Schools;
