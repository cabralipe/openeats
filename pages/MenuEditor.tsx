import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  bulkMenuItems,
  copyMenu,
  createMenu,
  exportMenuPdf,
  exportMenusCsv,
  getRecipes,
  getMenus,
  getPublicLink,
  getSchools,
  getStock,
  publishMenu,
  updateMenu,
} from '../api';

const days = [
  { key: 'MON', label: 'Seg', fullLabel: 'Segunda-feira' },
  { key: 'TUE', label: 'Ter', fullLabel: 'Terca-feira' },
  { key: 'WED', label: 'Qua', fullLabel: 'Quarta-feira' },
  { key: 'THU', label: 'Qui', fullLabel: 'Quinta-feira' },
  { key: 'FRI', label: 'Sex', fullLabel: 'Sexta-feira' },
] as const;

const mealSlots = [
  { key: 'BREAKFAST1', label: 'Desjejum', icon: 'wb_sunny' },
  { key: 'SNACK1', label: 'Lanche manha', icon: 'bakery_dining' },
  { key: 'LUNCH', label: 'Almoco', icon: 'restaurant' },
  { key: 'BREAKFAST2', label: 'Desjejum 2', icon: 'free_breakfast' },
  { key: 'SNACK2', label: 'Lanche tarde', icon: 'emoji_food_beverage' },
  { key: 'DINNER_COFFEE', label: 'Cafe da noite', icon: 'nights_stay' },
] as const;

type DayKey = typeof days[number]['key'];
type MealKey = typeof mealSlots[number]['key'];

type MealContent = {
  meal_name: string;
  portion_text: string;
  image_url: string;
  image_data: string;
  description: string;
  recipe: string | null;
  calc_mode: 'FREE_TEXT' | 'RECIPE';
};

type DayContent = Record<MealKey, MealContent>;
type WeekContent = Record<DayKey, DayContent>;

type WizardStep = 1 | 2 | 3;

const emptyMeal = (): MealContent => ({
  meal_name: '',
  portion_text: '',
  image_url: '',
  image_data: '',
  description: '',
  recipe: null,
  calc_mode: 'FREE_TEXT',
});

const createEmptyDay = (): DayContent => ({
  BREAKFAST1: emptyMeal(),
  SNACK1: emptyMeal(),
  LUNCH: emptyMeal(),
  BREAKFAST2: emptyMeal(),
  SNACK2: emptyMeal(),
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
  const location = useLocation();
  const navigate = useNavigate();
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [stockItems, setStockItems] = useState<Array<{ id: string; name: string; unit: string; quantity: number }>>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [menuName, setMenuName] = useState('');
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
  const [activeMeal, setActiveMeal] = useState<MealKey>('LUNCH');
  const [items, setItems] = useState<WeekContent>(createEmptyWeek());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishedMenuSchool, setPublishedMenuSchool] = useState<string>('');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyTargetSchools, setCopyTargetSchools] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<{ count: number } | null>(null);

  // Nutritionist authorship modal state
  const NUTRITIONISTS_KEY = 'openeats_nutritionists';
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [savedNutritionists, setSavedNutritionists] = useState<Array<{ name: string; crn: string }>>([]);
  const [selectedNutritionist, setSelectedNutritionist] = useState<number | 'new'>('new');
  const [newNutName, setNewNutName] = useState('');
  const [newNutCrn, setNewNutCrn] = useState('');

  const deepLinkParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    getSchools()
      .then((data) => {
        setSchools(data);
        if (data.length) {
          setSelectedSchool((prev) => prev || data[0].id);
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

    getRecipes({ active: true })
      .then((data) => setRecipes(Array.isArray(data) ? data : []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!schools.length) return;

    const schoolFromUrl = deepLinkParams.get('school');
    const weekStartFromUrl = deepLinkParams.get('week_start');
    const weekEndFromUrl = deepLinkParams.get('week_end');

    if (schoolFromUrl && schools.some((school) => school.id === schoolFromUrl)) {
      setSelectedSchool(schoolFromUrl);
    }
    if (weekStartFromUrl) {
      setWeekStart(weekStartFromUrl);
    }
    if (weekEndFromUrl) {
      setWeekEnd(weekEndFromUrl);
    }
  }, [deepLinkParams, schools]);

  useEffect(() => {
    if (!selectedSchool || !weekStart) return;
    setError('');
    getMenus({ school: selectedSchool, week_start: weekStart })
      .then((data) => {
        if (!data.length) {
          setMenuId(null);
          setStatus('DRAFT');
          setMenuName('');
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
    setMenuName(menu.name || '');
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
        recipe: item.recipe || null,
        calc_mode: item.recipe ? 'RECIPE' : ((item.calc_mode || 'FREE_TEXT') as 'FREE_TEXT' | 'RECIPE'),
      };
    });

    setItems(nextItems);
    setWizardStep(2);
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

  /** Given any date string, compute the Monday of that ISO week (Mon=1). */
  const getMonday = (dateStr: string): string => {
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    const dayOfWeek = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    return monday.toISOString().slice(0, 10);
  };

  const getFriday = (mondayStr: string): string => {
    const d = new Date(`${mondayStr}T12:00:00`);
    d.setDate(d.getDate() + 4);
    return d.toISOString().slice(0, 10);
  };

  const handleDateChange = (dateStr: string) => {
    if (!dateStr) {
      setWeekStart('');
      setWeekEnd('');
      return;
    }
    const monday = getMonday(dateStr);
    const friday = getFriday(monday);
    setWeekStart(monday);
    setWeekEnd(friday);
  };

  const getWeekDateLabel = (dayIndex: number) => {
    if (!weekStart) return '--';
    const base = new Date(`${weekStart}T12:00:00`);
    if (Number.isNaN(base.getTime())) return '--';
    const target = new Date(base);
    target.setDate(base.getDate() + dayIndex);
    return String(target.getDate()).padStart(2, '0');
  };

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

  const mealHasContent = (content: MealContent) => {
    return Boolean(content.description || content.meal_name || content.portion_text || content.image_data || content.image_url || content.recipe);
  };

  const getIngredients = (description: string) => {
    return description
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);
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

  const removeIngredientToken = (mealKey: MealKey, tokenToRemove: string) => {
    const current = getIngredients(items[activeDay][mealKey].description);
    const next = current.filter((token) => token !== tokenToRemove).join(', ');
    updateMealField(mealKey, 'description', next);
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

  const handleRecipeSelect = (mealKey: MealKey, recipeId: string) => {
    const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);
    setItems((prev) => ({
      ...prev,
      [activeDay]: {
        ...prev[activeDay],
        [mealKey]: {
          ...prev[activeDay][mealKey],
          recipe: recipeId || null,
          calc_mode: recipeId ? 'RECIPE' : 'FREE_TEXT',
          description: recipeId && selectedRecipe && !prev[activeDay][mealKey].description
            ? (selectedRecipe.ingredients || []).map((ing: any) => ing.supply_name).filter(Boolean).join(', ')
            : prev[activeDay][mealKey].description,
        },
      },
    }));
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
      recipe: string | null;
      calc_mode: 'FREE_TEXT' | 'RECIPE';
    }> = [];

    days.forEach((day) => {
      mealSlots.forEach((slot) => {
        const content = items[day.key][slot.key];
        if (!mealHasContent(content)) return;
        payload.push({
          day_of_week: day.key,
          meal_type: slot.key,
          meal_name: content.meal_name,
          portion_text: content.portion_text,
          image_url: content.image_url,
          image_data: content.image_data,
          description: content.description,
          recipe: content.recipe,
          calc_mode: content.recipe ? 'RECIPE' : content.calc_mode,
        });
      });
    });

    return payload;
  };

  const ensureMenu = async () => {
    if (menuId) {
      await updateMenu(menuId, {
        name: menuName,
        week_start: weekStart,
        week_end: weekEnd,
        status: 'DRAFT',
        notes,
      });
      return menuId;
    }

    const menu = await createMenu({
      school: selectedSchool,
      name: menuName,
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
    } catch (err: any) {
      const msg = err?.message || 'Nao foi possivel salvar o cardapio.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const openPublishModal = () => {
    if (!selectedSchool || !weekStart || !weekEnd) {
      setError('Selecione escola e semana.');
      return;
    }
    // Load saved nutritionists from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem(NUTRITIONISTS_KEY) || '[]');
      setSavedNutritionists(Array.isArray(stored) ? stored : []);
    } catch {
      setSavedNutritionists([]);
    }
    setSelectedNutritionist('new');
    setNewNutName('');
    setNewNutCrn('');
    setShowPublishModal(true);
  };

  const handlePublish = async () => {
    // Determine author info
    let authorName = '';
    let authorCrn = '';
    if (selectedNutritionist === 'new') {
      if (!newNutName.trim()) {
        setError('Informe o nome da nutricionista.');
        return;
      }
      authorName = newNutName.trim();
      authorCrn = newNutCrn.trim();
      // Save to localStorage
      const updated = [...savedNutritionists, { name: authorName, crn: authorCrn }];
      localStorage.setItem(NUTRITIONISTS_KEY, JSON.stringify(updated));
      setSavedNutritionists(updated);
    } else {
      const nut = savedNutritionists[selectedNutritionist];
      if (nut) {
        authorName = nut.name;
        authorCrn = nut.crn;
      }
    }

    setShowPublishModal(false);
    setSaving(true);
    setError('');
    try {
      const id = await ensureMenu();
      await bulkMenuItems(id, buildPayloadItems());
      // Save author info
      await updateMenu(id, { author_name: authorName, author_crn: authorCrn });
      await publishMenu(id);
      setStatus('PUBLISHED');
      setPublishedMenuSchool(selectedSchool);
      setPublishSuccess(true);

      // After 3.5 seconds, redirect to public menu view
      setTimeout(async () => {
        try {
          const linkData = await getPublicLink(selectedSchool) as any;
          const slug = linkData?.slug || linkData?.public_slug || '';
          const token = linkData?.token || linkData?.public_token || '';
          if (slug) {
            navigate(`/public/menu?slug=${slug}&token=${token}`);
          } else {
            setPublishSuccess(false);
            setWizardStep(3);
          }
        } catch {
          setPublishSuccess(false);
          setWizardStep(3);
        }
      }, 3500);
    } catch (err: any) {
      const msg = err?.message || 'Nao foi possivel publicar o cardapio.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const filledCount = useMemo(() => {
    let count = 0;
    days.forEach((day) => {
      mealSlots.forEach((slot) => {
        if (mealHasContent(items[day.key][slot.key])) count += 1;
      });
    });
    return count;
  }, [items]);

  const totalSlots = days.length * mealSlots.length;
  const completionPercent = Math.round((filledCount / totalSlots) * 100);

  const daySummary = useMemo(() => {
    return days.map((day) => {
      const done = mealSlots.filter((slot) => mealHasContent(items[day.key][slot.key])).length;
      return { day: day.key, done, total: mealSlots.length };
    });
  }, [items]);

  const selectedMeal = items[activeDay][activeMeal];
  const selectedSchoolName = schools.find((school) => school.id === selectedSchool)?.name || 'Selecione uma escola';
  const activeMealLabel = mealSlots.find((slot) => slot.key === activeMeal)?.label || '';

  const openRecipesShortcut = () => {
    const params = new URLSearchParams();
    const firstIngredientHint = getIngredients(selectedMeal.description)[0] || '';
    const searchSeed = selectedMeal.meal_name.trim() || firstIngredientHint;
    if (searchSeed) params.set('search', searchSeed);
    if (activeMealLabel) params.set('category', activeMealLabel);
    params.set('active', 'true');

    const targetPath = `/admin/recipes${params.toString() ? `?${params.toString()}` : ''}`;
    const popup = typeof window !== 'undefined'
      ? window.open(`#${targetPath}`, '_blank', 'noopener,noreferrer')
      : null;
    if (!popup) navigate(targetPath);
  };

  const nextStep = () => {
    if (wizardStep === 1) {
      const missing: string[] = [];
      if (!selectedSchool) missing.push('Escola');
      if (!menuName.trim()) missing.push('Nome do cardapio');
      if (!weekStart || !weekEnd) missing.push('Periodo (datas)');
      if (missing.length > 0) {
        setError(`Preencha os campos obrigatorios: ${missing.join(', ')}`);
        return;
      }
      setError('');
      setWizardStep(2);
      return;
    }
    if (wizardStep === 2) {
      setWizardStep(3);
    }
  };

  const previousStep = () => {
    setWizardStep((prev) => (prev > 1 ? ((prev - 1) as WizardStep) : prev));
  };

  const toggleCopySchool = (schoolId: string) => {
    setCopyTargetSchools((prev) =>
      prev.includes(schoolId) ? prev.filter((id) => id !== schoolId) : [...prev, schoolId]
    );
  };

  const handleCopy = async () => {
    if (!menuId || copyTargetSchools.length === 0) return;
    setCopying(true);
    setError('');
    try {
      // Save current state first
      const id = await ensureMenu();
      await bulkMenuItems(id, buildPayloadItems());
      const result = await copyMenu(id, { target_schools: copyTargetSchools }) as any;
      setCopyResult({ count: result.count || copyTargetSchools.length });
    } catch {
      setError('Não foi possível copiar o cardápio.');
    } finally {
      setCopying(false);
    }
  };

  const openCopyModal = () => {
    setCopyTargetSchools([]);
    setCopyResult(null);
    setCopying(false);
    setShowCopyModal(true);
  };

  return (
    <div className="flex flex-col flex-1 pb-28">
      <div className="px-4 lg:px-6 pt-4 lg:pt-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Editor de Cardapio</h1>
              <p className="text-xs lg:text-sm text-slate-500 mt-1">{selectedSchoolName} {weekStart && weekEnd ? `• ${weekStart} ate ${weekEnd}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${status === 'PUBLISHED' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                <span className={`w-2 h-2 rounded-full ${status === 'PUBLISHED' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                {status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex-1">
                  <div className={`h-2 rounded-full ${wizardStep >= step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className={wizardStep >= 1 ? 'text-primary' : ''}>Identificacao</span>
              <span className={wizardStep >= 2 ? 'text-primary' : ''}>Composicao</span>
              <span className={wizardStep >= 3 ? 'text-primary' : ''}>Revisao</span>
            </div>
          </div>
        </div>
      </div>

      {wizardStep === 1 && (
        <div className="px-4 lg:px-6 mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:p-5 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Identificacao</h2>

              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Escola</span>
                <select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm">
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Nome do cardapio</span>
                <input value={menuName} onChange={(e) => setMenuName(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" placeholder="Ex: Cardapio Semana 3" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Semana de</span>
                  <input type="date" value={weekStart} onChange={(e) => handleDateChange(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" />
                  <span className="text-[10px] text-slate-400 mt-1 block">Selecione qualquer dia — ajustamos para seg-sex automaticamente</span>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Até</span>
                  <input type="date" value={weekEnd} readOnly className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-500 cursor-not-allowed" />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Observacoes do cardapio</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full min-h-[110px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" placeholder="Observacoes gerais para a semana." />
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 lg:p-5 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Biblioteca de cardapios</h2>

              <div className="grid grid-cols-2 gap-3">
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm">
                  <option value="">Status (todos)</option>
                  <option value="DRAFT">Rascunho</option>
                  <option value="PUBLISHED">Publicado</option>
                </select>
                <button onClick={handleSearch} className="h-11 rounded-xl bg-primary text-white font-bold text-sm">Buscar</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" />
                <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => exportMenusCsv()} className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold">Exportar CSV</button>
                <button onClick={() => {
                  if (!selectedSchool || !weekStart) return;
                  exportMenuPdf(selectedSchool, weekStart);
                }} className="h-10 rounded-xl bg-primary/10 text-primary text-sm font-semibold">Exportar PDF</button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
                {results.length === 0 && (
                  <p className="text-xs text-slate-500">Busque cardapios para carregar uma versao existente.</p>
                )}
                {results.map((menu) => (
                  <button key={menu.id} onClick={() => loadMenu(menu)} className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 hover:border-primary/40 transition-colors">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{menu.name || menu.school_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{menu.week_start} ate {menu.week_end} • {menu.status}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {wizardStep === 2 && (
        <div className="px-4 lg:px-6 mt-4 space-y-4">
          <div className="overflow-x-auto no-scrollbar flex gap-3">
            {days.map((day, idx) => {
              const summary = daySummary.find((entry) => entry.day === day.key);
              const selected = activeDay === day.key;
              return (
                <button
                  key={day.key}
                  onClick={() => setActiveDay(day.key)}
                  className={`min-w-[76px] h-24 rounded-2xl border transition-all ${selected ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide">{day.label}</div>
                  <div className="text-2xl font-bold mt-1">{getWeekDateLabel(idx)}</div>
                  <div className={`text-[10px] mt-1 ${selected ? 'text-white/80' : 'text-slate-500'}`}>{summary?.done ?? 0}/{summary?.total ?? mealSlots.length}</div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Refeicoes do dia</h2>
              {mealSlots.map((slot) => {
                const active = activeMeal === slot.key;
                const filled = mealHasContent(items[activeDay][slot.key]);
                return (
                  <button
                    key={slot.key}
                    onClick={() => setActiveMeal(slot.key)}
                    className={`w-full rounded-2xl p-3 border flex items-center justify-between transition-all ${active ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800 hover:border-primary/40'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                        <span className="material-symbols-outlined">{slot.icon}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{slot.label}</p>
                        <p className="text-[11px] text-slate-500">{filled ? 'Preenchido' : 'Nao preenchido'}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${filled ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {filled ? 'OK' : 'Pendente'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="xl:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined">{mealSlots.find((slot) => slot.key === activeMeal)?.icon || 'restaurant'}</span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{mealSlots.find((slot) => slot.key === activeMeal)?.label}</p>
                    <p className="text-xs text-slate-500">{days.find((day) => day.key === activeDay)?.fullLabel}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block md:col-span-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Receita vinculada (opcional)</span>
                    <div className="mt-1 flex gap-2">
                      <select
                        value={selectedMeal.recipe || ''}
                        onChange={(e) => handleRecipeSelect(activeMeal, e.target.value)}
                        className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
                      >
                        <option value="">Sem receita (texto livre)</option>
                        {recipes.map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>
                            {recipe.name}{recipe.category ? ` • ${recipe.category}` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedMeal.recipe && (
                        <button
                          type="button"
                          onClick={() => handleRecipeSelect(activeMeal, '')}
                          className="px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold"
                        >
                          Limpar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={openRecipesShortcut}
                        className="px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold whitespace-nowrap"
                        title="Abrir cadastro de receitas com filtros sugeridos"
                      >
                        Gerenciar receitas
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {selectedMeal.recipe ? 'Cálculo por receita habilitado neste slot.' : 'Sem receita: cálculo usa descrição + aliases/regras.'}
                    </span>
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Nome da refeicao</span>
                    <input
                      value={selectedMeal.meal_name}
                      onChange={(e) => updateMealField(activeMeal, 'meal_name', e.target.value)}
                      className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
                      placeholder="Ex: Arroz com feijao e frango"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Porcao</span>
                    <input
                      value={selectedMeal.portion_text}
                      onChange={(e) => updateMealField(activeMeal, 'portion_text', e.target.value)}
                      className="mt-1 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
                      placeholder="Ex: 250g"
                    />
                  </label>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Ingredientes rapidos</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {stockItems.slice(0, 24).map((stockItem) => (
                      <button
                        key={`${stockItem.id}-${activeMeal}`}
                        type="button"
                        onClick={() => appendStockItem(activeMeal, stockItem.name, stockItem.unit)}
                        className="px-3 py-1.5 rounded-full text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-primary hover:text-primary"
                      >
                        {stockItem.name}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 min-h-[48px] flex flex-wrap gap-2">
                    {getIngredients(selectedMeal.description).length === 0 && (
                      <p className="text-xs text-slate-400">Adicione ingredientes pelos botoes acima ou digite na descricao.</p>
                    )}
                    {getIngredients(selectedMeal.description).map((token) => (
                      <span key={token} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                        {token}
                        <button type="button" onClick={() => removeIngredientToken(activeMeal, token)}>
                          <span className="material-symbols-outlined text-sm leading-none">close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <div className="md:col-span-2">
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Descricao</span>
                      <textarea
                        value={selectedMeal.description}
                        onChange={(e) => updateMealField(activeMeal, 'description', e.target.value)}
                        className="mt-1 w-full min-h-[120px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                        placeholder="Descreva ingredientes, preparo e observacoes da refeicao."
                      />
                    </label>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Imagem</p>
                    <label className="mt-1 flex items-center justify-center h-[120px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 cursor-pointer hover:border-primary/40">
                      <div className="text-center">
                        <span className="material-symbols-outlined text-3xl text-slate-400">add_a_photo</span>
                        <p className="text-xs text-slate-500 mt-1">Upload</p>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(activeMeal, e.target.files?.[0])} />
                    </label>

                    {(selectedMeal.image_data || selectedMeal.image_url) && (
                      <div className="mt-2 flex items-center gap-2">
                        <img src={selectedMeal.image_data || selectedMeal.image_url} alt={selectedMeal.meal_name || 'Imagem da refeicao'} className="h-14 w-20 rounded-lg object-cover border border-slate-200" />
                        <button type="button" onClick={() => clearMealImage(activeMeal)} className="text-xs text-red-600 underline">Remover</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {wizardStep === 3 && (
        <div className="px-4 lg:px-6 mt-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Revisao do cardapio</h2>
            <p className="text-sm text-slate-500 mt-1">Valide preenchimento, periodo e publique quando estiver pronto.</p>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <p className="text-xs text-slate-500 uppercase font-bold">Slots preenchidos</p>
                <p className="text-2xl font-bold mt-1">{filledCount}/{totalSlots}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <p className="text-xs text-slate-500 uppercase font-bold">Completude</p>
                <p className="text-2xl font-bold mt-1">{completionPercent}%</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <p className="text-xs text-slate-500 uppercase font-bold">Semana</p>
                <p className="text-sm font-bold mt-2">{weekStart || '--'} ate {weekEnd || '--'}</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-slate-100 dark:bg-slate-800 h-2 overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${completionPercent}%` }}></div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 pr-3">Dia</th>
                    <th className="py-2 pr-3">Preenchidos</th>
                    <th className="py-2 pr-3">Pendentes</th>
                  </tr>
                </thead>
                <tbody>
                  {daySummary.map((entry) => (
                    <tr key={entry.day} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 pr-3 font-semibold">{days.find((d) => d.key === entry.day)?.fullLabel}</td>
                      <td className="py-2 pr-3 text-green-600 font-semibold">{entry.done}</td>
                      <td className="py-2 pr-3 text-amber-600 font-semibold">{entry.total - entry.done}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {error && <div className="px-4 lg:px-6 mt-4 text-sm text-red-600">{error}</div>}

      {/* Nutritionist Authorship Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPublishModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-green-600">verified</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Autoria do Cardapio</h3>
                  <p className="text-xs text-slate-500">Informe a nutricionista responsavel</p>
                </div>
              </div>
              <button onClick={() => setShowPublishModal(false)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Saved nutritionists */}
              {savedNutritionists.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nutricionistas salvas</p>
                  <div className="space-y-2">
                    {savedNutritionists.map((nut, idx) => (
                      <label
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedNutritionist === idx
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                            : 'border-slate-200 dark:border-slate-700 hover:border-green-300'
                          }`}
                      >
                        <input
                          type="radio"
                          name="nutritionist"
                          checked={selectedNutritionist === idx}
                          onChange={() => setSelectedNutritionist(idx)}
                          className="w-5 h-5 accent-green-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{nut.name}</p>
                          {nut.crn && <p className="text-xs text-slate-500">CRN: {nut.crn}</p>}
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const updated = savedNutritionists.filter((_, i) => i !== idx);
                            setSavedNutritionists(updated);
                            localStorage.setItem(NUTRITIONISTS_KEY, JSON.stringify(updated));
                            if (selectedNutritionist === idx) setSelectedNutritionist('new');
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                          title="Remover"
                        >
                          <span className="material-symbols-outlined text-red-400 text-lg">delete</span>
                        </button>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Add new */}
              <div>
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all mb-3 ${selectedNutritionist === 'new'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-green-300'
                    }`}
                >
                  <input
                    type="radio"
                    name="nutritionist"
                    checked={selectedNutritionist === 'new'}
                    onChange={() => setSelectedNutritionist('new')}
                    className="w-5 h-5 accent-green-600"
                  />
                  <span className="material-symbols-outlined text-green-600 text-lg">person_add</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Adicionar nova nutricionista</span>
                </label>

                {selectedNutritionist === 'new' && (
                  <div className="space-y-3 pl-8">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Nome completo *</label>
                      <input
                        value={newNutName}
                        onChange={(e) => setNewNutName(e.target.value)}
                        className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
                        placeholder="Ex: Maria Silva"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">CRN</label>
                      <input
                        value={newNutCrn}
                        onChange={(e) => setNewNutCrn(e.target.value)}
                        className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
                        placeholder="Ex: CRN-2 12345"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex gap-3">
              <button onClick={() => setShowPublishModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm">
                Cancelar
              </button>
              <button
                onClick={handlePublish}
                className="flex-1 h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">publish</span>
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Animation Overlay */}
      {publishSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div className="flex flex-col items-center gap-6 px-8 py-10 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700" style={{ animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            {/* Animated checkmark circle */}
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 96 96" className="w-24 h-24">
                <circle cx="48" cy="48" r="44" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round"
                  style={{ strokeDasharray: '276.5', strokeDashoffset: '276.5', animation: 'circleDrawIn 0.6s ease-out 0.2s forwards' }} />
                <path d="M28 50 L42 64 L68 34" fill="none" stroke="#10b981" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ strokeDasharray: '80', strokeDashoffset: '80', animation: 'checkDrawIn 0.4s ease-out 0.7s forwards' }} />
              </svg>
              {/* Confetti particles */}
              {[...Array(12)].map((_, i) => (
                <div key={i} className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6],
                    animation: `confetti${i % 4} 1s ease-out ${0.8 + i * 0.05}s forwards`,
                    opacity: 0,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              ))}
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white" style={{ animation: 'fadeSlideUp 0.4s ease-out 0.9s both' }}>
                Cardápio Publicado!
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm" style={{ animation: 'fadeSlideUp 0.4s ease-out 1.1s both' }}>
                Redirecionando para visualização...
              </p>
            </div>

            {/* Loading dots */}
            <div className="flex gap-2" style={{ animation: 'fadeSlideUp 0.4s ease-out 1.3s both' }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary"
                  style={{ animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleIn {
              from { opacity: 0; transform: scale(0.7); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes circleDrawIn {
              to { stroke-dashoffset: 0; }
            }
            @keyframes checkDrawIn {
              to { stroke-dashoffset: 0; }
            }
            @keyframes fadeSlideUp {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes dotPulse {
              0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
              40% { transform: scale(1); opacity: 1; }
            }
            @keyframes confetti0 {
              0% { opacity: 1; transform: translate(-50%, -50%); }
              100% { opacity: 0; transform: translate(calc(-50% + 40px), calc(-50% - 50px)); }
            }
            @keyframes confetti1 {
              0% { opacity: 1; transform: translate(-50%, -50%); }
              100% { opacity: 0; transform: translate(calc(-50% - 35px), calc(-50% - 45px)); }
            }
            @keyframes confetti2 {
              0% { opacity: 1; transform: translate(-50%, -50%); }
              100% { opacity: 0; transform: translate(calc(-50% + 50px), calc(-50% + 20px)); }
            }
            @keyframes confetti3 {
              0% { opacity: 1; transform: translate(-50%, -50%); }
              100% { opacity: 0; transform: translate(calc(-50% - 45px), calc(-50% + 30px)); }
            }
          `}</style>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-4 flex flex-wrap gap-3 z-40 mb-20 lg:mb-0">
        <button disabled={saving} onClick={handleSave} className="h-11 px-4 rounded-xl border border-primary text-primary font-bold text-sm disabled:opacity-60">
          Salvar rascunho
        </button>

        <button disabled={saving || wizardStep === 1} onClick={previousStep} className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm disabled:opacity-50">
          Voltar
        </button>

        {wizardStep < 3 ? (
          <button disabled={saving} onClick={nextStep} className="h-11 px-4 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-60">
            Proximo passo
          </button>
        ) : (
          <button disabled={saving} onClick={openPublishModal} className="h-11 px-4 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-60">
            Publicar cardapio
          </button>
        )}

        {menuId && (
          <button onClick={openCopyModal} className="h-11 px-4 rounded-xl border border-secondary-400 text-secondary-600 dark:text-secondary-400 font-bold text-sm hover:bg-secondary-50 dark:hover:bg-secondary-900/20 transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">content_copy</span>
            Copiar
          </button>
        )}
      </div>

      {/* Copy to Schools Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCopyModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary-500">content_copy</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Copiar cardápio</h3>
                  <p className="text-xs text-slate-500">Selecione as escolas de destino</p>
                </div>
              </div>
              <button onClick={() => setShowCopyModal(false)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {copyResult ? (
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
                  </div>
                  <div className="text-center">
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">Cardápio copiado!</h4>
                    <p className="text-sm text-slate-500 mt-1">
                      {copyResult.count === 1
                        ? 'O cardápio foi copiado para 1 escola como rascunho.'
                        : `O cardápio foi copiado para ${copyResult.count} escolas como rascunho.`}
                    </p>
                  </div>
                  <button onClick={() => setShowCopyModal(false)} className="h-11 px-6 rounded-xl bg-primary text-white font-bold text-sm">
                    Fechar
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Escolas ({copyTargetSchools.length} selecionada{copyTargetSchools.length !== 1 ? 's' : ''})
                    </p>
                    <button
                      onClick={() => {
                        const otherSchools = schools.filter((s: any) => s.id !== selectedSchool).map((s: any) => s.id);
                        setCopyTargetSchools(copyTargetSchools.length === otherSchools.length ? [] : otherSchools);
                      }}
                      className="text-xs text-primary font-semibold"
                    >
                      {copyTargetSchools.length === schools.filter((s: any) => s.id !== selectedSchool).length ? 'Desmarcar todas' : 'Selecionar todas'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {schools
                      .filter((school: any) => school.id !== selectedSchool)
                      .map((school: any) => {
                        const isChecked = copyTargetSchools.includes(school.id);
                        return (
                          <label
                            key={school.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked
                              ? 'border-primary bg-primary/5 dark:bg-primary/10'
                              : 'border-slate-200 dark:border-slate-700 hover:border-primary/40'
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCopySchool(school.id)}
                              className="w-5 h-5 rounded accent-primary"
                            />
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-slate-500 text-lg">school</span>
                              </div>
                              <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{school.name}</span>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                  {schools.filter((s: any) => s.id !== selectedSchool).length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-6">Nenhuma outra escola disponível.</p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!copyResult && (
              <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex gap-3">
                <button onClick={() => setShowCopyModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm">
                  Cancelar
                </button>
                <button
                  onClick={handleCopy}
                  disabled={copying || copyTargetSchools.length === 0}
                  className="flex-1 h-11 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {copying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Copiando...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">content_copy</span>
                      Copiar para {copyTargetSchools.length} escola{copyTargetSchools.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuEditor;
