import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createRecipe, deleteRecipe, getRecipes, getSupplies, updateRecipe } from '../api';

type SupplyOption = {
  id: string;
  name: string;
  unit: string;
  category?: string;
  is_active?: boolean;
};

type RecipeIngredient = {
  id?: string;
  recipe?: string;
  supply: string;
  supply_name?: string;
  qty_base: number | string;
  unit: string;
  optional?: boolean;
  notes?: string;
};

type RecipeRecord = {
  id: string;
  name: string;
  category: string;
  servings_base: number;
  instructions: string;
  tags?: Record<string, unknown>;
  active: boolean;
  ingredients: RecipeIngredient[];
  created_at?: string;
  updated_at?: string;
};

type RecipeForm = {
  name: string;
  category: string;
  servings_base: string;
  instructions: string;
  prepTimeMinutes: string;
  prepSteps: string[];
  imageUrl: string;
  active: boolean;
  tagsText: string;
  ingredients: RecipeIngredient[];
};

const UNIT_OPTIONS = [
  { value: 'kg', label: 'Kg' },
  { value: 'g', label: 'g' },
  { value: 'l', label: 'L' },
  { value: 'ml', label: 'ml' },
  { value: 'unit', label: 'Unidade' },
];

const emptyIngredient = (): RecipeIngredient => ({
  supply: '',
  qty_base: '',
  unit: 'kg',
  optional: false,
  notes: '',
});

const emptyForm = (): RecipeForm => ({
  name: '',
  category: '',
  servings_base: '100',
  instructions: '',
  prepTimeMinutes: '',
  prepSteps: [''],
  imageUrl: '',
  active: true,
  tagsText: '{}',
  ingredients: [emptyIngredient()],
});

const parseError = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  return 'Erro na operação.';
};

const tagsObjectToInput = (tags?: Record<string, unknown>) => {
  if (!tags || typeof tags !== 'object') return '';
  const ignoredKeys = new Set(['prep_time_minutes', 'prep_steps', 'image_url']);
  const labels = (tags as { labels?: unknown }).labels;
  if (Array.isArray(labels)) {
    return labels.map((item) => String(item).trim()).filter(Boolean).join(', ');
  }
  return Object.entries(tags)
    .filter(([key]) => !ignoredKeys.has(key))
    .flatMap(([key, value]) => {
      if (Array.isArray(value)) return value.map((item) => `${key}:${String(item)}`);
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [`${key}:${String(value)}`];
      return [];
    })
    .join(', ');
};

const parseImageFromTags = (tags?: Record<string, unknown>) => {
  const raw = (tags as any)?.image_url;
  if (!raw) return '';
  return String(raw);
};

const parsePrepTimeFromTags = (tags?: Record<string, unknown>) => {
  const raw = (tags as any)?.prep_time_minutes;
  if (raw === null || raw === undefined || raw === '') return '';
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? String(value) : '';
};

const parsePrepStepsFromTags = (tags?: Record<string, unknown>) => {
  const raw = (tags as any)?.prep_steps;
  if (!Array.isArray(raw)) return [''];
  const steps = raw.map((item) => String(item || '').trim()).filter(Boolean);
  return steps.length ? steps : [''];
};

const normalizeRecipeToForm = (recipe: RecipeRecord): RecipeForm => ({
  name: recipe.name || '',
  category: recipe.category || '',
  servings_base: String(recipe.servings_base || 100),
  instructions: recipe.instructions || '',
  prepTimeMinutes: parsePrepTimeFromTags(recipe.tags),
  prepSteps: parsePrepStepsFromTags(recipe.tags),
  imageUrl: parseImageFromTags(recipe.tags),
  active: Boolean(recipe.active),
  tagsText: tagsObjectToInput(recipe.tags),
  ingredients: (recipe.ingredients || []).length
    ? recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      qty_base: ingredient.qty_base ?? '',
      unit: ingredient.unit || 'kg',
      optional: Boolean(ingredient.optional),
      notes: ingredient.notes || '',
    }))
    : [emptyIngredient()],
});

const Recipes: React.FC = () => {
  const location = useLocation();
  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [supplies, setSupplies] = useState<SupplyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<RecipeForm>(emptyForm());
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedId) || null,
    [recipes, selectedId],
  );

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((recipe) => {
      if (recipe.category?.trim()) set.add(recipe.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const loadSupplies = async () => {
    const data = await getSupplies({ is_active: true });
    setSupplies(Array.isArray(data) ? data : []);
  };

  const loadRecipes = async (filters?: { search?: string; category?: string; active?: boolean }) => {
    const data = await getRecipes(filters);
    const list = Array.isArray(data) ? (data as RecipeRecord[]) : [];
    setRecipes(list);
    if (selectedId) {
      const updated = list.find((recipe) => recipe.id === selectedId);
      if (updated) {
        setForm(normalizeRecipeToForm(updated));
      } else {
        setSelectedId(null);
        setForm(emptyForm());
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams(location.search);
      const urlSearch = (params.get('search') || '').trim();
      const urlCategory = (params.get('category') || '').trim();
      const urlActive = params.get('active');
      const normalizedActive: 'all' | 'true' | 'false' = urlActive === 'true' || urlActive === 'false' ? urlActive : 'all';
      setSearch(urlSearch);
      setCategoryFilter(urlCategory);
      setActiveFilter(normalizedActive);
      try {
        const recipeFilters = {
          search: urlSearch || undefined,
          category: urlCategory || undefined,
          active: normalizedActive === 'all' ? undefined : normalizedActive === 'true',
        };
        const [recipesData, suppliesData] = await Promise.all([
          getRecipes(recipeFilters),
          getSupplies({ is_active: true }),
        ]);
        if (cancelled) return;
        setRecipes(Array.isArray(recipesData) ? (recipesData as RecipeRecord[]) : []);
        setSupplies(Array.isArray(suppliesData) ? (suppliesData as SupplyOption[]) : []);
      } catch {
        if (!cancelled) setError('Não foi possível carregar receitas e insumos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  const applyFilters = async () => {
    setError('');
    setSuccess('');
    try {
      await loadRecipes({
        search: search.trim() || undefined,
        category: categoryFilter || undefined,
        active: activeFilter === 'all' ? undefined : activeFilter === 'true',
      });
    } catch {
      setError('Não foi possível buscar receitas.');
    }
  };

  const handleSelectRecipe = (recipe: RecipeRecord) => {
    setSelectedId(recipe.id);
    setForm(normalizeRecipeToForm(recipe));
    setError('');
    setSuccess('');
    setCurrentStep(1);
    setShowModal(true);
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setError('');
    setSuccess('');
    setCurrentStep(1);
    setShowModal(true);
  };

  const updateIngredient = (index: number, patch: Partial<RecipeIngredient>) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ingredient, i) => (i === index ? { ...ingredient, ...patch } : ingredient)),
    }));
  };

  const addIngredient = () => {
    setForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, emptyIngredient()],
    }));
  };

  const removeIngredient = (index: number) => {
    setForm((prev) => {
      const next = prev.ingredients.filter((_, i) => i !== index);
      return {
        ...prev,
        ingredients: next.length ? next : [emptyIngredient()],
      };
    });
  };

  const updatePrepStep = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      prepSteps: prev.prepSteps.map((step, i) => (i === index ? value : step)),
    }));
  };

  const addPrepStep = () => {
    setForm((prev) => ({ ...prev, prepSteps: [...prev.prepSteps, ''] }));
  };

  const removePrepStep = (index: number) => {
    setForm((prev) => {
      const next = prev.prepSteps.filter((_, i) => i !== index);
      return { ...prev, prepSteps: next.length ? next : [''] };
    });
  };

  const handleIngredientSupplyChange = (index: number, supplyId: string) => {
    const selectedSupply = supplies.find((supply) => supply.id === supplyId);
    updateIngredient(index, {
      supply: supplyId,
      unit: selectedSupply?.unit || form.ingredients[index]?.unit || 'kg',
    });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const normalizedPrepSteps = (form.prepSteps || [])
      .map((step) => step.trim())
      .filter(Boolean);

    const parsedTags: Record<string, unknown> = {
      labels: (form.tagsText || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    const prepTimeMinutes = Number(form.prepTimeMinutes);
    if (form.prepTimeMinutes !== '') {
      if (!Number.isFinite(prepTimeMinutes) || prepTimeMinutes < 0) {
        setError('Tempo de preparo deve ser um número válido.');
        return;
      }
      parsedTags.prep_time_minutes = prepTimeMinutes;
    }
    if (normalizedPrepSteps.length > 0) {
      parsedTags.prep_steps = normalizedPrepSteps;
    }
    if (form.imageUrl.trim()) {
      parsedTags.image_url = form.imageUrl.trim();
    }
    
    // Add nutrition info
    if (form.kcal || form.protein || form.carbs) {
      parsedTags.nutrition = {
        kcal: form.kcal.trim(),
        protein: form.protein.trim(),
        carbs: form.carbs.trim()
      };
    }

    const name = form.name.trim();
    if (!name) {
      setError('Nome da receita é obrigatório.');
      return;
    }

    const servingsBase = Number(form.servings_base);
    if (!Number.isFinite(servingsBase) || servingsBase <= 0) {
      setError('Rendimento base deve ser maior que zero.');
      return;
    }

    const normalizedIngredients = form.ingredients
      .map((ingredient) => ({
        supply: ingredient.supply,
        qty_base: Number(ingredient.qty_base),
        unit: ingredient.unit,
        optional: Boolean(ingredient.optional),
        notes: (ingredient.notes || '').trim(),
      }))
      .filter((ingredient) => ingredient.supply || ingredient.qty_base || ingredient.notes);

    const invalidIngredient = normalizedIngredients.find((ingredient) =>
      !ingredient.supply || !Number.isFinite(ingredient.qty_base) || ingredient.qty_base < 0 || !ingredient.unit,
    );
    if (invalidIngredient) {
      setError('Preencha os ingredientes com insumo, quantidade e unidade válidos.');
      return;
    }

    const payload = {
      name,
      category: form.category.trim(),
      servings_base: servingsBase,
      instructions: form.instructions.trim(),
      tags: parsedTags,
      active: form.active,
      ingredients: normalizedIngredients,
    };

    setSaving(true);
    try {
      if (selectedId) {
        await updateRecipe(selectedId, payload);
        setSuccess('Receita atualizada com sucesso.');
      } else {
        const created = await createRecipe(payload) as RecipeRecord;
        setSelectedId(created?.id || null);
        setSuccess('Receita criada com sucesso.');
      }
      await loadRecipes({
        search: search.trim() || undefined,
        category: categoryFilter || undefined,
        active: activeFilter === 'all' ? undefined : activeFilter === 'true',
      });
      await loadSupplies();
      setShowModal(false);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecipe = async (recipe: RecipeRecord) => {
    if (!confirm(`Excluir a receita "${recipe.name}"?`)) return;
    setError('');
    setSuccess('');
    try {
      await deleteRecipe(recipe.id);
      if (selectedId === recipe.id) {
        setSelectedId(null);
        setForm(emptyForm());
      }
      setSuccess('Receita excluída com sucesso.');
      await loadRecipes({
        search: search.trim() || undefined,
        category: categoryFilter || undefined,
        active: activeFilter === 'all' ? undefined : activeFilter === 'true',
      });
    } catch (err) {
      setError(parseError(err));
    }
  };

  const handleDelete = async () => {
    if (!selectedRecipe) return;
    await handleDeleteRecipe(selectedRecipe);
  };

  const handleRecipeImageFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, imageUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const previewIngredients = useMemo(() => (
    form.ingredients
      .filter((ingredient) => ingredient.supply || ingredient.qty_base || ingredient.notes)
      .map((ingredient) => {
        const supply = supplies.find((s) => s.id === ingredient.supply);
        return {
          name: supply?.name || ingredient.supply_name || 'Insumo não selecionado',
          qty: ingredient.qty_base || 0,
          unit: ingredient.unit || (supply?.unit ?? 'kg'),
        };
      })
  ), [form.ingredients, supplies]);

  const previewTotalQty = useMemo(
    () => previewIngredients.reduce((acc, item) => acc + (Number(item.qty) || 0), 0),
    [previewIngredients],
  );

  const nextStepPreview = useMemo(
    () => form.prepSteps.map((step) => step.trim()).find(Boolean) || 'Descreva o primeiro passo do preparo aqui...',
    [form.prepSteps],
  );

  return (
    <div className="flex flex-col flex-1 pb-24 lg:pb-8">
      <div className="p-4 lg:p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Receitas</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Cadastro de receitas estruturadas para cálculo de produção no cardápio.
            </p>
          </div>
          <button onClick={handleNew} className="btn-primary text-sm">
            <span className="material-symbols-outlined text-lg">add</span>
            Nova Receita
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <input
            className="input md:col-span-2"
            placeholder="Buscar por nome ou instruções"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todas categorias</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <select className="input flex-1" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as 'all' | 'true' | 'false')}>
              <option value="all">Todas</option>
              <option value="true">Ativas</option>
              <option value="false">Inativas</option>
            </select>
            <button type="button" onClick={applyFilters} className="btn-secondary">
              Buscar
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 lg:mx-6 mt-4 rounded-xl border border-danger-200 bg-danger-50 text-danger-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mx-4 lg:mx-6 mt-4 rounded-xl border border-success-200 bg-success-50 text-success-700 px-4 py-3 text-sm">
          {success}
        </div>
      )}

      <div className="p-4 lg:p-6">
        {loading ? (
          <div className="text-center p-12 text-slate-500">Carregando galeria...</div>
        ) : recipes.length === 0 ? (
          <div className="text-center p-12 text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl mb-3 text-slate-300">restaurant</span>
            <p>Nenhuma receita encontrada para os filtros atuais.</p>
            <button onClick={handleNew} className="btn-primary mt-4">Cadastrar a Primeira</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {recipes.map((recipe) => {
              const imageUrl = parseImageFromTags(recipe.tags);
              const prepTime = parsePrepTimeFromTags(recipe.tags);
              return (
                <div key={recipe.id} className="card overflow-hidden hover:border-primary/50 transition-colors cursor-pointer flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm" onClick={() => handleSelectRecipe(recipe)}>
                  <div className="h-40 bg-slate-100 dark:bg-slate-800 relative overflow-hidden shrink-0">
                    {imageUrl ? (
                      <img src={imageUrl} alt={recipe.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-5xl text-slate-300">restaurant</span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-2">
                       <span className={`text-[10px] px-2 py-1 rounded-full font-bold shadow-sm backdrop-blur-md ${recipe.active ? 'bg-emerald-500/90 text-white' : 'bg-slate-500/90 text-white'}`}>
                        {recipe.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="text-[10px] font-bold text-primary uppercase mb-1">{recipe.category || 'Sem categoria'}</div>
                    <h3 className="font-bold text-slate-800 dark:text-white line-clamp-2 leading-tight flex-1 mb-3">{recipe.name}</h3>
                    <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1" title="Rendimento base"><span className="material-symbols-outlined text-sm">groups</span> {recipe.servings_base}</span>
                        <span className="flex items-center gap-1" title="Ingredientes"><span className="material-symbols-outlined text-sm">kitchen</span> {recipe.ingredients?.length || 0}</span>
                      </div>
                      {prepTime && <span className="flex items-center gap-1 text-slate-400 font-medium" title="Tempo de preparo"><span className="material-symbols-outlined text-sm">timer</span> {prepTime}m</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 relative my-auto">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">menu_book</span>
                  {selectedId ? 'Edição de Receita' : 'Nova Receita'}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 mt-2">
                  <button onClick={() => setCurrentStep(1)} className={`px-2.5 py-1 rounded-md font-bold transition-all ${currentStep === 1 ? 'bg-primary text-white shadow-md' : currentStep > 1 ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>1. Identificação</button>
                  <span className="material-symbols-outlined text-[12px] opacity-50">arrow_forward</span>
                  <button onClick={() => setCurrentStep(2)} disabled={currentStep < 2 && !form.name.trim()} className={`px-2.5 py-1 rounded-md font-bold transition-all ${currentStep === 2 ? 'bg-primary text-white shadow-md' : currentStep > 2 || (currentStep===1 && form.name.trim()) ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>2. Ingredientes</button>
                  <span className="material-symbols-outlined text-[12px] opacity-50">arrow_forward</span>
                  <button onClick={() => setCurrentStep(3)} disabled={currentStep < 3 && !selectedId} className={`px-2.5 py-1 rounded-md font-bold transition-all ${currentStep === 3 ? 'bg-primary text-white shadow-md' : currentStep > 3 || selectedId ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>3. Execução</button>
                  <span className="material-symbols-outlined text-[12px] opacity-50">arrow_forward</span>
                  <button onClick={() => setCurrentStep(4)} disabled={currentStep < 4 && !selectedId} className={`px-2.5 py-1 rounded-md font-bold transition-all ${currentStep === 4 ? 'bg-primary text-white shadow-md' : selectedId ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>4. Finalização</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedId && (
                  <button type="button" onClick={handleDelete} className="w-10 h-10 flex items-center justify-center text-danger-500 hover:bg-danger-50 rounded-xl transition-colors shrink-0" title="Excluir">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                )}
                <button type="button" onClick={() => setShowModal(false)} className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl transition-colors shrink-0">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {currentStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px]">info</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Dados Básicos</h3>
                      <p className="text-xs text-slate-500">Informações principais da receita.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Nome da Receita *</label>
                      <input className="input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ex: Arroz com Frango e Legumes" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Categoria</label>
                      <input className="input" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Ex: Almoço" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Rendimento Base (porções) *</label>
                      <input type="number" min="1" step="1" className="input" value={form.servings_base} onChange={(e) => setForm((prev) => ({ ...prev, servings_base: e.target.value }))} />
                    </div>
                    <div className="col-span-1 md:col-span-2 flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <input id="recipe-active" type="checkbox" checked={form.active} onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))} className="w-5 h-5 rounded text-primary border-slate-300" />
                      <div>
                        <label htmlFor="recipe-active" className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer block">Receita ativa para uso</label>
                        <p className="text-xs text-slate-500">Ao inativar, a receita não aparecerá nas opções do cardápio.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px]">shopping_basket</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Composição (Ingredientes)</h3>
                        <p className="text-xs text-slate-500">Adicione os itens e as quantidades baseadas no rendimento informado.</p>
                      </div>
                    </div>
                    <button type="button" onClick={addIngredient} className="btn-secondary py-1.5 px-3 text-xs bg-primary text-white border-primary hover:bg-primary-600 font-bold hidden md:flex items-center gap-1 shadow-sm shadow-primary/20">
                      <span className="material-symbols-outlined text-sm">add</span> Adicionar Insumo
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold uppercase">
                        <tr>
                          <th className="px-4 py-3 min-w-[200px] w-full">Insumo / Detalhes</th>
                          <th className="px-4 py-3 w-28 shrink-0">Quantidade</th>
                          <th className="px-4 py-3 w-24 shrink-0">Medida</th>
                          <th className="px-4 py-3 w-20 shrink-0 text-center">Opcional</th>
                          <th className="px-4 py-3 w-12 text-center shrink-0">Excluir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {form.ingredients.map((ingredient, index) => (
                          <tr key={`${index}-${ingredient.supply || 'empty'}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 align-top">
                            <td className="px-4 py-3 space-y-2 sm:space-y-0 sm:flex sm:gap-2">
                              <select className="input text-xs w-full sm:flex-1 bg-slate-50 dark:bg-slate-800" value={ingredient.supply} onChange={(e) => handleIngredientSupplyChange(index, e.target.value)}>
                                <option value="">Selecione o Insumo...</option>
                                {supplies.map((s) => <option key={s.id} value={s.id}>{s.name}{s.category ? ` • ${s.category}`:''}</option>)}
                              </select>
                              <input className="input text-[11px] w-full sm:w-1/3" value={ingredient.notes || ''} onChange={(e) => updateIngredient(index, { notes: e.target.value })} placeholder="Obs. Ex: sem casca" title="Observações para este ingrediente" />
                            </td>
                            <td className="px-4 py-3">
                              <input type="number" min="0" step="0.01" className="input text-xs" value={ingredient.qty_base} onChange={(e) => updateIngredient(index, { qty_base: e.target.value })} />
                            </td>
                            <td className="px-4 py-3">
                              <select className="input text-xs" value={ingredient.unit} onChange={(e) => updateIngredient(index, { unit: e.target.value })}>
                                {UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3 pt-5 text-center">
                              <input type="checkbox" checked={Boolean(ingredient.optional)} onChange={(e) => updateIngredient(index, { optional: e.target.checked })} className="w-4 h-4 rounded text-primary border-slate-300" title="Marcar como ingrediente" />
                            </td>
                            <td className="px-4 py-3 text-center pt-3.5">
                              <button type="button" onClick={() => removeIngredient(index)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mx-auto" title="Remover">
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button type="button" onClick={addIngredient} className="w-full py-4 text-primary hover:bg-primary/5 text-sm font-bold transition-colors flex justify-center gap-2 items-center">
                      <span className="material-symbols-outlined text-base">add_circle</span> Adicionar outro ingrediente
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px]">restaurant_menu</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Modo de Preparo</h3>
                      <p className="text-xs text-slate-500">Descreva como a receita deve ser executada nas cozinhas.</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Instruções Gerais (Opcional)</label>
                    <textarea className="input min-h-[90px] text-sm" value={form.instructions} onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))} placeholder="Orientações, cuidados gerais do preparo, dicas de utensílios a serem utilizados..." />
                  </div>

                  <div className="w-full sm:w-1/3 space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tempo de Preparo (Minutos)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-sm">schedule</span>
                      <input type="number" min="1" className="input pl-9" value={form.prepTimeMinutes} onChange={(e) => setForm((prev) => ({ ...prev, prepTimeMinutes: e.target.value }))} placeholder="Ex: 45" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-5 mb-2">
                      <div>
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Passo a passo</label>
                        <p className="text-[11px] text-slate-500">Divida o processo para facilitar a leitura.</p>
                      </div>
                      <button type="button" onClick={addPrepStep} className="btn-secondary py-1 text-xs px-3">
                        + Nova Etapa
                      </button>
                    </div>
                    
                    {form.prepSteps.map((step, index) => (
                      <div key={index} className="flex gap-3 items-start bg-slate-50 dark:bg-slate-800/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800 group">
                        <div className="w-7 h-7 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs mt-1">
                          {index + 1}
                        </div>
                        <textarea className="input flex-1 min-h-[60px] text-sm bg-white dark:bg-slate-900 border-transparent focus:border-primary resize-y" value={step} onChange={(e) => updatePrepStep(index, e.target.value)} placeholder={`Escreva a descrição da etapa ${index + 1}...`} />
                        <button type="button" onClick={() => removePrepStep(index)} className="w-8 h-8 text-slate-300 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 rounded-lg flex items-center justify-center mt-0.5 opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px]">style</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Foto e Classificação</h3>
                      <p className="text-xs text-slate-500">Para exibição detalhada nos cardápios.</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase">Imagem da Receita (Opcional)</label>
                        <input className="input" value={form.imageUrl} onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))} placeholder="Cole uma URL ou use o botão abaixo..." />
                        
                        <div className="relative">
                          <label className="btn-secondary w-full justify-center text-sm py-2.5 cursor-pointer flex gap-2 shadow-sm relative overflow-hidden group">
                            <span className="material-symbols-outlined text-[18px]">upload</span>
                            <span>Enviar foto do dispositivo</span>
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <input type="file" accept="image/*" onChange={handleRecipeImageFile} className="hidden" id="recipeImageFilePicker" />
                          </label>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Tags / Palavras-chave</label>
                        <textarea className="input min-h-[90px] text-sm" value={form.tagsText} onChange={(e) => setForm((prev) => ({ ...prev, tagsText: e.target.value }))} placeholder="Ex: sem-gluten, festivo, inverno" />
                        <p className="text-[10px] text-slate-400">Separe por vírgulas.</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Pré-visualização do Título</label>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 md:p-5 border border-slate-100 dark:border-slate-700 h-full max-h-[260px] flex flex-col pt-5 relative overflow-hidden text-center justify-center shadow-inner">
                        {form.imageUrl ? (
                          <img src={form.imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl shadow-sm mb-4 mx-auto max-w-[280px]" />
                        ) : (
                          <div className="w-full h-32 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-4 mx-auto max-w-[280px]">
                            <span className="material-symbols-outlined text-4xl text-slate-400">restaurant</span>
                          </div>
                        )}
                        <h4 className="text-base font-bold text-slate-800 dark:text-white line-clamp-2 px-2">{form.name || 'Nome da Receita'}</h4>
                        <div className="mt-2 flex items-center justify-center gap-2">
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{form.category || 'Geral'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl flex items-center justify-between shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
              <button 
                type="button" 
                onClick={() => setCurrentStep(prev => prev - 1)}
                className={`btn-secondary min-w-[100px] sm:min-w-[120px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-none justify-center ${currentStep === 1 ? 'invisible' : ''}`}
                disabled={saving}
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span> Voltar
              </button>
              
              {currentStep < 4 ? (
                <button 
                  type="button" 
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  disabled={currentStep === 1 && !form.name.trim()}
                  className="btn-primary min-w-[120px] sm:min-w-[140px] shadow-lg shadow-primary/30 justify-center"
                >
                  <span className="font-bold">Avançar</span> <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="btn-primary min-w-[150px] sm:min-w-[180px] shadow-xl shadow-primary/30 justify-center"
                >
                  <span className="material-symbols-outlined text-sm">{saving ? 'loading' : 'check'}</span>
                  {saving ? 'Registrando...' : 'CONCLUIR'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recipes;
