import React, { useState } from 'react';
import { MOCK_INVENTORY } from '../constants';

const Inventory: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

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
            <p className="text-[#0d141b] dark:text-white tracking-light text-2xl font-bold leading-tight">142</p>
          </div>
          <div className="flex min-w-[150px] flex-1 flex-col gap-2 rounded-xl p-4 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500 text-sm">warning</span>
              <p className="text-red-600 dark:text-red-400 text-xs font-medium uppercase tracking-wider">Crítico</p>
            </div>
            <p className="text-red-700 dark:text-red-300 tracking-light text-2xl font-bold leading-tight">12</p>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex overflow-x-auto gap-3 p-4 bg-background-light dark:bg-background-dark scrollbar-hide">
        <button onClick={() => setShowModal(true)} className="flex-none flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-lg">add</span> Cadastrar
        </button>
        <button onClick={() => setShowModal(true)} className="flex-none flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-lg">login</span> Entrada
        </button>
        <button onClick={() => setShowModal(true)} className="flex-none flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-lg">logout</span> Saída
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 px-4">
        <div className="flex border-b border-[#cfdbe7] dark:border-slate-700 gap-8 overflow-x-auto no-scrollbar">
          {['Todos', 'Grãos', 'Proteínas', 'Hortifrúti'].map((tab, idx) => (
             <button key={tab} className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 px-2 ${idx === 0 ? 'border-b-primary text-primary' : 'border-b-transparent text-slate-500'}`}>
                <p className="text-sm font-bold leading-normal whitespace-nowrap">{tab}</p>
             </button>
          ))}
        </div>
      </div>

      {/* Inventory List */}
      <div className="flex-1 flex flex-col gap-1 p-2 bg-slate-100 dark:bg-slate-950">
        {MOCK_INVENTORY.map((item) => (
          <div key={item.id} className={`flex gap-4 bg-white dark:bg-slate-900 px-4 py-4 rounded-xl border justify-between items-center shadow-sm mb-1 ${item.status === 'critical' ? 'border-red-100 dark:border-red-900/30' : 'border-slate-100 dark:border-slate-800'}`}>
            <div className="flex items-start gap-4">
              <div className={`flex items-center justify-center rounded-lg shrink-0 size-12 ${
                  item.status === 'critical' 
                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30' 
                  : item.category === 'Proteínas' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                }`}>
                <span className="material-symbols-outlined">
                    {item.status === 'critical' ? 'warning' : item.category === 'Proteínas' ? 'egg' : 'check_circle'}
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
              <button className="text-slate-400 mt-2"><span className="material-symbols-outlined">more_vert</span></button>
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
                    <h3 className="text-lg font-bold">Lançamento Rápido</h3>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400"><span className="material-symbols-outlined">close</span></button>
                </div>
                <form className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Insumo</label>
                    <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm">
                    <option>Selecione um item...</option>
                    <option>Arroz Agulhinha</option>
                    <option>Feijão Carioca</option>
                    <option>Óleo de Soja</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Quantidade</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm" placeholder="0.00" type="number"/>
                    </div>
                    <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Data</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm" type="date"/>
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Observação</label>
                    <textarea className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm h-20" placeholder="Motivo da movimentação..."></textarea>
                </div>
                <div className="flex gap-3 pt-2">
                    <button className="flex-1 bg-primary text-white font-bold py-3 rounded-xl shadow-md" type="submit">Salvar Movimentação</button>
                </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
