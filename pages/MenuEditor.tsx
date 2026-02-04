import React, { useEffect, useMemo, useState } from 'react';
import { bulkMenuItems, createMenu, exportMenuPdf, exportMenusCsv, getMenus, getSchools, getStock, publishMenu, updateMenu } from '../api';

const days = [
  { key: 'MON', label: 'Seg', dateLabel: 'Segunda-feira' },
  { key: 'TUE', label: 'Ter', dateLabel: 'Terca-feira' },
  { key: 'WED', label: 'Qua', dateLabel: 'Quarta-feira' },
  { key: 'THU', label: 'Qui', dateLabel: 'Quinta-feira' },
  { key: 'FRI', label: 'Sex', dateLabel: 'Sexta-feira' },
] as const;

const mealSlots = [
  { key: 'BREAKFAST1', label: 'Desjejum', icon: 'wb_sunny' },
  { key: 'SNACK1', label: 'Lanche', icon: 'bakery_dining' },
  { key: 'LUNCH', label: 'Almoço', icon: 'restaurant' },
  { key: 'SNACK2', label: 'Lanche', icon: 'emoji_food_beverage' },
  { key: 'BREAKFAST2', label: 'Desjejum', icon: 'free_breakfast' },
  { key: 'DINNER_COFFEE', label: 'Café da noite', icon: 'nights_stay' },
] as const;

type DayKey = typeof days[number]['key'];
type MealKey = typeof mealSlots[number]['key'];

type MealContent = {
  meal_name: string;
  portion_text: string;
  image_url: string;
  image_data: string;
  description: string;
};

type DayContent = Record<MealKey, MealContent>;
type WeekContent = Record<DayKey, DayContent>;

const emptyMeal = (): MealContent => ({
  meal_name: '',
  portion_text: '',
  image_url: '',
  image_data: '',
  description: '',
});

const createEmptyDay = (): DayContent => ({
  BREAKFAST1: emptyMeal(),
  SNACK1: emptyMeal(),
  LUNCH: emptyMeal(),
  SNACK2: emptyMeal(),
  BREAKFAST2: emptyMeal(),
  DINNER_COFFEE: emptyMeal(),
});

const createEmptyWeek = (): WeekContent => ({
  MON: createEmptyDay(),
  TUE: createEmptyDay(),
  WED: createEmptyDay(),
  THU: createEmptyDay(),
  FRI: createEmptyDay(),
});

const MenuEditor: React.FC = () => {
  const [stockItems, setStockItems] = useState<Array<{ id: string; name: string; unit: string; quantity: number }>>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [activeDay, setActiveDay] = useState<DayKey>('MON');
  const [items, setItems] = useState<WeekContent>(createEmptyWeek());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSchools()
      .then((data) => {
        setSchools(data);
        if (data.length) setSelectedSchool(data[0].id);
      })
      .catch(() => setError('Nao foi possivel carregar as escolas.'));

    getStock()
      .then((data) => {
        const parsed = data.map((entry: any) => ({
          id: entry.supply.id,
          name: entry.supply.name,
          unit: entry.supply.unit,
          quantity: Number(entry.quantity),
        }));
        setStockItems(parsed);
      })
      .catch(() => setError('Nao foi possivel carregar os produtos do inventario.'));
  }, []);

  useEffect(() => {
    if (!selectedSchool || !weekStart) return;
    setError('');
    getMenus({ school: selectedSchool, week_start: weekStart })
      .then((data) => {
        if (!data.length) {
          setMenuId(null);
          setStatus('DRAFT');
          setNotes('');
          setItems(createEmptyWeek());
          return;
        }
        loadMenu(data[0]);
      })
      .catch(() => setError('Nao foi possivel carregar o cardapio.'));
  }, [selectedSchool, weekStart]);

  const loadMenu = (menu: any) => {
    setMenuId(menu.id);
    setStatus(menu.status);
    setWeekStart(menu.week_start);
    setWeekEnd(menu.week_end);
    setNotes(menu.notes || '');

    const nextItems = createEmptyWeek();
    menu.items.forEach((item: any) => {
      const day = item.day_of_week as DayKey;
      if (!nextItems[day]) return;

      let slotKey = item.meal_type as MealKey;
      if (slotKey === 'BREAKFAST') slotKey = 'BREAKFAST1';
      if (slotKey === 'SNACK') slotKey = 'SNACK1';
      if (!nextItems[day][slotKey]) return;

      nextItems[day][slotKey] = {
        meal_name: item.meal_name || '',
        portion_text: item.portion_text || '',
        image_url: item.image_url || '',
        image_data: item.image_data || '',
        description: item.description || '',
      };
    });
    setItems(nextItems);
  };

  const handleSearch = async () => {
    if (!selectedSchool) return;
    setError('');
    try {
      const data = await getMenus({
        school: selectedSchool,
        date_from: filterFrom || undefined,
        date_to: filterTo || undefined,
        status: filterStatus || undefined,
      });
      setResults(data);
    } catch {
      setError('Nao foi possivel buscar cardapios.');
    }
  };

  const weekLabel = useMemo(() => {
    if (!weekStart || !weekEnd) return 'Selecione a semana';
    return `${weekStart} - ${weekEnd}`;
  }, [weekStart, weekEnd]);

  const updateMealField = (mealKey: MealKey, field: keyof MealContent, value: string) => {
    setItems((prev) => ({
      ...prev,
      [activeDay]: {
        ...prev[activeDay],
        [mealKey]: {
          ...prev[activeDay][mealKey],
          [field]: value,
        },
      },
    }));
  };

  const appendStockItem = (mealKey: MealKey, supplyName: string, supplyUnit: string) => {
    const quantityInput = window.prompt(`Informe a porcao de ${supplyName} (${supplyUnit}):`, '1');
    if (quantityInput === null) return;

    const parsedQuantity = Number(quantityInput.replace(',', '.'));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Porcao invalida. Informe um valor maior que zero.');
      return;
    }

    const current = items[activeDay][mealKey].description.trim();
    const exists = current
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .some((token) => token.startsWith(`${supplyName.toLowerCase()} (`) || token === supplyName.toLowerCase());
    if (exists) return;

    const foodWithPortion = `${supplyName} (${parsedQuantity}${supplyUnit})`;
    const nextValue = current ? `${current}, ${foodWithPortion}` : foodWithPortion;
    updateMealField(mealKey, 'description', nextValue);
    setError('');
  };

  const handleImageUpload = (mealKey: MealKey, file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      updateMealField(mealKey, 'image_data', value);
      updateMealField(mealKey, 'image_url', '');
    };
    reader.readAsDataURL(file);
  };

  const clearMealImage = (mealKey: MealKey) => {
    updateMealField(mealKey, 'image_data', '');
    updateMealField(mealKey, 'image_url', '');
  };

  const buildPayloadItems = () => {
    const payload: Array<{
      day_of_week: DayKey;
      meal_type: MealKey;
      meal_name: string;
      portion_text: string;
      image_url: string;
      image_data: string;
      description: string;
    }> = [];

    days.forEach((day) => {
      mealSlots.forEach((slot) => {
        const content = items[day.key][slot.key];
        if (!content.description && !content.meal_name && !content.portion_text && !content.image_data && !content.image_url) {
          return;
        }
        payload.push({
          day_of_week: day.key,
          meal_type: slot.key,
          meal_name: content.meal_name,
          portion_text: content.portion_text,
          image_url: content.image_url,
          image_data: content.image_data,
          description: content.description,
        });
      });
    });

    return payload;
  };

  const ensureMenu = async () => {
    if (menuId) {
      await updateMenu(menuId, {
        week_start: weekStart,
        week_end: weekEnd,
        status: 'DRAFT',
        notes,
      });
      return menuId;
    }

    const menu = await createMenu({
      school: selectedSchool,
      week_start: weekStart,
      week_end: weekEnd,
      status: 'DRAFT',
      notes,
    });
    setMenuId(menu.id);
    setStatus(menu.status);
    return menu.id;
  };

  const handleSave = async () => {
    if (!selectedSchool || !weekStart || !weekEnd) {
      setError('Selecione escola e semana.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const id = await ensureMenu();
      await bulkMenuItems(id, buildPayloadItems());
      setStatus('DRAFT');
    } catch {
      setError('Nao foi possivel salvar o cardapio.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedSchool || !weekStart || !weekEnd) {
      setError('Selecione escola e semana.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const id = await ensureMenu();
      await bulkMenuItems(id, buildPayloadItems());
      await publishMenu(id);
      setStatus('PUBLISHED');
    } catch {
      setError('Nao foi possivel publicar o cardapio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 pb-28">
      <div className="px-4 pt-4 flex flex-col gap-3">
        <div className="flex flex-col">
          <label className="flex flex-col flex-1">
            <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Escola</p>
            <div className="relative">
              <select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal">
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#4c739a]">
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>
          </label>
        </div>

        <div className="flex flex-col">
          <label className="flex flex-col flex-1">
            <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Semana</p>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal" />
              <input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal" />
            </div>
          </label>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Filtros avancados</p>
          <div className="grid grid-cols-2 gap-3">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal">
              <option value="">Status (todos)</option>
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
            </select>
            <button onClick={handleSearch} className="h-12 rounded-xl bg-primary text-white font-bold text-sm">Buscar</button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal" />
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal" />
          </div>
          <div className="flex gap-3 mt-3">
            <button onClick={() => exportMenusCsv()} className="flex-1 h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold">Exportar CSV</button>
            <button onClick={() => {
              if (!selectedSchool || !weekStart) return;
              exportMenuPdf(selectedSchool, weekStart);
            }} className="flex-1 h-10 rounded-lg bg-primary/10 text-primary text-sm font-semibold">Exportar PDF</button>
          </div>
          {results.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {results.map((menu) => (
                <button key={menu.id} onClick={() => loadMenu(menu)} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm">
                  <span>{menu.school_name} • {menu.week_start} - {menu.week_end}</span>
                  <span className="text-xs font-bold text-slate-500">{menu.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 mt-3">
        <div className="flex flex-1 items-center justify-between gap-4 rounded-xl border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className={`flex size-2 rounded-full ${status === 'PUBLISHED' ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`}></span>
              <p className="text-[#0d141b] dark:text-white text-base font-bold leading-tight">Status: {status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}</p>
            </div>
            <p className="text-[#4c739a] dark:text-slate-400 text-xs font-normal leading-normal">{weekLabel}</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Descricao livre do cardapio</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-[#0d141b] dark:text-white text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[90px]"
            placeholder="Observacoes gerais, substituicoes e orientacoes para a escola."
          />
        </div>
      </div>

      <div className="bg-white dark:bg-background-dark sticky top-[73px] z-30 border-b border-[#cfdbe7] dark:border-slate-800 shadow-sm mt-4">
        <div className="flex px-4 gap-2 overflow-x-auto no-scrollbar">
          {days.map((day) => (
            <button key={day.key} onClick={() => setActiveDay(day.key)} className={`flex flex-col items-center justify-center border-b-[3px] pb-2 pt-4 min-w-[65px] ${activeDay === day.key ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}>
              <p className="text-xs font-bold uppercase tracking-wider">{day.label}</p>
              <p className="text-[11px] font-medium opacity-70">{day.dateLabel}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 flex flex-col gap-6 mt-4">
        {mealSlots.map((slot) => {
          const meal = items[activeDay][slot.key];
          return (
            <div key={slot.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-xl">{slot.icon}</span>
                  <h3 className="font-bold text-sm uppercase tracking-wider">{slot.label}</h3>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {stockItems.map((stockItem) => (
                  <button
                    key={`${stockItem.id}-${slot.key}`}
                    type="button"
                    onClick={() => appendStockItem(slot.key, stockItem.name, stockItem.unit)}
                    className="px-2.5 py-1 rounded-full text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-primary hover:text-primary"
                  >
                    {stockItem.name} ({stockItem.quantity}{stockItem.unit})
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input value={meal.meal_name} onChange={(e) => updateMealField(slot.key, 'meal_name', e.target.value)} className="h-10 rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" placeholder="Nome da refeicao" />
                <input value={meal.portion_text} onChange={(e) => updateMealField(slot.key, 'portion_text', e.target.value)} className="h-10 rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" placeholder="Porcao (ex: 200g)" />
                <label className="h-10 rounded-lg border border-dashed border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm flex items-center cursor-pointer">
                  Upload da imagem
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(slot.key, e.target.files?.[0])} />
                </label>
              </div>

              {(meal.image_data || meal.image_url) && (
                <div className="flex items-center gap-3">
                  <img src={meal.image_data || meal.image_url} alt={meal.meal_name || slot.label} className="h-16 w-24 object-cover rounded-lg border border-slate-200" />
                  <button type="button" onClick={() => clearMealImage(slot.key)} className="text-sm text-red-600 underline">Remover imagem</button>
                </div>
              )}

              <textarea
                value={meal.description}
                onChange={(e) => updateMealField(slot.key, 'description', e.target.value)}
                className="w-full rounded-xl border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-[#0d141b] dark:text-white text-base focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[90px] shadow-sm"
                placeholder="Descricao dos alimentos/ingredientes."
              />
            </div>
          );
        })}
      </div>

      {error && <div className="px-4 mt-4 text-red-600 text-sm">{error}</div>}

      <div className="fixed bottom-0 left-0 right-0 md:left-auto md:w-[calc(100%-120px)] bg-white dark:bg-background-dark border-t border-slate-200 dark:border-slate-800 p-4 flex gap-3 shadow-[0_-8px_20px_rgba(0,0,0,0.08)] z-40 mb-20 md:mb-0">
        <button disabled={saving} onClick={handleSave} className="flex-1 h-12 rounded-xl border border-primary text-primary font-bold text-sm flex items-center justify-center gap-2 active:bg-primary/10 transition-colors disabled:opacity-60">
          <span className="material-symbols-outlined text-lg">save</span>
          Salvar Rascunho
        </button>
        <button disabled={saving} onClick={handlePublish} className="flex-1 h-12 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:opacity-90 shadow-lg shadow-primary/20 transition-all disabled:opacity-60">
          <span className="material-symbols-outlined text-lg">publish</span>
          Publicar
        </button>
      </div>
    </div>
  );
};

export default MenuEditor;
