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

  const handleDelete = async () => {
    if (!selectedRecipe) return;
    if (!confirm(`Excluir a receita "${selectedRecipe.name}"?`)) return;
    setError('');
    setSuccess('');
    try {
      await deleteRecipe(selectedRecipe.id);
      setSelectedId(null);
      setForm(emptyForm());
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

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4 lg:gap-6 p-4 lg:p-6">
        <section className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Lista de Receitas</h2>
            <span className="text-xs text-slate-500">{recipes.length} itens</span>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-sm text-slate-500">Carregando...</div>
            ) : recipes.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">Nenhuma receita encontrada.</div>
            ) : (
              recipes.map((recipe) => {
                const isSelected = recipe.id === selectedId;
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => handleSelectRecipe(recipe)}
                    className={`w-full text-left px-4 py-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-primary-50/60 dark:bg-primary-900/10' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{recipe.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {recipe.category || 'Sem categoria'} • Base {recipe.servings_base} porções
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {recipe.ingredients?.length || 0} ingrediente(s)
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${recipe.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {recipe.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="card">
          <form onSubmit={handleSave} className="p-4 lg:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {selectedId ? 'Editar Receita' : 'Nova Receita'}
                </h2>
                <p className="text-xs text-slate-500">
                  Vincule insumos e quantidade base para cálculo automático.
                </p>
              </div>
              {selectedId && (
                <button type="button" onClick={handleDelete} className="btn-secondary text-danger-600 border-danger-200">
                  <span className="material-symbols-outlined text-lg">delete</span>
                  Excluir
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Arroz com frango"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                <input
                  className="input"
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Ex: Almoço"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rendimento Base (porções)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input"
                  value={form.servings_base}
                  onChange={(e) => setForm((prev) => ({ ...prev, servings_base: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
                  />
                  Receita ativa
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modo de Preparo / Instruções</label>
              <textarea
                className="input min-h-[110px]"
                value={form.instructions}
                onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))}
                placeholder="Descreva etapas de preparo, tempo e observações."
              />
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Modo de Preparo Estruturado</h3>
                  <p className="text-xs text-slate-500">Configure tempo e etapas para exibição passo a passo na calculadora.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tempo de Preparo (minutos)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input"
                    value={form.prepTimeMinutes}
                    onChange={(e) => setForm((prev) => ({ ...prev, prepTimeMinutes: e.target.value }))}
                    placeholder="Ex: 25"
                  />
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={addPrepStep} className="btn-secondary text-sm">
                    <span className="material-symbols-outlined text-lg">add</span>
                    Adicionar Etapa
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {form.prepSteps.map((step, index) => (
                  <div key={`prep-step-${index}`} className="flex items-start gap-3">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300 border border-primary-200 dark:border-primary-800 flex items-center justify-center text-sm font-bold mt-1">
                      {index + 1}
                    </div>
                    <textarea
                      className="input min-h-[78px]"
                      value={step}
                      onChange={(e) => updatePrepStep(index, e.target.value)}
                      placeholder={`Descreva a etapa ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removePrepStep(index)}
                      className="btn-secondary text-danger-600 border-danger-200 mt-1"
                      title="Remover etapa"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tags / Palavras-chave</label>
              <textarea
                className="input min-h-[90px] font-mono text-xs"
                value={form.tagsText}
                onChange={(e) => setForm((prev) => ({ ...prev, tagsText: e.target.value }))}
                placeholder="Ex: assado, sem leite, integral"
              />
              <p className="text-xs text-slate-500 mt-1">
                Digite palavras separadas por vírgula. O sistema converte automaticamente.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Ingredientes</h3>
                  <p className="text-xs text-slate-500">Quantidades referentes ao rendimento base.</p>
                </div>
                <button type="button" onClick={addIngredient} className="btn-secondary text-sm">
                  <span className="material-symbols-outlined text-lg">add</span>
                  Ingrediente
                </button>
              </div>

              <div className="space-y-3">
                {form.ingredients.map((ingredient, index) => (
                  <div key={`${index}-${ingredient.supply || 'empty'}`} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_120px_auto] gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Insumo</label>
                        <select
                          className="input"
                          value={ingredient.supply}
                          onChange={(e) => handleIngredientSupplyChange(index, e.target.value)}
                        >
                          <option value="">Selecione um insumo</option>
                          {supplies.map((supply) => (
                            <option key={supply.id} value={supply.id}>
                              {supply.name}{supply.category ? ` • ${supply.category}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Qtd. Base</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input"
                          value={ingredient.qty_base}
                          onChange={(e) => updateIngredient(index, { qty_base: e.target.value })}
                          placeholder="0,00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Unidade</label>
                        <select
                          className="input"
                          value={ingredient.unit}
                          onChange={(e) => updateIngredient(index, { unit: e.target.value })}
                        >
                          {UNIT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeIngredient(index)}
                        className="btn-secondary text-danger-600 border-danger-200"
                        title="Remover ingrediente"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-3 items-center">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(ingredient.optional)}
                          onChange={(e) => updateIngredient(index, { optional: e.target.checked })}
                        />
                        Opcional
                      </label>
                      <input
                        className="input"
                        value={ingredient.notes || ''}
                        onChange={(e) => updateIngredient(index, { notes: e.target.value })}
                        placeholder="Observações (opcional)"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={handleNew} className="btn-secondary">
                Limpar
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                <span className="material-symbols-outlined text-lg">{saving ? 'hourglass_top' : 'save'}</span>
                {saving ? 'Salvando...' : selectedId ? 'Salvar Alterações' : 'Criar Receita'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Recipes;
