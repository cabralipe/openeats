import React from 'react';
import { PUBLIC_MENU } from '../constants';
import { useNavigate } from 'react-router-dom';

const PublicMenu: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden">
      <header className="flex items-center bg-white dark:bg-slate-900 p-4 pb-4 justify-between border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div onClick={() => navigate('/')} className="text-primary flex size-12 shrink-0 items-center justify-center cursor-pointer">
          <span className="material-symbols-outlined">restaurant</span>
        </div>
        <h2 className="text-[#0d141b] dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
            Escola Municipal João Cordeiro
        </h2>
      </header>
      <main className="flex-grow">
        <div className="px-4 py-4">
          <div className="bg-primary/10 dark:bg-primary/20 rounded-xl py-3 px-4">
            <h4 className="text-primary dark:text-primary text-sm font-bold leading-normal tracking-[0.015em] text-center">
                Semana: 03 a 07/02/2026
            </h4>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {PUBLIC_MENU.map((item, idx) => (
             <div key={idx} className="flex flex-col gap-3 pb-3 bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm">
                <div 
                    className="w-full bg-center bg-no-repeat aspect-video bg-cover" 
                    style={{ backgroundImage: `url("${item.image}")` }}
                >
                </div>
                <div className="p-4">
                    <p className="text-[#0d141b] dark:text-slate-100 text-base font-bold leading-normal">{item.day}</p>
                    <div className="mt-2 space-y-1">
                        <p className="text-[#4c739a] dark:text-slate-400 text-sm font-normal leading-normal">
                            <span className="font-bold text-primary">Almoço:</span> {item.lunch}
                        </p>
                        <p className="text-[#4c739a] dark:text-slate-400 text-sm font-normal leading-normal">
                            <span className="font-bold text-primary">Lanche:</span> {item.snack}
                        </p>
                    </div>
                </div>
             </div>
          ))}
        </div>
        <div className="flex px-4 py-6">
            <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-6 flex-1 bg-primary text-white gap-3 text-base font-bold leading-normal tracking-[0.015em] shadow-lg active:scale-95 transition-transform hover:bg-primary/90">
                <span className="material-symbols-outlined">download</span>
                <span className="truncate">Baixar PDF do cardápio</span>
            </button>
        </div>
      </main>
      <footer className="flex flex-col gap-6 px-5 py-10 text-center bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-center gap-6">
            <a className="text-primary text-sm font-medium leading-normal hover:underline" href="#">Privacidade</a>
            <a className="text-primary text-sm font-medium leading-normal hover:underline" href="#">Contato</a>
            <a className="text-primary text-sm font-medium leading-normal hover:underline" href="#">Nutricional</a>
        </div>
        <div className="flex flex-col items-center gap-2">
            <p className="text-[#4c739a] dark:text-slate-400 text-xs font-normal leading-normal">
                © 2026 SEMED - Secretaria Municipal de Educação
            </p>
            <div className="h-1 w-12 bg-primary/30 rounded-full"></div>
        </div>
      </footer>
    </div>
  );
};

export default PublicMenu;
