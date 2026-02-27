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
  const labels = (tags as { labels?: unknown }).labels;
  if (Array.isArray(labels)) {
    return labels.map((item) => String(item).trim()).filter(Boolean).join(', ');
  }
  return Object.entries(tags)
    .flatMap(([key, value]) => {
      if (Array.isArray(value)) return value.map((item) => `${key}:${String(item)}`);
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [`${key}:${String(value)}`];
      return [];
    })
    .join(', ');
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
  const [isRecipeListCollapsed, setIsRecipeListCollapsed] = useState(false);

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
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setError('');
    setSuccess('');
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

      <div className={`grid grid-cols-1 ${isRecipeListCollapsed ? 'xl:grid-cols-[64px_minmax(0,1fr)]' : 'xl:grid-cols-[420px_minmax(0,1fr)]'} gap-4 lg:gap-6 p-4 lg:p-6`}>
        <section className="card overflow-hidden">
          <div className={`px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center ${isRecipeListCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
            {!isRecipeListCollapsed && (
              <>
                <h2 className="font-semibold text-slate-900 dark:text-white">Lista de Receitas</h2>
                <span className="text-xs text-slate-500">{recipes.length} itens</span>
              </>
            )}
            <button
              type="button"
              onClick={() => setIsRecipeListCollapsed((prev) => !prev)}
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              title={isRecipeListCollapsed ? 'Expandir lista' : 'Recolher lista'}
            >
              <span className="material-symbols-outlined text-lg">
                {isRecipeListCollapsed ? 'chevron_right' : 'chevron_left'}
              </span>
            </button>
          </div>

          {isRecipeListCollapsed ? (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-start py-4 gap-3">
              <button
                type="button"
                onClick={handleNew}
                className="w-10 h-10 rounded-xl bg-primary text-white inline-flex items-center justify-center"
                title="Nova receita"
              >
                <span className="material-symbols-outlined">add</span>
              </button>
              <div className="w-8 h-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-[10px] text-slate-400 [writing-mode:vertical-rl] rotate-180 tracking-widest uppercase">
                Receitas
              </span>
            </div>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-sm text-slate-500">Carregando...</div>
              ) : recipes.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">Nenhuma receita encontrada.</div>
              ) : (
                recipes.map((recipe) => {
                  const isSelected = recipe.id === selectedId;
                  return (
                    <div
                      key={recipe.id}
                      className={`px-4 py-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-primary-50/60 dark:bg-primary-900/10' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => handleSelectRecipe(recipe)}
                            className="text-left"
                          >
                            <p className="font-semibold text-slate-900 dark:text-white">{recipe.name}</p>
                          </button>
                          <p className="text-xs text-slate-500 mt-1">
                            {recipe.category || 'Sem categoria'} • Base {recipe.servings_base} porções
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {recipe.ingredients?.length || 0} ingrediente(s)
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${recipe.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {recipe.active ? 'Ativa' : 'Inativa'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecipe(recipe)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                            title="Excluir receita"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <form onSubmit={handleSave} className="p-4 lg:p-6">
            <div className="flex flex-col 2xl:flex-row gap-6">
              <div className="flex-1 space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {selectedId ? 'Editor de Receita' : 'Editor Modular de Receitas'}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Preencha os módulos abaixo para configurar sua receita estruturada.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {selectedId && (
                      <button type="button" onClick={handleDelete} className="btn-secondary text-danger-600 border-danger-200">
                        <span className="material-symbols-outlined text-lg">delete</span>
                        Excluir
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                    <span className="material-symbols-outlined text-primary">info</span>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">1. Identificação</h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Nome da Receita</label>
                      <input className="input bg-slate-50 dark:bg-slate-800" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ex: Arroz com Frango e Legumes" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Categoria</label>
                      <input className="input bg-slate-50 dark:bg-slate-800" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Ex: Almoço" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Rendimento Base (porções)</label>
                      <input type="number" min="1" step="1" className="input bg-slate-50 dark:bg-slate-800" value={form.servings_base} onChange={(e) => setForm((prev) => ({ ...prev, servings_base: e.target.value }))} />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <input id="recipe-active" type="checkbox" checked={form.active} onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))} className="w-5 h-5 rounded text-primary" />
                      <label htmlFor="recipe-active" className="text-sm font-medium text-slate-700 dark:text-slate-300">Receita ativa para uso em cardápios</label>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary">shopping_basket</span>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">2. Ingredientes</h3>
                    </div>
                    <button type="button" onClick={addIngredient} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 transition-colors">
                      <span className="material-symbols-outlined text-sm">add</span>
                      ADICIONAR
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 border-b border-slate-100 dark:border-slate-800 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="px-4 py-3">Insumo</th>
                          <th className="px-4 py-3 w-32">Qtd. Base</th>
                          <th className="px-4 py-3 w-32">Unidade</th>
                          <th className="px-4 py-3 w-32">Opcional</th>
                          <th className="px-4 py-3 w-16 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {form.ingredients.map((ingredient, index) => (
                          <tr key={`${index}-${ingredient.supply || 'empty'}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 align-top">
                            <td className="px-4 py-4 space-y-2">
                              <select className="input bg-transparent" value={ingredient.supply} onChange={(e) => handleIngredientSupplyChange(index, e.target.value)}>
                                <option value="">Selecione um insumo</option>
                                {supplies.map((supply) => (
                                  <option key={supply.id} value={supply.id}>{supply.name}{supply.category ? ` • ${supply.category}` : ''}</option>
                                ))}
                              </select>
                              <input className="input text-xs" value={ingredient.notes || ''} onChange={(e) => updateIngredient(index, { notes: e.target.value })} placeholder="Observações (opcional)" />
                            </td>
                            <td className="px-4 py-4">
                              <input type="number" min="0" step="0.01" className="input" value={ingredient.qty_base} onChange={(e) => updateIngredient(index, { qty_base: e.target.value })} />
                            </td>
                            <td className="px-4 py-4">
                              <select className="input" value={ingredient.unit} onChange={(e) => updateIngredient(index, { unit: e.target.value })}>
                                {UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-4">
                              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                                <input type="checkbox" checked={Boolean(ingredient.optional)} onChange={(e) => updateIngredient(index, { optional: e.target.checked })} />
                                Opcional
                              </label>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <button type="button" onClick={() => removeIngredient(index)} className="text-slate-400 hover:text-red-500 transition-colors" title="Remover ingrediente">
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                      <button type="button" onClick={addIngredient} className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 text-sm hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined">add_circle_outline</span>
                        Clique para adicionar novo insumo
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                    <span className="material-symbols-outlined text-primary">timer</span>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">3. Execução</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Instruções gerais (texto livre)</label>
                      <textarea className="input min-h-[110px]" value={form.instructions} onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))} placeholder="Observações gerais, preparo, cuidados..." />
                    </div>

                    <div className="flex flex-col md:flex-row items-end gap-4">
                      <div className="flex-1 space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Tempo de Preparo (min)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">schedule</span>
                          <input type="number" min="0" step="1" className="input pl-10 bg-slate-50 dark:bg-slate-800" value={form.prepTimeMinutes} onChange={(e) => setForm((prev) => ({ ...prev, prepTimeMinutes: e.target.value }))} placeholder="Ex: 45" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <button type="button" onClick={addPrepStep} className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-sm">add</span>
                          Nova Etapa
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {form.prepSteps.map((step, index) => (
                        <div key={`prep-step-${index}`} className={`flex gap-4 items-start ${!step.trim() && index > 0 ? 'opacity-70' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${step.trim() || index === 0 ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <textarea className="input min-h-[86px] bg-slate-50 dark:bg-slate-800" value={step} onChange={(e) => updatePrepStep(index, e.target.value)} placeholder={`Descreva o passo ${index + 1}...`} />
                          </div>
                          <button type="button" onClick={() => removePrepStep(index)} className="p-2 text-slate-400 hover:text-red-500">
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                    <span className="material-symbols-outlined text-primary">sell</span>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">4. Tags</h3>
                  </div>
                  <div className="p-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Palavras-chave</label>
                    <textarea className="input min-h-[90px] font-mono text-xs" value={form.tagsText} onChange={(e) => setForm((prev) => ({ ...prev, tagsText: e.target.value }))} placeholder="Ex: assado, sem leite, integral" />
                    <p className="text-xs text-slate-500 mt-2">Digite palavras separadas por vírgula. O sistema converte automaticamente.</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-4 pb-4">
                  <button type="button" onClick={handleNew} className="px-6 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    LIMPAR TUDO
                  </button>
                  <button type="submit" className="px-8 py-3 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all flex items-center gap-2 disabled:opacity-60" disabled={saving}>
                    <span className="material-symbols-outlined">{saving ? 'hourglass_top' : 'save'}</span>
                    {saving ? 'SALVANDO...' : selectedId ? 'SALVAR RECEITA' : 'CRIAR RECEITA'}
                  </button>
                </div>
              </div>

              <div className="w-full 2xl:w-[360px] shrink-0">
                <div className="2xl:sticky 2xl:top-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Pré-visualização
                    </h3>
                    <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">EM TEMPO REAL</span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                    <div className="h-36 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-300 text-5xl">restaurant</span>
                      <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                        <span className="material-symbols-outlined text-primary text-sm">timer</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{form.prepTimeMinutes || '--'} min</span>
                      </div>
                    </div>
                    <div className="p-5 space-y-5">
                      <div>
                        <div className="text-[10px] font-bold text-primary uppercase mb-1">{form.category || 'Sem categoria'}</div>
                        <h4 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">{form.name || 'Nova Receita'}</h4>
                        <div className="mt-2 flex items-center gap-4 text-slate-500 text-xs flex-wrap">
                          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">groups</span> {form.servings_base || '0'} porções</span>
                          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">scale</span> {previewTotalQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} total</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h5 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800 pb-2">Principais Insumos</h5>
                        <ul className="space-y-2">
                          {previewIngredients.slice(0, 5).map((item, idx) => (
                            <li key={`${item.name}-${idx}`} className="flex items-center justify-between text-sm gap-3">
                              <span className="text-slate-600 dark:text-slate-400 truncate">{item.name}</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                {Number(item.qty || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {item.unit}
                              </span>
                            </li>
                          ))}
                          {previewIngredients.length === 0 && (
                            <li className="text-xs text-slate-500">Adicione ingredientes para visualizar o resumo.</li>
                          )}
                        </ul>
                      </div>

                      <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-4">
                        <h5 className="text-xs font-bold text-primary uppercase mb-2">Próxima Etapa</h5>
                        <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-3">"{nextStepPreview}"</p>
                      </div>

                      <div className="pt-1">
                        <button type="button" disabled className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold rounded-lg flex items-center justify-center gap-2 opacity-70 cursor-not-allowed">
                          <span className="material-symbols-outlined text-sm">print</span>
                          VISUALIZAR IMPRESSÃO
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 p-4 rounded-xl">
                    <div className="flex gap-3">
                      <span className="material-symbols-outlined text-primary">lightbulb</span>
                      <div>
                        <h4 className="text-xs font-bold text-primary uppercase mb-1">Dica de Gestão</h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                          O custo estimado desta receita será atualizado automaticamente com base nos valores vigentes do estoque central.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Recipes;
