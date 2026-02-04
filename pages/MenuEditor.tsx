import React from 'react';

const MenuEditor: React.FC = () => {
  return (
    <div className="flex flex-col flex-1 pb-28">
      <div className="px-4 pt-4 flex flex-col gap-3">
        {/* School TextField (Select) */}
        <div className="flex flex-col">
          <label className="flex flex-col flex-1">
            <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Escola</p>
            <div className="relative">
              <select className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal">
                <option value="joao-cordeiro">Escola Municipal João Cordeiro</option>
                <option value="maria-jose">Escola Municipal Maria José</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#4c739a]">
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>
          </label>
        </div>
        {/* Week TextField (Select) */}
        <div className="flex flex-col">
          <label className="flex flex-col flex-1">
            <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Semana</p>
            <div className="relative">
              <select className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal">
                <option value="week-22">22 de Maio - 26 de Maio</option>
                <option value="week-29">29 de Maio - 02 de Junho</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#4c739a]">
                <span className="material-symbols-outlined">calendar_today</span>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* ActionPanel: Status */}
      <div className="px-4 mt-3">
        <div className="flex flex-1 items-center justify-between gap-4 rounded-xl border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-amber-500 animate-pulse"></span>
              <p className="text-[#0d141b] dark:text-white text-base font-bold leading-tight">Status: Rascunho</p>
            </div>
            <p className="text-[#4c739a] dark:text-slate-400 text-xs font-normal leading-normal">Última alteração hoje às 14:30</p>
          </div>
          <label className="relative flex h-[31px] w-[51px] cursor-pointer items-center rounded-full border-none bg-[#e7edf3] dark:bg-slate-700 p-0.5 has-[:checked]:justify-end has-[:checked]:bg-primary">
            <div className="h-full w-[27px] rounded-full bg-white shadow-md"></div>
            <input className="invisible absolute" type="checkbox"/>
            </label>
        </div>
      </div>

      {/* Tabs: Days of the Week */}
      <div className="bg-white dark:bg-background-dark sticky top-[73px] z-30 border-b border-[#cfdbe7] dark:border-slate-800 shadow-sm mt-4">
        <div className="flex px-4 gap-2 overflow-x-auto no-scrollbar">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((day, idx) => (
             <button key={day} className={`flex flex-col items-center justify-center border-b-[3px] pb-2 pt-4 min-w-[65px] ${idx === 0 ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}>
                <p className="text-xs font-bold uppercase tracking-wider">{day}</p>
                <p className="text-[11px] font-medium opacity-70">{22 + idx}/05</p>
             </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4">
        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex gap-1">
          <button className="flex-1 py-2 rounded-lg text-sm font-bold bg-white dark:bg-slate-700 text-primary shadow-sm flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg">light_mode</span>
            Manhã
          </button>
          <button className="flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg">dark_mode</span>
            Tarde
          </button>
        </div>
      </div>

      {/* Meal Content Areas */}
      <div className="px-4 flex flex-col gap-6 mt-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-xl">coffee</span>
              <h3 className="font-bold text-sm uppercase tracking-wider">Café da Manhã (07:30)</h3>
            </div>
            <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold uppercase">Manhã</span>
          </div>
          <textarea className="w-full rounded-xl border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-[#0d141b] dark:text-white text-base focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[100px] shadow-sm" placeholder="Ex: Leite com cacau, pão integral com margarina e mamão papaia."></textarea>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-xl">restaurant</span>
              <h3 className="font-bold text-sm uppercase tracking-wider">Almoço (11:30)</h3>
            </div>
            <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold uppercase">Manhã</span>
          </div>
          <textarea className="w-full rounded-xl border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-[#0d141b] dark:text-white text-base focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[120px] shadow-sm" placeholder="Ex: Arroz feijão, frango desfiado com legumes, salada de alface e suco de laranja natural."></textarea>
        </div>

        <div className="flex items-center gap-3 py-2">
          <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Informações Adicionais</span>
          <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="material-symbols-outlined text-xl">info</span>
            <h3 className="font-bold text-sm uppercase tracking-wider">Observações/Restrições</h3>
          </div>
          <textarea className="w-full rounded-xl border border-[#cfdbe7] dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50 p-4 text-[#0d141b] dark:text-white text-base focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[80px]" placeholder="Informar substituições para alunos com intolerância a lactose ou glúten."></textarea>
        </div>
      </div>

      {/* Bottom Action Bar - Now absolute/fixed logic handled by padding bottom on parent */}
      <div className="fixed bottom-0 left-0 right-0 md:left-auto md:w-[calc(100%-120px)] bg-white dark:bg-background-dark border-t border-slate-200 dark:border-slate-800 p-4 flex gap-3 shadow-[0_-8px_20px_rgba(0,0,0,0.08)] z-40 mb-20 md:mb-0">
        <button className="flex-1 h-12 rounded-xl border border-primary text-primary font-bold text-sm flex items-center justify-center gap-2 active:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-lg">save</span>
            Salvar Rascunho
        </button>
        <button className="flex-1 h-12 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:opacity-90 shadow-lg shadow-primary/20 transition-all">
            <span className="material-symbols-outlined text-lg">publish</span>
            Publicar
        </button>
      </div>
    </div>
  );
};

export default MenuEditor;
