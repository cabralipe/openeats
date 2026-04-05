import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  exportPublicMenuPdf,
  getPublicMenuCurrent,
  getPublicRecipe,
  getPublicSchools,
} from "../api";

interface School {
  id: string;
  name: string;
  slug: string;
  city: string;
  author_name?: string;
}

interface PublicMenuItem {
  id: string;
  day_of_week: string;
  meal_type: string;
  meal_name?: string;
  portion_text?: string;
  description?: string;
  recipe?: string | null;
  recipe_name?: string;
}

interface NutritionDayInfo {
  kcal?: number | string | null;
  protein?: number | string | null;
  carbs?: number | string | null;
}

interface PublicMenuPayload {
  school_name?: string;
  week_start?: string;
  week_end?: string;
  author_name?: string;
  author_crn?: string;
  nutritional_info?: Record<string, NutritionDayInfo>;
  items?: PublicMenuItem[];
}

type GroupedMealItem = {
  id: string;
  mealType: string;
  mealLabel: string;
  mealName: string;
  portionText: string;
  description: string;
  recipe: string | null;
  recipeName: string;
};

type GroupedDay = {
  dayCode: string;
  dayLabel: string;
  meals: GroupedMealItem[];
};

type MealCardItem = {
  id: string;
  title: string;
  summary: string;
  displayText: string;
  recipe: string | null;
  recipeName: string;
};

type MealCard = {
  key: string;
  label: string;
  icon: string;
  timeLabel: string;
  iconToneClass: string;
  badgeToneClass: string;
  featured: boolean;
  items: MealCardItem[];
};

type RecipePayload = {
  name?: string;
  category?: string;
  instructions?: string;
  servings_base?: number;
  ingredients?: Array<{
    supply_name: string;
    optional?: boolean;
    qty_base?: string | number;
    unit?: string;
  }>;
  tags?: {
    prep_steps?: string[];
    prep_time_minutes?: number;
    nutrition?: {
      kcal?: number | string | null;
      protein?: number | string | null;
      carbs?: number | string | null;
    };
  };
};

const pageFont = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const headlineFont = { fontFamily: "'Manrope', sans-serif" } as const;

const DAY_NAMES: Record<string, string> = {
  MON: "Segunda-feira",
  TUE: "Terca-feira",
  WED: "Quarta-feira",
  THU: "Quinta-feira",
  FRI: "Sexta-feira",
};

const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI"];
const MEAL_ORDER = [
  "BREAKFAST1",
  "SNACK1",
  "LUNCH",
  "SNACK2",
  "BREAKFAST2",
  "DINNER_COFFEE",
  "BREAKFAST",
  "SNACK",
];

const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST1: "Desjejum",
  SNACK1: "Lanche",
  LUNCH: "Almoco",
  SNACK2: "Lanche",
  BREAKFAST2: "Desjejum",
  DINNER_COFFEE: "Cafe da noite",
  BREAKFAST: "Cafe da manha",
  SNACK: "Lanche",
};

const MEAL_META: Record<string, Omit<MealCard, "key" | "label" | "items">> = {
  BREAKFAST1: {
    icon: "coffee",
    timeLabel: "07:30",
    iconToneClass: "bg-orange-50 text-orange-600",
    badgeToneClass: "bg-[#d3e4fe] text-[#4d5d73]",
    featured: false,
  },
  BREAKFAST2: {
    icon: "breakfast_dining",
    timeLabel: "15:30",
    iconToneClass: "bg-amber-50 text-amber-600",
    badgeToneClass: "bg-[#d3e4fe] text-[#4d5d73]",
    featured: false,
  },
  BREAKFAST: {
    icon: "breakfast_dining",
    timeLabel: "08:00",
    iconToneClass: "bg-amber-50 text-amber-600",
    badgeToneClass: "bg-[#d3e4fe] text-[#4d5d73]",
    featured: false,
  },
  SNACK1: {
    icon: "nutrition",
    timeLabel: "10:00",
    iconToneClass: "bg-green-50 text-green-600",
    badgeToneClass: "bg-[#d3e4fe] text-[#4d5d73]",
    featured: false,
  },
  SNACK2: {
    icon: "cookie",
    timeLabel: "16:00",
    iconToneClass: "bg-emerald-50 text-emerald-600",
    badgeToneClass: "bg-[#d3e4fe] text-[#4d5d73]",
    featured: false,
  },
  SNACK: {
    icon: "cookie",
    timeLabel: "16:00",
    iconToneClass: "bg-emerald-50 text-emerald-600",
    badgeToneClass: "bg-[#d3e4fe] text-[#4d5d73]",
    featured: false,
  },
  LUNCH: {
    icon: "restaurant",
    timeLabel: "12:30",
    iconToneClass: "bg-blue-50 text-[#2251db]",
    badgeToneClass: "bg-[#2251db] text-white",
    featured: true,
  },
  DINNER_COFFEE: {
    icon: "dark_mode",
    timeLabel: "19:30",
    iconToneClass: "bg-violet-50 text-violet-600",
    badgeToneClass: "bg-[#d3e4fe] text-[#4d5d73]",
    featured: false,
  },
};

const defaultMealMeta = {
  icon: "restaurant",
  timeLabel: "Horario",
  iconToneClass: "bg-slate-100 text-slate-600",
  badgeToneClass: "bg-[#d3e4fe] text-[#4d5d73]",
  featured: false,
};

const formatWeekRange = (weekStart?: string, weekEnd?: string) => {
  if (!weekStart || !weekEnd) return "";
  try {
    const start = new Date(`${weekStart}T12:00:00`);
    const end = new Date(`${weekEnd}T12:00:00`);
    return `${start.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    })} a ${end.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    })}`;
  } catch {
    return `${weekStart} a ${weekEnd}`;
  }
};

const capitalizeText = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const formatMetric = (value?: string | number | null, suffix = "") => {
  if (value === null || value === undefined || value === "") return "-";
  return `${value}${suffix}`;
};

const buildMealText = (meal: GroupedMealItem) => {
  const text =
    [meal.mealName, meal.description].filter(Boolean).join(" - ") ||
    meal.description ||
    meal.mealName ||
    "Item sem descricao";
  return meal.portionText ? `${text} (${meal.portionText})` : text;
};

const PublicMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [menu, setMenu] = useState<PublicMenuPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [viewingRecipeId, setViewingRecipeId] = useState<string | null>(null);
  const [recipeData, setRecipeData] = useState<RecipePayload | null>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(false);

  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const slugFromUrl = params.get("slug") || "";
  const tokenFromUrl = params.get("token") || "";

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      setError("");

      try {
        if (slugFromUrl) {
          const data = (await getPublicMenuCurrent(
            slugFromUrl,
            tokenFromUrl || undefined,
          )) as PublicMenuPayload;
          if (cancelled) return;
          setMenu(data);
          setSelectedSchool({
            id: "",
            name: data.school_name || "Escola",
            slug: slugFromUrl,
            city: "",
          });
          return;
        }

        const schoolsData = (await getPublicSchools()) as School[];
        if (!cancelled)
          setSchools(Array.isArray(schoolsData) ? schoolsData : []);
      } catch {
        if (!cancelled) {
          setError(
            slugFromUrl
              ? "Nao foi possivel carregar o cardapio."
              : "Nao foi possivel carregar as escolas.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [slugFromUrl, tokenFromUrl]);

  const loadMenu = async (school: School) => {
    setSelectedSchool(school);
    setLoadingMenu(true);
    setError("");
    setMenu(null);

    try {
      const data = (await getPublicMenuCurrent(
        school.slug,
      )) as PublicMenuPayload;
      setMenu(data);
    } catch {
      setError("Nenhum cardapio disponivel para esta escola nesta semana.");
    } finally {
      setLoadingMenu(false);
    }
  };

  const handleViewRecipe = async (recipeId: string) => {
    setViewingRecipeId(recipeId);
    setRecipeData(null);
    setLoadingRecipe(true);

    try {
      const data = (await getPublicRecipe(recipeId)) as RecipePayload;
      setRecipeData(data);
    } catch {
      setRecipeData(null);
    } finally {
      setLoadingRecipe(false);
    }
  };

  const goBack = () => {
    setSelectedSchool(null);
    setMenu(null);
    setError("");
    setCurrentDayIndex(0);
  };

  const activeSlug = selectedSchool?.slug || slugFromUrl;

  const handleDownloadPdf = () => {
    if (!menu?.week_start || !activeSlug) return;
    exportPublicMenuPdf(activeSlug, menu.week_start, tokenFromUrl || undefined);
  };

  const filteredSchools = useMemo(
    () =>
      schools.filter(
        (school) =>
          school.name.toLowerCase().includes(search.toLowerCase()) ||
          school.city.toLowerCase().includes(search.toLowerCase()),
      ),
    [schools, search],
  );

  const groupedDays = useMemo(() => {
    if (!menu?.items?.length) return [] as GroupedDay[];

    const byDay: Record<string, GroupedDay> = {};
    menu.items.forEach((item) => {
      if (!byDay[item.day_of_week]) {
        byDay[item.day_of_week] = {
          dayCode: item.day_of_week,
          dayLabel: DAY_NAMES[item.day_of_week] || item.day_of_week,
          meals: [],
        };
      }

      byDay[item.day_of_week].meals.push({
        id: item.id,
        mealType: item.meal_type,
        mealLabel:
          MEAL_TYPE_LABELS[item.meal_type] || item.meal_type || "Refeicao",
        mealName: item.meal_name || "",
        portionText: item.portion_text || "",
        description: item.description || "",
        recipe: item.recipe || null,
        recipeName: item.recipe_name || "",
      });
    });

    return DAY_ORDER.filter((dayCode) => byDay[dayCode]).map(
      (dayCode) => byDay[dayCode],
    );
  }, [menu]);

  useEffect(() => {
    if (!groupedDays.length) {
      setCurrentDayIndex(0);
      return;
    }

    const nowDay = new Date().getDay();
    const currentCode = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][
      nowDay
    ];
    const foundIndex = groupedDays.findIndex(
      (day) => day.dayCode === currentCode,
    );
    setCurrentDayIndex(foundIndex >= 0 ? foundIndex : 0);
  }, [groupedDays]);

  const currentDay = groupedDays[currentDayIndex];

  const currentDayTitle = useMemo(() => {
    if (!currentDay) return "Menu do dia";
    if (!menu?.week_start) return currentDay.dayLabel;

    try {
      const offsetByCode: Record<string, number> = {
        MON: 0,
        TUE: 1,
        WED: 2,
        THU: 3,
        FRI: 4,
      };
      const base = new Date(`${menu.week_start}T12:00:00`);
      const date = new Date(base);
      date.setDate(base.getDate() + (offsetByCode[currentDay.dayCode] ?? 0));
      return capitalizeText(
        date.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        }),
      );
    } catch {
      return currentDay.dayLabel;
    }
  }, [currentDay, menu?.week_start]);

  const currentMealCards = useMemo(() => {
    if (!currentDay?.meals.length) return [] as MealCard[];

    const grouped: Record<string, MealCard> = {};
    currentDay.meals.forEach((meal) => {
      const meta = MEAL_META[meal.mealType] || defaultMealMeta;
      if (!grouped[meal.mealType]) {
        grouped[meal.mealType] = {
          key: meal.mealType,
          label: meal.mealLabel,
          icon: meta.icon,
          timeLabel: meta.timeLabel,
          iconToneClass: meta.iconToneClass,
          badgeToneClass: meta.badgeToneClass,
          featured: meta.featured,
          items: [],
        };
      }

      grouped[meal.mealType].items.push({
        id: meal.id,
        title: meal.mealName || meal.recipeName || meal.mealLabel,
        summary: meal.description || meal.mealName || "Item sem descricao",
        displayText: buildMealText(meal),
        recipe: meal.recipe,
        recipeName: meal.recipeName || meal.mealName || meal.mealLabel,
      });
    });

    return Object.values(grouped).sort((left, right) => {
      const leftIndex = MEAL_ORDER.indexOf(left.key);
      const rightIndex = MEAL_ORDER.indexOf(right.key);
      return (
        (leftIndex === -1 ? 99 : leftIndex) -
        (rightIndex === -1 ? 99 : rightIndex)
      );
    });
  }, [currentDay]);

  const currentNutrition = currentDay?.dayCode
    ? menu?.nutritional_info?.[currentDay.dayCode]
    : undefined;

  const weekLabel = useMemo(
    () => formatWeekRange(menu?.week_start, menu?.week_end),
    [menu?.week_end, menu?.week_start],
  );

  const footerBadges = useMemo(() => {
    const badges = [
      currentMealCards.length
        ? `${currentMealCards.length} refeicoes planejadas`
        : null,
      currentMealCards.some((card) =>
        card.items.some((item) => Boolean(item.recipe)),
      )
        ? "Receitas disponiveis"
        : "Cardapio publicado",
      menu?.author_name ? "Responsavel tecnico informado" : null,
    ].filter(Boolean) as string[];

    return badges.slice(0, 3);
  }, [currentMealCards, menu?.author_name]);

  const navigateDay = (direction: "prev" | "next") => {
    if (!groupedDays.length) return;
    setCurrentDayIndex((previousIndex) => {
      if (direction === "prev") {
        return previousIndex === 0 ? groupedDays.length - 1 : previousIndex - 1;
      }
      return previousIndex === groupedDays.length - 1 ? 0 : previousIndex + 1;
    });
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const delta = endX - touchStartX;
    if (Math.abs(delta) > 48) {
      navigateDay(delta > 0 ? "prev" : "next");
    }
    setTouchStartX(null);
  };

  const renderRecipeLinks = (items: MealCardItem[]) => {
    const recipeItems = items.filter((item) => Boolean(item.recipe));
    if (!recipeItems.length) return null;

    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {recipeItems.map((item) => (
          <button
            key={`recipe-${item.id}`}
            type="button"
            onClick={() => item.recipe && handleViewRecipe(item.recipe)}
            className="flex items-center gap-1 text-sm font-bold text-[#2251db] transition-all hover:underline"
          >
            Ver Receita
            <span className="material-symbols-outlined text-[18px]">
              arrow_forward
            </span>
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#f7f9fb] px-6 text-[#2c3437]"
        style={pageFont}
      >
        <div className="flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-[0_12px_30px_rgba(44,52,55,0.08)]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d3e4fe] border-t-[#2251db]" />
          <span className="text-sm font-semibold text-[#506076]">
            Carregando cardapio...
          </span>
        </div>
      </div>
    );
  }

  if (!selectedSchool && !slugFromUrl) {
    return (
      <div
        className="min-h-screen bg-[#f7f9fb] text-[#2c3437]"
        style={pageFont}
      >
        <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#f7f9fb]/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
            <h1
              className="text-xl font-extrabold tracking-tighter text-[#2251db]"
              style={headlineFont}
            >
              NutriSemed
            </h1>
            <button
              type="button"
              onClick={() => navigate("/public/calculator")}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#506076] shadow-sm transition-colors hover:bg-[#eaeff2]"
            >
              <span className="material-symbols-outlined text-[20px]">
                calculate
              </span>
              Calculadora
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-6 py-12 pb-24">
          <section className="mb-10">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-[#2251db]">
              PLANEJAMENTO ALIMENTAR
            </span>
            <h2
              className="text-4xl font-extrabold tracking-tight text-[#2c3437] md:text-5xl"
              style={headlineFont}
            >
              Cardapios Publicos
            </h2>
            <p className="mt-3 max-w-2xl text-base text-[#596064] md:text-lg">
              Selecione uma escola para abrir o cardapio publicado da semana e
              navegar pelas refeicoes do dia.
            </p>
          </section>

          <div className="rounded-[2rem] bg-white p-4 shadow-[0_12px_40px_rgba(44,52,55,0.06)]">
            <label className="relative block">
              <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#747c80]">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar escola ou cidade"
                className="w-full rounded-2xl border border-[#dce4e8] bg-[#f7f9fb] py-4 pl-12 pr-4 text-sm text-[#2c3437] outline-none transition-colors placeholder:text-[#747c80] focus:border-[#2251db]"
              />
            </label>
          </div>

          {error ? (
            <div className="mt-6 rounded-3xl border border-[#fa746f] bg-[#fff4f3] px-5 py-4 text-sm font-medium text-[#6e0a12]">
              {error}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {filteredSchools.length === 0 ? (
              <div className="rounded-[2rem] bg-white p-10 text-center shadow-[0_12px_40px_rgba(44,52,55,0.06)] md:col-span-2">
                <span className="material-symbols-outlined text-5xl text-[#747c80]">
                  school
                </span>
                <p className="mt-4 text-base font-semibold text-[#2c3437]">
                  Nenhuma escola encontrada.
                </p>
                <p className="mt-2 text-sm text-[#596064]">
                  Ajuste a busca ou publique um cardapio para a semana atual.
                </p>
              </div>
            ) : (
              filteredSchools.map((school) => (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => loadMenu(school)}
                  className="group rounded-[2rem] bg-white p-6 text-left shadow-[0_12px_40px_rgba(44,52,55,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(44,52,55,0.09)]"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-[#d3e4fe] p-4 text-[#2251db] transition-transform duration-300 group-hover:scale-105">
                      <span className="material-symbols-outlined text-3xl">
                        apartment
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3
                            className="text-xl font-extrabold text-[#2c3437]"
                            style={headlineFont}
                          >
                            {school.name}
                          </h3>
                          <p className="mt-2 text-sm text-[#596064]">
                            {school.city || "Cidade nao informada"}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-[#acb3b7] transition-colors group-hover:text-[#2251db]">
                          arrow_outward
                        </span>
                      </div>

                      {school.author_name ? (
                        <div className="mt-4 inline-flex rounded-full bg-[#eaeff2] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#4d5d73]">
                          Nutricionista: {school.author_name}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#2c3437]" style={pageFont}>
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#f7f9fb]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            {!slugFromUrl ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#506076] transition-colors hover:bg-slate-200/60"
                title="Voltar para escolas"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
            ) : null}
            <h1
              className="text-xl font-extrabold tracking-tighter text-[#2251db]"
              style={headlineFont}
            >
              NutriSemed
            </h1>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            <span className="rounded-lg border-b-2 border-[#2251db] px-3 py-1 font-bold text-[#2251db]">
              Cardapio
            </span>
            <button
              type="button"
              onClick={() => navigate("/public/calculator")}
              className="rounded-lg px-3 py-1 font-medium text-[#596064] transition-colors hover:bg-slate-200/50"
            >
              Calculadora
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!menu}
              className="rounded-lg px-3 py-1 font-medium text-[#596064] transition-colors hover:bg-slate-200/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              PDF
            </button>
            {!slugFromUrl ? (
              <button
                type="button"
                onClick={goBack}
                className="rounded-lg px-3 py-1 font-medium text-[#596064] transition-colors hover:bg-slate-200/50"
              >
                Escolas
              </button>
            ) : null}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!menu}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#506076] transition-colors hover:bg-slate-200/60 disabled:cursor-not-allowed disabled:opacity-50"
              title="Baixar PDF"
            >
              <span className="material-symbols-outlined">calendar_today</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/public/calculator")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#506076] transition-colors hover:bg-slate-200/60"
              title="Abrir calculadora publica"
            >
              <span className="material-symbols-outlined">calculate</span>
            </button>
          </div>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-4xl px-6 py-12 pb-32"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {loadingMenu ? (
          <div className="flex justify-center py-20">
            <div className="flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-[0_12px_30px_rgba(44,52,55,0.08)]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d3e4fe] border-t-[#2251db]" />
              <span className="text-sm font-semibold text-[#506076]">
                Carregando cardapio...
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-[#fa746f] bg-[#fff4f3] px-6 py-8 text-center shadow-[0_12px_40px_rgba(44,52,55,0.05)]">
            <span className="material-symbols-outlined text-4xl text-[#a83836]">
              error
            </span>
            <p className="mt-4 text-base font-semibold text-[#6e0a12]">
              {error}
            </p>
            {!slugFromUrl ? (
              <button
                type="button"
                onClick={goBack}
                className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#506076] shadow-sm transition-colors hover:bg-[#eaeff2]"
              >
                Escolher outra escola
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <section className="mb-10">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-[#2251db]">
                PLANEJAMENTO ALIMENTAR
              </span>
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2
                    className="text-4xl font-extrabold tracking-tight text-[#2c3437] md:text-5xl"
                    style={headlineFont}
                  >
                    Menu do Dia
                  </h2>
                  <p className="mt-2 text-lg text-[#596064]">
                    {currentDayTitle}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#596064]">
                    {selectedSchool?.name || menu?.school_name ? (
                      <span className="rounded-full bg-white px-3 py-1 shadow-sm">
                        {selectedSchool?.name || menu?.school_name}
                      </span>
                    ) : null}
                    {weekLabel ? (
                      <span className="rounded-full bg-white px-3 py-1 shadow-sm">
                        Semana: {weekLabel}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigateDay("prev")}
                    className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-[#506076] shadow-sm transition-colors hover:bg-[#eaeff2]"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      chevron_left
                    </span>
                    Dia anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateDay("next")}
                    className="flex items-center gap-2 rounded-xl bg-[#2251db] px-5 py-3 font-semibold text-white shadow-[0_14px_30px_rgba(34,81,219,0.2)] transition-opacity hover:opacity-90"
                  >
                    Proximo dia
                    <span className="material-symbols-outlined text-[20px]">
                      chevron_right
                    </span>
                  </button>
                </div>
              </div>
            </section>

            {groupedDays.length > 1 ? (
              <div className="mb-8 flex flex-wrap gap-2">
                {groupedDays.map((day, index) => (
                  <button
                    key={day.dayCode}
                    type="button"
                    onClick={() => setCurrentDayIndex(index)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      index === currentDayIndex
                        ? "bg-[#2251db] text-white shadow-[0_10px_20px_rgba(34,81,219,0.16)]"
                        : "bg-white text-[#506076] shadow-sm hover:bg-[#eaeff2]"
                    }`}
                  >
                    {day.dayLabel}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="space-y-6">
              {currentMealCards.length === 0 ? (
                <article className="rounded-[2rem] bg-white p-10 text-center shadow-[0_12px_40px_rgba(44,52,55,0.06)]">
                  <span className="material-symbols-outlined text-5xl text-[#747c80]">
                    restaurant_menu
                  </span>
                  <p className="mt-4 text-lg font-semibold text-[#2c3437]">
                    Nenhuma refeicao registrada para este dia.
                  </p>
                  <p className="mt-2 text-sm text-[#596064]">
                    Publique os itens do cardapio para exibir esta tela.
                  </p>
                </article>
              ) : (
                currentMealCards.map((card) => {
                  if (card.featured) {
                    const primaryItem = card.items[0];
                    const secondaryItems = card.items.slice(1);

                    return (
                      <article
                        key={card.key}
                        className="group relative overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-[0_12px_40px_rgba(44,52,55,0.06)] ring-1 ring-[#2251db]/5 transition-all duration-300 hover:shadow-[0_18px_44px_rgba(44,52,55,0.1)]"
                      >
                        <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-[#2251db]/5" />
                        <div className="relative z-10 flex items-start gap-6">
                          <div className="rounded-[2rem] bg-blue-50 p-5 text-[#2251db] transition-transform duration-300 group-hover:rotate-3">
                            <span className="material-symbols-outlined text-4xl">
                              {card.icon}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <h3
                                className="text-2xl font-bold text-[#2251db]"
                                style={headlineFont}
                              >
                                {card.label}
                              </h3>
                              <span className="rounded-full bg-[#2251db] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white">
                                {card.timeLabel}
                              </span>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <h4
                                  className="text-lg font-extrabold text-[#2c3437]"
                                  style={headlineFont}
                                >
                                  {primaryItem?.title || "Preparacao principal"}
                                </h4>
                                <p className="mt-1 leading-relaxed text-[#596064]">
                                  {primaryItem?.displayText ||
                                    "Item sem descricao"}
                                </p>
                              </div>

                              {secondaryItems.length ? (
                                <div className="flex flex-wrap items-center gap-3 pt-2 text-sm text-[#596064]">
                                  <span className="font-bold text-[#2251db]">
                                    Acompanha
                                  </span>
                                  {secondaryItems.map((item, index) => (
                                    <React.Fragment key={item.id}>
                                      {index > 0 ? (
                                        <span className="h-1 w-1 rounded-full bg-[#acb3b7]" />
                                      ) : null}
                                      <span>
                                        {item.title || item.displayText}
                                      </span>
                                    </React.Fragment>
                                  ))}
                                </div>
                              ) : null}

                              {renderRecipeLinks(card.items)}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  }

                  return (
                    <article
                      key={card.key}
                      className="group rounded-[1.75rem] bg-white p-6 shadow-[0_4px_20px_rgba(44,52,55,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(44,52,55,0.08)]"
                    >
                      <div className="flex items-start gap-5">
                        <div
                          className={`rounded-2xl p-4 transition-transform duration-300 group-hover:scale-110 ${card.iconToneClass}`}
                        >
                          <span className="material-symbols-outlined text-3xl">
                            {card.icon}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <h3
                              className="text-xl font-bold text-[#2c3437]"
                              style={headlineFont}
                            >
                              {card.label}
                            </h3>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${card.badgeToneClass}`}
                            >
                              {card.timeLabel}
                            </span>
                          </div>

                          {card.items.length === 1 ? (
                            <p className="leading-relaxed text-[#596064]">
                              {card.items[0].displayText}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {card.items.map((item) => (
                                <p
                                  key={item.id}
                                  className="leading-relaxed text-[#596064]"
                                >
                                  {item.displayText}
                                </p>
                              ))}
                            </div>
                          )}

                          {renderRecipeLinks(card.items)}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <section className="relative mt-16 overflow-hidden rounded-[2rem] bg-[#f0f4f7] p-8">
              <h3 className="mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-[#596064]">
                Informacoes Nutricionais Diarias
              </h3>

              <div className="mx-auto grid max-w-2xl grid-cols-3 gap-4 md:gap-12">
                <div className="text-center">
                  <p
                    className="text-3xl font-extrabold text-[#2c3437]"
                    style={headlineFont}
                  >
                    {formatMetric(currentNutrition?.kcal)}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#2251db]">
                    Kcal Total
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className="text-3xl font-extrabold text-[#2c3437]"
                    style={headlineFont}
                  >
                    {formatMetric(currentNutrition?.protein, "g")}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#2251db]">
                    Proteinas
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className="text-3xl font-extrabold text-[#2c3437]"
                    style={headlineFont}
                  >
                    {formatMetric(currentNutrition?.carbs, "g")}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#2251db]">
                    Carbos
                  </p>
                </div>
              </div>

              {footerBadges.length ? (
                <div className="mt-8 flex justify-center border-t border-[#acb3b7]/15 pt-6">
                  <div className="flex flex-wrap justify-center gap-2">
                    {footerBadges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full bg-[#d3e4fe] px-3 py-1 text-[10px] font-bold uppercase tracking-tight text-[#435368]"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-8 text-center">
                <p className="text-xs uppercase tracking-[0.18em] text-[#596064]">
                  Responsavel tecnico
                </p>
                <p className="mt-2 text-sm font-semibold text-[#2c3437]">
                  {menu?.author_name || "Nao informado"}
                </p>
                {menu?.author_crn ? (
                  <p className="mt-1 text-xs text-[#596064]">
                    CRN: {menu.author_crn}
                  </p>
                ) : null}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-[1.75rem] bg-white/80 px-4 pb-6 pt-3 shadow-[0_-4px_20px_rgba(44,52,55,0.05)] backdrop-blur-xl md:hidden">
        <button
          type="button"
          className="flex flex-col items-center justify-center rounded-2xl bg-blue-100 px-5 py-2 text-blue-800 transition-transform hover:scale-105"
        >
          <span className="material-symbols-outlined">restaurant_menu</span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wider">
            Cardapio
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate("/public/calculator")}
          className="flex flex-col items-center justify-center px-5 py-2 text-slate-400 transition-transform hover:scale-105"
        >
          <span className="material-symbols-outlined">calculate</span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wider">
            Calc
          </span>
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={!menu}
          className="flex flex-col items-center justify-center px-5 py-2 text-slate-400 transition-transform hover:scale-105 disabled:opacity-50"
        >
          <span className="material-symbols-outlined">calendar_month</span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wider">
            PDF
          </span>
        </button>
        {!slugFromUrl ? (
          <button
            type="button"
            onClick={goBack}
            className="flex flex-col items-center justify-center px-5 py-2 text-slate-400 transition-transform hover:scale-105"
          >
            <span className="material-symbols-outlined">person</span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-wider">
              Escola
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex flex-col items-center justify-center px-5 py-2 text-slate-400 transition-transform hover:scale-105"
          >
            <span className="material-symbols-outlined">home</span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-wider">
              Inicio
            </span>
          </button>
        )}
      </footer>

      {viewingRecipeId ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="my-auto flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 md:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2251db]">
                  Cartao de Receita
                </p>
                <h2
                  className="mt-1 text-2xl font-extrabold text-[#2c3437]"
                  style={headlineFont}
                >
                  {recipeData?.name || "Receita"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingRecipeId(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-5 md:px-6">
              {loadingRecipe ? (
                <div className="flex justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d3e4fe] border-t-[#2251db]" />
                </div>
              ) : !recipeData ? (
                <div className="rounded-[1.5rem] bg-[#f0f4f7] px-6 py-10 text-center text-sm text-[#596064]">
                  Falha ao carregar a receita.
                </div>
              ) : (
                <div className="space-y-6">
                  {recipeData.category ? (
                    <div className="inline-flex rounded-full bg-[#d3e4fe] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#435368]">
                      {recipeData.category}
                    </div>
                  ) : null}
                  {recipeData.instructions ? (
                    <section className="rounded-[1.5rem] bg-[#f7f9fb] p-5">
                      <h3
                        className="text-lg font-extrabold text-[#2c3437]"
                        style={headlineFont}
                      >
                        Orientacoes gerais
                      </h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#596064]">
                        {recipeData.instructions}
                      </p>
                    </section>
                  ) : null}

                  {recipeData.tags?.prep_steps?.length ? (
                    <section className="rounded-[1.5rem] bg-[#f7f9fb] p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3
                          className="text-lg font-extrabold text-[#2c3437]"
                          style={headlineFont}
                        >
                          Modo de preparo
                        </h3>
                        {recipeData.tags.prep_time_minutes ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#d3e4fe] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#435368]">
                            <span className="material-symbols-outlined text-[14px]">
                              timer
                            </span>
                            {recipeData.tags.prep_time_minutes} min
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-4">
                        {recipeData.tags.prep_steps.map((step, index) => (
                          <div key={`step-${index}`} className="flex gap-4">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d3e4fe] text-sm font-bold text-[#2251db]">
                              {index + 1}
                            </div>
                            <p className="text-sm leading-relaxed text-[#596064]">
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {recipeData.tags?.nutrition ? (
                    <section className="rounded-[1.5rem] bg-[#f0f4f7] p-5">
                      <h3
                        className="text-lg font-extrabold text-[#2c3437]"
                        style={headlineFont}
                      >
                        Informacao nutricional
                      </h3>
                      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#596064]">
                            Energia
                          </p>
                          <p
                            className="mt-1 text-2xl font-extrabold text-[#2251db]"
                            style={headlineFont}
                          >
                            {formatMetric(recipeData.tags.nutrition.kcal)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#596064]">
                            Proteinas
                          </p>
                          <p
                            className="mt-1 text-2xl font-extrabold text-[#2251db]"
                            style={headlineFont}
                          >
                            {formatMetric(
                              recipeData.tags.nutrition.protein,
                              "g",
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#596064]">
                            Carbos
                          </p>
                          <p
                            className="mt-1 text-2xl font-extrabold text-[#2251db]"
                            style={headlineFont}
                          >
                            {formatMetric(recipeData.tags.nutrition.carbs, "g")}
                          </p>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {recipeData.ingredients?.length ? (
                    <section className="rounded-[1.5rem] bg-[#f7f9fb] p-5">
                      <h3
                        className="text-lg font-extrabold text-[#2c3437]"
                        style={headlineFont}
                      >
                        Ingredientes
                      </h3>
                      <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white">
                        {recipeData.ingredients.map((ingredient, index) => (
                          <li
                            key={`ingredient-${index}`}
                            className="flex items-center justify-between gap-4 px-4 py-3"
                          >
                            <span className="text-sm text-[#2c3437]">
                              {ingredient.supply_name}
                              {ingredient.optional ? " (Opcional)" : ""}
                            </span>
                            <span className="rounded-full bg-[#eaeff2] px-3 py-1 text-xs font-semibold text-[#4d5d73]">
                              {ingredient.qty_base || "-"}{" "}
                              {ingredient.unit || ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PublicMenu;
