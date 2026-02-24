import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { clearDashboardConsumptionSeries, getDashboard, getDashboardSeries } from '../api';

const defaultData = [
  { name: 'Jan', value: 40 },
  { name: 'Fev', value: 65 },
  { name: 'Mar', value: 85 },
  { name: 'Abr', value: 30 },
  { name: 'Mai', value: 20 },
];

function useChartContainerReady(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }

    const el = ref.current;
    if (!el) {
      setReady(false);
      return;
    }

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setReady(width > 0 && height > 0);
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return { ref, ready };
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    schools_total: 0,
    schools_active: 0,
    supplies_total: 0,
    low_stock: 0,
    menus_published: 0,
    month_summary: {
      meals_served: 0,
      deliveries_realized: 0,
    },
    recent_activities: [] as Array<{
      title: string;
      subtitle: string;
      icon: string;
      iconBg: string;
      iconColor: string;
    }>,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [series, setSeries] = useState(defaultData);
  const [servedBySchoolCategory, setServedBySchoolCategory] = useState<Array<{
    school_id: string;
    school_name: string;
    meal_type: string;
    meal_label: string;
    value: number;
  }>>([]);
  const [selectedSchool, setSelectedSchool] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [chartsReady, setChartsReady] = useState(false);
  const [isClearingConsumption, setIsClearingConsumption] = useState(false);
  const consumptionChartContainer = useChartContainerReady(chartsReady);
  const servedChartContainer = useChartContainerReady(chartsReady);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setChartsReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const loadDashboardSeries = async () => {
    const data: any = await getDashboardSeries();
    setSeries(data?.consumption_by_month?.length ? data.consumption_by_month : []);
    setServedBySchoolCategory(data?.served_by_school_category || []);
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      getDashboard()
        .then((data) => setMetrics((prev) => ({ ...prev, ...data })))
        .catch(() => setError('Não foi possível carregar o painel.')),
      loadDashboardSeries()
        .catch(() => { })
    ]).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(''), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const handleClearConsumption = async () => {
    const confirmed = window.confirm('Limpar apenas consumos órfãos do gráfico mensal (saídas de estoque sem escola, geralmente após excluir escolas)? Esta ação não pode ser desfeita.');
    if (!confirmed) return;

    setError('');
    setSuccess('');
    setIsClearingConsumption(true);
    try {
      const result = await clearDashboardConsumptionSeries();
      await loadDashboardSeries();
      setSuccess(result?.deleted_count
        ? `Consumos órfãos removidos. ${result.deleted_count} registro(s) removido(s).`
        : 'Nenhum consumo órfão encontrado.');
    } catch {
      setError('Não foi possível limpar os consumos órfãos.');
    } finally {
      setIsClearingConsumption(false);
    }
  };

  const schoolsOptions = useMemo(
    () => Array.from(new Set(servedBySchoolCategory.map((item) => item.school_name))).sort((a, b) => a.localeCompare(b)),
    [servedBySchoolCategory],
  );
  const categories = useMemo(
    () => Array.from(new Set(servedBySchoolCategory.map((item) => item.meal_label))),
    [servedBySchoolCategory],
  );
  const categoryKeys = useMemo(
    () =>
      categories.reduce<Record<string, string>>((acc, label, index) => {
        acc[label] = `cat_${index}`;
        return acc;
      }, {}),
    [categories],
  );
  const servedChartData = useMemo(() => {
    const grouped = servedBySchoolCategory.reduce<Record<string, any>>((acc, item) => {
      const row = acc[item.school_name] || { school_name: item.school_name };
      const key = categoryKeys[item.meal_label];
      row[key] = (row[key] || 0) + item.value;
      acc[item.school_name] = row;
      return acc;
    }, {});
    return Object.values(grouped)
      .filter((row: any) => selectedSchool === 'ALL' || row.school_name === selectedSchool)
      .sort((a: any, b: any) => a.school_name.localeCompare(b.school_name));
  }, [categoryKeys, selectedSchool, servedBySchoolCategory]);
  const chartPalette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

  const statCards = [
    {
      icon: 'school',
      label: 'Escolas',
      value: metrics.schools_total,
      subValue: `${metrics.schools_active} Ativas`,
      subColor: 'text-success-500',
      gradient: 'from-primary-500 to-primary-600',
      iconBg: 'bg-primary-100 dark:bg-primary-900/30',
      iconColor: 'text-primary-500',
    },
    {
      icon: 'inventory_2',
      label: 'Insumos',
      value: metrics.supplies_total,
      subValue: 'Cadastrados',
      subColor: 'text-slate-500',
      gradient: 'from-secondary-500 to-secondary-600',
      iconBg: 'bg-secondary-100 dark:bg-secondary-900/30',
      iconColor: 'text-secondary-500',
    },
    {
      icon: 'warning',
      label: 'Alertas',
      value: metrics.low_stock,
      subValue: 'Estoque Crítico',
      subColor: 'text-danger-500',
      gradient: 'from-danger-500 to-danger-600',
      iconBg: 'bg-danger-100 dark:bg-danger-900/30',
      iconColor: 'text-danger-500',
      isAlert: true,
    },
    {
      icon: 'restaurant_menu',
      label: 'Cardápios',
      value: metrics.menus_published,
      subValue: 'Publicados',
      subColor: 'text-accent-500',
      gradient: 'from-accent-500 to-accent-600',
      iconBg: 'bg-accent-100 dark:bg-accent-900/30',
      iconColor: 'text-accent-500',
    },
  ];

  const quickActions = [
    { icon: 'inventory_2', label: 'Gerenciar Estoque', path: '/admin/inventory', color: 'bg-secondary-500' },
    { icon: 'school', label: 'Gerenciar Escolas', path: '/admin/schools', color: 'bg-primary-500' },
    { icon: 'local_shipping', label: 'Ver Entregas', path: '/admin/deliveries', color: 'bg-accent-500' },
  ];

  return (
    <div className="pb-24 lg:pb-8">
      {/* Welcome Header */}
      <div className="p-4 lg:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">
              Olá, Admin! 👋
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Aqui está o resumo do seu sistema
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/editor')}
            className="hidden md:flex btn-primary"
          >
            <span className="material-symbols-outlined">add</span>
            Novo Cardápio
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 rounded-xl bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined">check_circle</span>
            {success}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {statCards.map((stat, index) => (
            <div
              key={stat.label}
              className={`card p-4 lg:p-5 ${stat.isAlert && stat.value > 0 ? 'border-danger-200 dark:border-danger-900/50 bg-danger-50/50 dark:bg-danger-900/10' : ''} animate-fade-in`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                  <span className={`material-symbols-outlined ${stat.iconColor}`}>{stat.icon}</span>
                </div>
              </div>
              <p className={`text-3xl lg:text-4xl font-bold ${stat.isAlert && stat.value > 0 ? 'text-danger-600 dark:text-danger-400' : 'text-slate-900 dark:text-white'}`}>
                {isLoading ? <span className="skeleton w-12 h-8 block"></span> : stat.value}
              </p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <span className={`text-xs font-semibold ${stat.subColor}`}>{stat.subValue}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-6 px-4 lg:px-6">
        {/* Left Column - Quick Actions & Chart */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {/* Quick Actions */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Ações Rápidas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className="card p-4 flex items-center gap-3 hover:shadow-card-hover group"
                >
                  <div className={`w-11 h-11 rounded-xl ${action.color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                    <span className="material-symbols-outlined text-white">{action.icon}</span>
                  </div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{action.label}</span>
                  <span className="material-symbols-outlined text-slate-400 ml-auto">chevron_right</span>
                </button>
              ))}
            </div>

            {/* CTA Button Mobile */}
            <button
              onClick={() => navigate('/admin/editor')}
              className="w-full mt-3 md:hidden btn bg-gradient-primary text-white h-14 text-base shadow-lg shadow-primary-500/30"
            >
              <span className="material-symbols-outlined">add_task</span>
              Montar Novo Cardápio
            </button>
          </div>

          {/* Chart */}
          <div className="card p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Consumo Mensal</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="w-3 h-3 rounded-full bg-primary-500"></span>
                  <span>Saídas de estoque</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearConsumption}
                  disabled={isClearingConsumption}
                  className="text-xs font-semibold text-danger-600 hover:text-danger-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Limpar apenas consumos órfãos do gráfico mensal"
                >
                  {isClearingConsumption ? 'Limpando...' : 'Limpar órfãos'}
                </button>
              </div>
            </div>
            <div ref={consumptionChartContainer.ref} className="h-64 min-h-[16rem] min-w-0">
              {chartsReady && consumptionChartContainer.ready ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                        backgroundColor: 'white',
                        padding: '8px 12px'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full" />
              )}
            </div>
          </div>

          <div className="card p-4 lg:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Refeicoes Servidas por Categoria e Escola</h3>
              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="input w-full sm:w-72"
              >
                <option value="ALL">Todas as escolas</option>
                {schoolsOptions.map((school) => (
                  <option key={school} value={school}>{school}</option>
                ))}
              </select>
            </div>

            {servedChartData.length === 0 ? (
              <div className="text-sm text-slate-500 py-10 text-center">
                Sem lancamentos de refeicoes servidas ainda.
              </div>
            ) : (
              <div ref={servedChartContainer.ref} className="h-80 min-h-[20rem] min-w-0">
                {chartsReady && servedChartContainer.ready ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                    <BarChart data={servedChartData} margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="school_name" stroke="#64748b" fontSize={12} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Legend />
                      {categories.map((category, index) => (
                        <Bar
                          key={category}
                          dataKey={categoryKeys[category]}
                          name={category}
                          stackId="served"
                          fill={chartPalette[index % chartPalette.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Activity */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Atividade Recente</h3>
          <div className="card divide-y divide-slate-100 dark:divide-slate-700">
            {metrics.recent_activities?.length > 0 ? (
              metrics.recent_activities.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <div className={`w-11 h-11 rounded-xl ${activity.iconBg} flex items-center justify-center shrink-0`}>
                    <span className={`material-symbols-outlined ${activity.iconColor}`}>{activity.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">{activity.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{activity.subtitle}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">history</span>
                <p className="text-sm">Nenhuma atividade recente</p>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="mt-4 card p-4 bg-gradient-to-br from-primary-500 to-secondary-500 text-white">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-2xl">trending_up</span>
              <span className="font-semibold">Resumo do Mês</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold">{metrics.month_summary?.meals_served || 0}</p>
                <p className="text-xs text-white/70">Refeições servidas</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.month_summary?.deliveries_realized || 0}</p>
                <p className="text-xs text-white/70">Entregas realizadas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
