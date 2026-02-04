import React, { useEffect, useMemo, useState } from 'react';
import { bulkMenuItems, createMenu, exportMenuPdf, exportMenusCsv, getMenus, getSchools, getStock, publishMenu, updateMenu } from '../api';

const days = [
  { key: 'MON', label: 'Seg', dateLabel: 'Segunda-feira' },
  { key: 'TUE', label: 'Ter', dateLabel: 'Terca-feira' },
  { key: 'WED', label: 'Qua', dateLabel: 'Quarta-feira' },
  { key: 'THU', label: 'Qui', dateLabel: 'Quinta-feira' },
  { key: 'FRI', label: 'Sex', dateLabel: 'Sexta-feira' },
];

type DayContent = {
  breakfast: string;
  lunch: string;
  snack: string;
};

const emptyDay: DayContent = { breakfast: '', lunch: '', snack: '' };

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
  const [activeDay, setActiveDay] = useState('MON');
  const [items, setItems] = useState<Record<string, DayContent>>({
    MON: { ...emptyDay },
    TUE: { ...emptyDay },
    WED: { ...emptyDay },
    THU: { ...emptyDay },
    FRI: { ...emptyDay },
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSchools()
      .then((data) => {
        setSchools(data);
        if (data.length) {
          setSelectedSchool(data[0].id);
        }
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
          setItems({
            MON: { ...emptyDay },
            TUE: { ...emptyDay },
            WED: { ...emptyDay },
            THU: { ...emptyDay },
            FRI: { ...emptyDay },
          });
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
    const nextItems: Record<string, DayContent> = {
      MON: { ...emptyDay },
      TUE: { ...emptyDay },
      WED: { ...emptyDay },
      THU: { ...emptyDay },
      FRI: { ...emptyDay },
    };
    menu.items.forEach((item: any) => {
      const day = item.day_of_week;
      if (!nextItems[day]) return;
      if (item.meal_type === 'BREAKFAST') nextItems[day].breakfast = item.description;
      if (item.meal_type === 'LUNCH') nextItems[day].lunch = item.description;
      if (item.meal_type === 'SNACK') nextItems[day].snack = item.description;
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

  const updateDay = (key: keyof DayContent, value: string) => {
    setItems((prev) => ({
      ...prev,
      [activeDay]: { ...prev[activeDay], [key]: value },
    }));
  };

  const appendStockItem = (mealKey: keyof DayContent, supplyName: string, supplyUnit: string) => {
    const quantityInput = window.prompt(`Informe a quantidade de ${supplyName} (${supplyUnit}):`, '1');
    if (quantityInput === null) return;
    const parsedQuantity = Number(quantityInput.replace(',', '.'));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Quantidade invalida. Informe um valor maior que zero.');
      return;
    }

    const current = items[activeDay][mealKey].trim();
    const exists = current
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .some((token) => token.startsWith(`${supplyName.toLowerCase()} (`) || token === supplyName.toLowerCase());
    if (exists) return;
    const foodWithPortion = `${supplyName} (${parsedQuantity}${supplyUnit})`;
    const nextValue = current ? `${current}, ${foodWithPortion}` : foodWithPortion;
    updateDay(mealKey, nextValue);
    setError('');
  };

  const buildPayloadItems = () => {
    const payload: Array<{ day_of_week: string; meal_type: string; description: string }> = [];
    Object.entries(items).forEach(([day, content]) => {
      if (content.breakfast) payload.push({ day_of_week: day, meal_type: 'BREAKFAST', description: content.breakfast });
      if (content.lunch) payload.push({ day_of_week: day, meal_type: 'LUNCH', description: content.lunch });
      if (content.snack) payload.push({ day_of_week: day, meal_type: 'SNACK', description: content.snack });
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
      const payload = buildPayloadItems();
      await bulkMenuItems(id, payload);
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
      const payload = buildPayloadItems();
      await bulkMenuItems(id, payload);
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-xl">coffee</span>
              <h3 className="font-bold text-sm uppercase tracking-wider">Café da Manhã</h3>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {stockItems.map((stockItem) => (
              <button key={`${stockItem.id}-breakfast`} type="button" onClick={() => appendStockItem('breakfast', stockItem.name, stockItem.unit)} className="px-2.5 py-1 rounded-full text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-primary hover:text-primary">
                {stockItem.name} ({stockItem.quantity}{stockItem.unit})
              </button>
            ))}
          </div>
          <textarea value={items[activeDay].breakfast} onChange={(e) => updateDay('breakfast', e.target.value)} className="w-full rounded-xl border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-[#0d141b] dark:text-white text-base focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[90px] shadow-sm" placeholder="Ex: Leite com cacau, pão integral e fruta."></textarea>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-xl">restaurant</span>
              <h3 className="font-bold text-sm uppercase tracking-wider">Almoço</h3>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {stockItems.map((stockItem) => (
              <button key={`${stockItem.id}-lunch`} type="button" onClick={() => appendStockItem('lunch', stockItem.name, stockItem.unit)} className="px-2.5 py-1 rounded-full text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-primary hover:text-primary">
                {stockItem.name} ({stockItem.quantity}{stockItem.unit})
              </button>
            ))}
          </div>
          <textarea value={items[activeDay].lunch} onChange={(e) => updateDay('lunch', e.target.value)} className="w-full rounded-xl border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-[#0d141b] dark:text-white text-base focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[110px] shadow-sm" placeholder="Ex: Arroz, feijão, frango e salada."></textarea>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-xl">restaurant_menu</span>
              <h3 className="font-bold text-sm uppercase tracking-wider">Lanche</h3>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {stockItems.map((stockItem) => (
              <button key={`${stockItem.id}-snack`} type="button" onClick={() => appendStockItem('snack', stockItem.name, stockItem.unit)} className="px-2.5 py-1 rounded-full text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-primary hover:text-primary">
                {stockItem.name} ({stockItem.quantity}{stockItem.unit})
              </button>
            ))}
          </div>
          <textarea value={items[activeDay].snack} onChange={(e) => updateDay('snack', e.target.value)} className="w-full rounded-xl border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-[#0d141b] dark:text-white text-base focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[90px] shadow-sm" placeholder="Ex: Suco e biscoito."></textarea>
        </div>
      </div>

      {error && (
        <div className="px-4 mt-4 text-red-600 text-sm">{error}</div>
      )}

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
