import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getPublicMenuCurrent, getPublicSchools, exportPublicMenuPdf } from '../api';
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
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

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

  const handleDownloadPdf = () => {
    if (!menu?.week_start || !selectedSchool?.slug) return;
    exportPublicMenuPdf(selectedSchool.slug, menu.week_start, tokenFromUrl);
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
        dayCode: day,
        ...byDay[day],
        fallbackImage: fallbackImages[index % fallbackImages.length],
      }));
  }, [menu]);

  useEffect(() => {
    if (!groupedItems.length) {
      setCurrentDayIndex(0);
      return;
    }
    const nowDay = new Date().getDay(); // 0=Sun ... 6=Sat
    const nowCode = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][nowDay];
    const foundIndex = groupedItems.findIndex((day) => day.dayCode === nowCode);
    setCurrentDayIndex(foundIndex >= 0 ? foundIndex : 0);
  }, [groupedItems]);

  const weekLabel = useMemo(() => {
    if (!menu?.week_start || !menu?.week_end) return '';
    return `${menu.week_start} a ${menu.week_end}`;
  }, [menu]);

  const currentDay = groupedItems[currentDayIndex];

  const currentDayTitle = useMemo(() => {
    if (!menu?.week_start || !currentDay) return currentDay?.day || 'Cardápio do Dia';
    try {
      const offsetByCode: Record<string, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4 };
      const offset = offsetByCode[currentDay.dayCode] ?? 0;
      const base = new Date(`${menu.week_start}T12:00:00`);
      const date = new Date(base);
      date.setDate(base.getDate() + offset);
      return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    } catch {
      return currentDay.day;
    }
  }, [currentDay, menu?.week_start]);

  const currentMealsByType = useMemo(() => {
    if (!currentDay?.meals?.length) return [];
    const iconByMeal: Record<string, string> = {
      BREAKFAST1: 'breakfast_dining',
      BREAKFAST2: 'breakfast_dining',
      BREAKFAST: 'breakfast_dining',
      LUNCH: 'restaurant',
      SNACK1: 'bakery_dining',
      SNACK2: 'bakery_dining',
      SNACK: 'bakery_dining',
      DINNER_COFFEE: 'coffee',
    };
    const grouped: Record<string, { key: string; label: string; icon: string; items: string[] }> = {};
    for (const meal of currentDay.meals) {
      const key = meal.mealType || meal.mealLabel;
      if (!grouped[key]) {
        grouped[key] = {
          key,
          label: meal.mealLabel,
          icon: iconByMeal[meal.mealType] || 'restaurant',
          items: [],
        };
      }
      const text = [meal.mealName, meal.description].filter(Boolean).join(' - ') || meal.description || meal.mealName || 'Item sem descrição';
      grouped[key].items.push(meal.portionText ? `${text} (${meal.portionText})` : text);
    }
    return Object.values(grouped);
  }, [currentDay]);

  const navigateDay = (direction: 'prev' | 'next') => {
    if (!groupedItems.length) return;
    setCurrentDayIndex((prev) => {
      if (direction === 'prev') return prev === 0 ? groupedItems.length - 1 : prev - 1;
      return prev === groupedItems.length - 1 ? 0 : prev + 1;
    });
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const delta = endX - touchStartX;
    if (Math.abs(delta) > 50) {
      navigateDay(delta > 0 ? 'prev' : 'next');
    }
    setTouchStartX(null);
  };

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
            <button
              onClick={() => navigate('/public/calculator')}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium"
            >
              Calculadora
            </button>
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
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-x-hidden">
      <header className="flex items-center bg-white dark:bg-slate-900 px-4 py-3 justify-between border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
        <button
          onClick={() => (slugFromUrl ? navigate('/') : goBack())}
          className="text-slate-900 dark:text-white flex size-10 items-center justify-center cursor-pointer"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight flex-1 text-center font-display">
          NutriSemed
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/public/calculator')}
            className="flex size-10 items-center justify-center cursor-pointer text-slate-900 dark:text-white"
            title="Calculadora pública"
          >
            <span className="material-symbols-outlined">calculate</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex size-10 items-center justify-end cursor-pointer text-slate-900 dark:text-white"
            disabled={!menu}
            title="Baixar PDF"
          >
            <span className="material-symbols-outlined">calendar_month</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center">
        {loadingMenu ? (
          <div className="flex items-center justify-center py-20 w-full">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="w-8 h-8 border-3 border-slate-300 border-t-primary rounded-full animate-spin"></div>
              <span>Carregando cardápio...</span>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 w-full max-w-md">
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
            <div
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-xl flex flex-col overflow-hidden min-h-[580px] border border-slate-200 dark:border-slate-700"
              style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="pt-8 pb-6 px-8 text-center border-b border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-primary font-semibold text-sm uppercase tracking-widest mb-1">Menu do Dia</p>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white capitalize">{currentDayTitle}</h1>
                {selectedSchool?.name && (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{selectedSchool.name}</p>
                )}
                {weekLabel && (
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Semana: {weekLabel}</p>
                )}
              </div>

              <div className="flex-1 p-8 space-y-8">
                {currentMealsByType.map((mealSection) => (
                  <section key={mealSection.key}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined text-primary filled">{mealSection.icon}</span>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{mealSection.label}</h3>
                    </div>
                    <ul className="space-y-4">
                      {mealSection.items.map((desc, idx) => (
                        <li key={`${mealSection.key}-${idx}`} className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-slate-400 text-sm mt-1">fiber_manual_record</span>
                          <p className="text-slate-700 dark:text-slate-300">{desc}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}

                {currentMealsByType.length === 0 && (
                  <section>
                    <p className="text-slate-500 dark:text-slate-400">Nenhum item registrado para este dia.</p>
                  </section>
                )}
              </div>

              <div className="bg-primary/5 dark:bg-primary/10 px-8 py-5 border-t border-slate-100 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Informação Nutricional</h4>
                <div className="flex flex-wrap gap-3">
                  <div className="bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">Kcal</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">-</span>
                  </div>
                  <div className="bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">Prot</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">-</span>
                  </div>
                  <div className="bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">Carbs</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">-</span>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 right-0">
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderStyle: 'solid',
                    borderWidth: '0 0 40px 40px',
                    borderColor: 'transparent transparent #e2e8f0 transparent',
                    filter: 'drop-shadow(-2px -2px 2px rgba(0,0,0,0.05))',
                  }}
                />
                <div className="absolute bottom-2 right-2 text-slate-400 pointer-events-none">
                  <span className="material-symbols-outlined text-sm">keyboard_double_arrow_right</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              {groupedItems.map((_, idx) => (
                <button
                  key={`dot-${idx}`}
                  onClick={() => setCurrentDayIndex(idx)}
                  className={`size-2 rounded-full ${idx === currentDayIndex ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                  aria-label={`Ir para dia ${idx + 1}`}
                />
              ))}
            </div>
            <p className="mt-4 text-slate-400 text-xs font-medium uppercase tracking-widest text-center">
              Deslize para ver o próximo dia
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => navigateDay('prev')}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900"
              >
                Dia anterior
              </button>
              <button
                onClick={() => navigateDay('next')}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900"
              >
                Próximo dia
              </button>
            </div>
            <div className="mt-6 text-center">
              <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">Material elaborado por</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {menu?.author_name || 'Nutricionista responsável não informada'}
              </p>
              {menu?.author_crn && (
                <p className="text-xs text-slate-500 dark:text-slate-400">CRN: {menu.author_crn}</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default PublicMenu;
