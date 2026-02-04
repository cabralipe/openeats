import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { getDashboard, getDashboardSeries } from '../api';

const data = [
  { name: 'Jan', value: 40 },
  { name: 'Fev', value: 65 },
  { name: 'Mar', value: 85 },
  { name: 'Abr', value: 30 },
  { name: 'Mai', value: 20 },
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    schools_total: 0,
    schools_active: 0,
    supplies_total: 0,
    low_stock: 0,
    menus_published: 0,
  });
  const [error, setError] = useState('');
  const [series, setSeries] = useState(data);

  useEffect(() => {
    getDashboard()
      .then((data) => setMetrics(data))
      .catch(() => setError('Nao foi possivel carregar o painel.'));
    getDashboardSeries()
      .then((data) => {
        if (data?.consumption_by_month?.length) {
          setSeries(data.consumption_by_month);
        }
      })
      .catch(() => setError('Nao foi possivel carregar o grafico.'));
  }, []);

  return (
    <div className="pb-24">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="flex flex-col gap-1 rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-lg">school</span>
            <p className="text-[#4e7397] dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Escolas</p>
          </div>
          <p className="text-[#0d141b] dark:text-slate-100 tracking-tight text-2xl font-bold">{metrics.schools_total}</p>
          <p className="text-green-500 text-[10px] font-bold">{metrics.schools_active} Ativas</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-lg">inventory_2</span>
            <p className="text-[#4e7397] dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Insumos</p>
          </div>
          <p className="text-[#0d141b] dark:text-slate-100 tracking-tight text-2xl font-bold">{metrics.supplies_total}</p>
          <p className="text-slate-500 text-[10px] font-bold uppercase">Cadastrados</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm border border-red-100 dark:border-red-900/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-red-500 text-lg">warning</span>
            <p className="text-[#4e7397] dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Estoque</p>
          </div>
          <p className="text-red-600 dark:text-red-400 tracking-tight text-2xl font-bold">{metrics.low_stock}</p>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 w-fit">Alertas Críticos</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-lg">restaurant_menu</span>
            <p className="text-[#4e7397] dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Cardápios</p>
          </div>
          <p className="text-[#0d141b] dark:text-slate-100 tracking-tight text-2xl font-bold">{metrics.menus_published}</p>
          <p className="text-blue-500 text-[10px] font-bold uppercase">Publicados</p>
        </div>
      </div>
      {error && <div className="px-4 text-red-600 text-sm">{error}</div>}

      {/* Quick Actions Section */}
      <h3 className="text-[#0d141b] dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-2">Ações Rápidas</h3>
      <div className="px-4 py-2">
        <div className="flex flex-col gap-3">
          <button onClick={() => navigate('/admin/inventory')} className="flex items-center justify-between overflow-hidden rounded-xl h-14 px-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0d141b] dark:text-slate-100 text-base font-bold shadow-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">edit_note</span>
              <span>Gerenciar Insumos</span>
            </div>
            <span className="material-symbols-outlined text-slate-400">chevron_right</span>
          </button>
          <button onClick={() => navigate('/admin/schools')} className="flex items-center justify-between overflow-hidden rounded-xl h-14 px-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0d141b] dark:text-slate-100 text-base font-bold shadow-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">domain</span>
              <span>Gerenciar Escolas</span>
            </div>
            <span className="material-symbols-outlined text-slate-400">chevron_right</span>
          </button>
          <button onClick={() => navigate('/admin/editor')} className="flex items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary text-white text-base font-bold shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined mr-2">add_task</span>
            <span>Montar Novo Cardápio</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <h3 className="text-[#0d141b] dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-6">Atividade Recente</h3>
      <div className="px-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden shadow-sm">
          <div className="flex items-center gap-4 p-4">
            <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">upload_file</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#0d141b] dark:text-slate-100 truncate">Cardápio Fundamental I - Março</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Publicado há 2 horas</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4">
            <div className="size-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600">
              <span className="material-symbols-outlined text-xl">low_priority</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#0d141b] dark:text-slate-100 truncate">Estoque de Feijão Baixo</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Escola Municipal Dom Bosco • 4h atrás</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4">
            <div className="size-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-green-600">
              <span className="material-symbols-outlined text-xl">person_add</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#0d141b] dark:text-slate-100 truncate">Novo Fornecedor Cadastrado</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Hortifruti Central • Ontem</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <h3 className="text-[#0d141b] dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-6">Consumo Mensal (Saidas)</h3>
      <div className="px-4 min-w-0">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 min-h-[220px] shadow-sm min-w-0">
          <ResponsiveContainer width="100%" height={180} minWidth={0}>
            <BarChart data={series}>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{fill: 'transparent'}}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {series.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.name === 'Mar' ? '#137fec' : '#cbd5e1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
