import React from 'react';

const ConsumptionRegistry: React.FC = () => {
  return (
    <div className="flex flex-col flex-1 pb-32">
      {/* School Branding / Header */}
      <div className="px-4 py-4 flex items-center gap-3">
        <div className="size-10 rounded-full bg-primary flex items-center justify-center text-white">
          <span className="material-symbols-outlined">school</span>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Escola Municipal SEMED</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Unidade Central de Ensino</p>
        </div>
      </div>

      {/* CalendarPicker */}
      <div className="px-4 py-2">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-4">
          <div className="flex items-center p-1 justify-between mb-2">
            <button className="text-slate-600 dark:text-slate-400">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <p className="text-slate-900 dark:text-white text-base font-bold leading-tight flex-1 text-center">Outubro 2023</p>
            <button className="text-slate-600 dark:text-slate-400">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <p key={i} className="text-slate-400 text-[11px] font-bold flex h-8 items-center justify-center">{d}</p>
            ))}
            
            <button className="h-10 w-full text-slate-900 dark:text-slate-300 text-xs font-medium col-start-2"><div className="flex size-full items-center justify-center rounded-lg">1</div></button>
            <button className="h-10 w-full text-slate-900 dark:text-slate-300 text-xs font-medium"><div className="flex size-full items-center justify-center rounded-lg">2</div></button>
            <button className="h-10 w-full text-slate-900 dark:text-slate-300 text-xs font-medium"><div className="flex size-full items-center justify-center rounded-lg">3</div></button>
            <button className="h-10 w-full text-slate-900 dark:text-slate-300 text-xs font-medium"><div className="flex size-full items-center justify-center rounded-lg">4</div></button>
            <button className="h-10 w-full text-white text-xs font-bold"><div className="flex size-full items-center justify-center rounded-lg bg-primary shadow-md">5</div></button>
            <button className="h-10 w-full text-slate-900 dark:text-slate-300 text-xs font-medium"><div className="flex size-full items-center justify-center rounded-lg">6</div></button>
          </div>
        </div>
      </div>

      {/* SectionHeader Turno */}
      <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-6">Turno</h3>
      {/* SegmentedButtons */}
      <div className="flex px-4 py-2">
        <div className="flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 p-1">
          <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 has-[:checked]:bg-white dark:has-[:checked]:bg-slate-700 has-[:checked]:shadow-sm has-[:checked]:text-primary text-slate-500 dark:text-slate-400 text-sm font-bold leading-normal transition-all">
            <span className="truncate">Manhã</span>
            <input defaultChecked className="invisible w-0" name="shift-selection" type="radio" value="Manhã"/>
          </label>
          <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 has-[:checked]:bg-white dark:has-[:checked]:bg-slate-700 has-[:checked]:shadow-sm has-[:checked]:text-primary text-slate-500 dark:text-slate-400 text-sm font-bold leading-normal transition-all">
            <span className="truncate">Tarde</span>
            <input className="invisible w-0" name="shift-selection" type="radio" value="Tarde"/>
          </label>
        </div>
      </div>

      {/* SectionHeader Cardápio */}
      <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-6">Cardápio do Dia</h3>
      {/* Menu Items List */}
      <div className="flex flex-col gap-4 px-4 py-2">
        {/* Item 1 */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
              <span className="material-symbols-outlined">restaurant</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Arroz e Feijão Carioca</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Prato Principal</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Refeições Servidas</label>
              <input className="w-full bg-background-light dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary h-10 px-3" placeholder="0" type="number"/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Repetições</label>
              <input className="w-full bg-background-light dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary h-10 px-3" placeholder="0" type="number"/>
            </div>
          </div>
        </div>
        {/* Item 2 */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
              <span className="material-symbols-outlined">nutrition</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Frango Desfiado com Milho</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Proteína</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Refeições Servidas</label>
              <input className="w-full bg-background-light dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary h-10 px-3" placeholder="0" type="number"/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Repetições</label>
              <input className="w-full bg-background-light dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary h-10 px-3" placeholder="0" type="number"/>
            </div>
          </div>
        </div>
      </div>

      {/* SectionHeader Observações */}
      <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-6">Observações do Dia</h3>
      <div className="px-4 py-2">
        <textarea className="w-full h-32 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary dark:text-white resize-none shadow-sm" placeholder="Ex: Sobras limpas, problemas com entrega de ingredientes, falta de gás..."></textarea>
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:left-auto md:w-[calc(100%-120px)] p-4 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 mb-20 md:mb-0">
        <button className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <span className="material-symbols-outlined">check_circle</span>
            Confirmar Registro
        </button>
      </div>
    </div>
  );
};

export default ConsumptionRegistry;
