import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getPublicMenuCurrent, getPublicSchools } from '../api';
import { IMAGES } from '../constants';

interface School {
  id: string;
  name: string;
  slug: string;
  city: string;
}

const dayNames: Record<string, string> = {
  MON: 'Segunda-feira',
  TUE: 'Terça-feira',
  WED: 'Quarta-feira',
  THU: 'Quinta-feira',
  FRI: 'Sexta-feira',
};

const PublicMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [menu, setMenu] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [search, setSearch] = useState('');

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const slugFromUrl = params.get('slug') || '';
  const tokenFromUrl = params.get('token') || '';

  // Load schools list on mount
  useEffect(() => {
    // If slug and token are provided, skip school selection
    if (slugFromUrl && tokenFromUrl) {
      setLoading(true);
      getPublicMenuCurrent(slugFromUrl, tokenFromUrl)
        .then((data) => {
          setMenu(data);
          setSelectedSchool({ id: '', name: data.school_name || 'Escola', slug: slugFromUrl, city: '' });
        })
        .catch(() => setError('Não foi possível carregar o cardápio.'))
        .finally(() => setLoading(false));
      return;
    }

    // Otherwise load schools list
    setLoading(true);
    getPublicSchools()
      .then((data) => setSchools(data))
      .catch(() => setError('Não foi possível carregar as escolas.'))
      .finally(() => setLoading(false));
  }, [slugFromUrl, tokenFromUrl]);

  const loadMenu = async (school: School) => {
    setSelectedSchool(school);
    setLoadingMenu(true);
    setError('');
    setMenu(null);
    try {
      const data = await getPublicMenuCurrent(school.slug);
      setMenu(data);
    } catch {
      setError('Nenhum cardápio disponível para esta escola nesta semana.');
    } finally {
      setLoadingMenu(false);
    }
  };

  const goBack = () => {
    setSelectedSchool(null);
    setMenu(null);
    setError('');
  };

  const filteredSchools = schools.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase())
  );

  const groupedItems = useMemo(() => {
    if (!menu?.items) return [];
    const byDay: Record<string, any> = {};
    const mealTypeLabel: Record<string, string> = {
      BREAKFAST1: 'Desjejum',
      SNACK1: 'Lanche',
      LUNCH: 'Almoço',
      SNACK2: 'Lanche',
      BREAKFAST2: 'Desjejum',
      DINNER_COFFEE: 'Café da noite',
      BREAKFAST: 'Café da manhã',
      SNACK: 'Lanche',
    };

    for (const item of menu.items) {
      if (!byDay[item.day_of_week]) {
        byDay[item.day_of_week] = {
          day: dayNames[item.day_of_week] || item.day_of_week,
          meals: [],
        };
      }
      byDay[item.day_of_week].meals.push({
        mealType: item.meal_type,
        mealLabel: mealTypeLabel[item.meal_type] || item.meal_type,
        mealName: item.meal_name || '',
        portionText: item.portion_text || '',
        description: item.description || '',
        image: item.image_data || item.image_url || '',
      });
    }

    const order = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const fallbackImages = [IMAGES.food1, IMAGES.food2, IMAGES.food3, IMAGES.food4, IMAGES.food5];
    return order
      .filter((day) => byDay[day])
      .map((day, index) => ({
        ...byDay[day],
        fallbackImage: fallbackImages[index % fallbackImages.length],
      }));
  }, [menu]);

  const weekLabel = useMemo(() => {
    if (!menu?.week_start || !menu?.week_end) return '';
    return `${menu.week_start} a ${menu.week_end}`;
  }, [menu]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-secondary-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-white">
          <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
          <span className="text-lg">Carregando...</span>
        </div>
      </div>
    );
  }

  // School selection (when no slug/token provided)
  if (!selectedSchool && !slugFromUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-secondary-900 flex flex-col">
        {/* Header */}
        <header className="bg-white/10 backdrop-blur-xl border-b border-white/10 p-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-white">restaurant_menu</span>
            </div>
            <div className="flex-1">
              <h1 className="text-white font-bold text-xl">Cardápio Escolar</h1>
              <p className="text-white/60 text-sm">Selecione uma escola</p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Search */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar escola..."
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              />
            </div>

            {/* Schools List */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-red-200 text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              {filteredSchools.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 text-center">
                  <span className="material-symbols-outlined text-4xl text-white/40 mb-2">school</span>
                  <p className="text-white/60">
                    {schools.length === 0
                      ? 'Nenhuma escola com cardápio publicado esta semana.'
                      : 'Nenhuma escola encontrada.'}
                  </p>
                </div>
              ) : (
                filteredSchools.map((school) => (
                  <button
                    key={school.id}
                    onClick={() => loadMenu(school)}
                    className="w-full bg-white/10 backdrop-blur-xl rounded-xl p-4 text-left hover:bg-white/20 transition-all border border-white/10 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white shadow-lg">
                        <span className="material-symbols-outlined">school</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{school.name}</h3>
                        {school.city && <p className="text-white/60 text-sm">{school.city}</p>}
                      </div>
                      <span className="material-symbols-outlined text-white/40 group-hover:text-white/80 transition-colors">chevron_right</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white/5 backdrop-blur-xl border-t border-white/10 p-4 text-center">
          <p className="text-white/40 text-xs">Merenda SEMED • Cardápio Escolar</p>
        </footer>
      </div>
    );
  }

  // Menu display
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden">
      <header className="flex items-center bg-white dark:bg-slate-900 p-4 pb-4 justify-between border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        {!slugFromUrl && (
          <button onClick={goBack} className="text-primary flex size-12 shrink-0 items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        <div onClick={() => navigate('/')} className="text-primary flex size-12 shrink-0 items-center justify-center cursor-pointer">
          <span className="material-symbols-outlined">restaurant</span>
        </div>
        <h2 className="text-[#0d141b] dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
          {selectedSchool?.name || menu?.school_name || 'Cardápio Público'}
        </h2>
      </header>

      <main className="flex-grow">
        {loadingMenu ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="w-8 h-8 border-3 border-slate-300 border-t-primary rounded-full animate-spin"></div>
              <span>Carregando cardápio...</span>
            </div>
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="bg-warning-50 border border-warning-200 rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-warning-500 text-3xl mb-2">info</span>
              <p className="text-warning-700">{error}</p>
              {!slugFromUrl && (
                <button onClick={goBack} className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                  Escolher outra escola
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-4">
              <div className="bg-primary/10 dark:bg-primary/20 rounded-xl py-3 px-4">
                <h4 className="text-primary dark:text-primary text-sm font-bold leading-normal tracking-[0.015em] text-center">
                  {weekLabel ? `Semana: ${weekLabel}` : 'Semana em carregamento'}
                </h4>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {groupedItems.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-3 pb-3 bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div
                    className="w-full bg-center bg-no-repeat aspect-video bg-cover"
                    style={{ backgroundImage: `url("${item.meals?.[0]?.image || item.fallbackImage}")` }}
                  />
                  <div className="p-4">
                    <p className="text-[#0d141b] dark:text-slate-100 text-base font-bold leading-normal">{item.day}</p>
                    <div className="mt-2 space-y-3">
                      {item.meals?.map((meal: any, mealIndex: number) => (
                        <div key={`${item.day}-${mealIndex}`} className="rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                          <p className="text-sm font-bold text-primary">{meal.mealLabel}</p>
                          {meal.mealName && <p className="text-sm font-semibold text-[#0d141b] dark:text-slate-100">{meal.mealName}</p>}
                          {meal.portionText && <p className="text-xs text-slate-500">Quantidade: {meal.portionText}</p>}
                          {meal.description && <p className="text-sm text-[#4c739a] dark:text-slate-400 mt-1">{meal.description}</p>}
                        </div>
                      ))}
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
          </>
        )}
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
