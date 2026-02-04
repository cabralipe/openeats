import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getPublicMenuCurrent } from '../api';
import { IMAGES } from '../constants';

const dayNames: Record<string, string> = {
  MON: 'Segunda-feira',
  TUE: 'Terca-feira',
  WED: 'Quarta-feira',
  THU: 'Quinta-feira',
  FRI: 'Sexta-feira',
};

const PublicMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const slug = params.get('slug') || '';
  const token = params.get('token') || '';

  useEffect(() => {
    let active = true;
    if (!slug || !token) {
      setError('Link publico incompleto.');
      setLoading(false);
      return;
    }
    getPublicMenuCurrent(slug, token)
      .then((data) => {
        if (!active) return;
        setMenu(data);
      })
      .catch(() => setError('Nao foi possivel carregar o cardapio.'))
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [slug, token]);

  const groupedItems = useMemo(() => {
    if (!menu?.items) return [];
    const byDay: Record<string, any> = {};
    for (const item of menu.items) {
      if (!byDay[item.day_of_week]) {
        byDay[item.day_of_week] = { day: dayNames[item.day_of_week] || item.day_of_week };
      }
      if (item.meal_type === 'LUNCH') {
        byDay[item.day_of_week].lunch = item.description;
      }
      if (item.meal_type === 'SNACK') {
        byDay[item.day_of_week].snack = item.description;
      }
    }
    const order = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    return order
      .filter((day) => byDay[day])
      .map((day, index) => ({
        ...byDay[day],
        image: [IMAGES.food1, IMAGES.food2, IMAGES.food3, IMAGES.food4, IMAGES.food5][index % 5],
      }));
  }, [menu]);

  const weekLabel = useMemo(() => {
    if (!menu?.week_start || !menu?.week_end) return '';
    return `${menu.week_start} a ${menu.week_end}`;
  }, [menu]);

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden">
      <header className="flex items-center bg-white dark:bg-slate-900 p-4 pb-4 justify-between border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div onClick={() => navigate('/')} className="text-primary flex size-12 shrink-0 items-center justify-center cursor-pointer">
          <span className="material-symbols-outlined">restaurant</span>
        </div>
        <h2 className="text-[#0d141b] dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
            {menu?.school_name || 'Cardapio Publico'}
        </h2>
      </header>
      <main className="flex-grow">
        <div className="px-4 py-4">
          <div className="bg-primary/10 dark:bg-primary/20 rounded-xl py-3 px-4">
            <h4 className="text-primary dark:text-primary text-sm font-bold leading-normal tracking-[0.015em] text-center">
                {weekLabel ? `Semana: ${weekLabel}` : 'Semana em carregamento'}
            </h4>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {loading && (
            <div className="text-slate-500 text-sm">Carregando cardapio...</div>
          )}
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
          {groupedItems.map((item, idx) => (
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
            <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-6 flex-1 bg-primary text-white gap-3 text-base font-bold leading-normal tracking-[0.015em] shadow-lg active:scale-95 transition-transform hover:bg-primary/90" disabled>
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
