import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  exportConsumptionPdf,
  exportConsumptionXlsx,
  exportDeliveriesPdf,
  exportDeliveriesXlsx,
  exportDeliveryDivergencesPdf,
  exportDeliveryDivergencesXlsx,
  exportMenuPdf,
  exportMenusCsv,
  exportStockCsv,
  exportStockPdf,
  exportStockXlsx,
  exportSupplierReceiptsPdf,
  exportSupplierReceiptsXlsx,
  getAuditLogs,
  getCentralLots,
  getDashboard,
  getDashboardSeries,
  getDeliveries,
  getMenus,
  getPnaeDashboard,
  getPnaePlans,
  getRecipes,
  getSchools,
  getStockMovements,
  getSupplierReceipts,
  getSuppliers,
  getSupplies,
} from '../api';

type Section = 'overview' | 'exports' | 'deliveries' | 'consumption' | 'receipts';

const mondayOfCurrentWeek = () => {
  const d = new Date();
  const weekday = d.getDay();
  d.setDate(d.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return d.toISOString().slice(0, 10);
};

const n = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fi = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value || 0);
const fd = (value: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
const fdate = (value?: string | null) => value ? new Date(value.length <= 10 ? `${value}T12:00:00` : value).toLocaleDateString('pt-BR') : '-';
const fdatetime = (value?: string | null) => value ? new Date(value).toLocaleString('pt-BR') : '-';
const errMsg = (error: unknown, fallback: string) => error instanceof Error && error.message.trim() ? error.message : fallback;

const deliveryTone = (status?: string) => {
  if (status === 'FINALIZED' || status === 'CONFERRED') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40';
  if (status === 'IN_CONFERENCE') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40';
  if (status === 'SENT') return 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/20 dark:text-primary-300 dark:border-primary-900/40';
  return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40';
};

const deliveryLabel = (status?: string) => (
  { DRAFT: 'Rascunho', SENT: 'Enviada', IN_CONFERENCE: 'Em conferencia', CONFERRED: 'Conferida', FINALIZED: 'Finalizada' } as Record<string, string>
)[status || ''] || status || '-';

const receiptTone = (status?: string) => (
  {
    CONFERRED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40',
    IN_CONFERENCE: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40',
    EXPECTED: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-900/40',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-900/40',
  } as Record<string, string>
)[status || ''] || 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40';

const receiptLabel = (status?: string) => (
  { DRAFT: 'Rascunho', EXPECTED: 'Aguardando entrega', IN_CONFERENCE: 'Em conferencia', CONFERRED: 'Conferido', CANCELLED: 'Cancelado' } as Record<string, string>
)[status || ''] || status || '-';

const Panel: React.FC<{
  title: string;
  icon: string;
  description: string;
  items: Array<{ label: string; value: string; tone?: string }>;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, icon, description, items, footer, actions }) => (
  <div className="card p-5 h-full flex flex-col gap-4">
    <div className="flex items-start gap-3">
      <div className="w-11 h-11 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-primary-500">{icon}</span>
      </div>
      <div>
        <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3">
          <p className={`text-xl font-bold ${item.tone || 'text-slate-900 dark:text-white'}`}>{item.value}</p>
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mt-1">{item.label}</p>
        </div>
      ))}
    </div>
    {footer ? <div className="text-xs text-slate-500 leading-relaxed">{footer}</div> : null}
    {actions ? <div className="flex flex-wrap gap-2 mt-auto">{actions}</div> : null}
  </div>
);

const Reports: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [section, setSection] = useState<Section>('overview');

  const [metrics, setMetrics] = useState<any>({
    schools_total: 0,
    schools_active: 0,
    supplies_total: 0,
    low_stock: 0,
    menus_published: 0,
    month_summary: { meals_served: 0, deliveries_realized: 0 },
  });
  const [series, setSeries] = useState<any>({});
  const [schools, setSchools] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [menus, setMenus] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [allDeliveries, setAllDeliveries] = useState<any[]>([]);
  const [deliveryRows, setDeliveryRows] = useState<any[]>([]);
  const [allMovements, setAllMovements] = useState<any[]>([]);
  const [movementRows, setMovementRows] = useState<any[]>([]);
  const [allReceipts, setAllReceipts] = useState<any[]>([]);
  const [receiptRows, setReceiptRows] = useState<any[]>([]);
  const [lots, setLots] = useState<any>(null);
  const [pnaeDashboard, setPnaeDashboard] = useState<any>(null);
  const [pnaePlans, setPnaePlans] = useState<any[]>([]);
  const [audit, setAudit] = useState<{ count: number; results: any[] }>({ count: 0, results: [] });

  const [menuSchool, setMenuSchool] = useState('');
  const [weekStart, setWeekStart] = useState(mondayOfCurrentWeek());
  const [deliverySchool, setDeliverySchool] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [deliveryFrom, setDeliveryFrom] = useState('');
  const [deliveryTo, setDeliveryTo] = useState('');
  const [movementSupply, setMovementSupply] = useState('');
  const [movementSchool, setMovementSchool] = useState('');
  const [movementFrom, setMovementFrom] = useState('');
  const [movementTo, setMovementTo] = useState('');
  const [receiptSupplier, setReceiptSupplier] = useState('');
  const [receiptSchool, setReceiptSchool] = useState('');
  const [receiptStatus, setReceiptStatus] = useState('');
  const [receiptFrom, setReceiptFrom] = useState('');
  const [receiptTo, setReceiptTo] = useState('');

  useEffect(() => {
    let cancelled = false;
    const requests = [
      { key: 'indicadores', promise: getDashboard() },
      { key: 'series', promise: getDashboardSeries() },
      { key: 'escolas', promise: getSchools() },
      { key: 'insumos', promise: getSupplies() },
      { key: 'fornecedores', promise: getSuppliers() },
      { key: 'cardapios', promise: getMenus({}) },
      { key: 'receitas', promise: getRecipes() },
      { key: 'entregas', promise: getDeliveries() },
      { key: 'consumo', promise: getStockMovements({ type: 'OUT' }) },
      { key: 'recebimentos', promise: getSupplierReceipts() },
      { key: 'lotes', promise: getCentralLots({ days_to_expiry: 30 }) },
      { key: 'pnae', promise: getPnaeDashboard() },
      { key: 'planos', promise: getPnaePlans() },
      { key: 'auditoria', promise: getAuditLogs({ page_size: 5 }) },
    ] as const;

    (async () => {
      setLoading(true);
      setError('');
      setWarning('');
      const settled = await Promise.allSettled(requests.map((item) => item.promise));
      if (cancelled) return;

      const failed: string[] = [];
      settled.forEach((result, index) => {
        const key = requests[index].key;
        if (result.status === 'rejected') {
          failed.push(key);
          return;
        }

        const value: any = result.value;
        if (key === 'indicadores') setMetrics(value || metrics);
        if (key === 'series') setSeries(value || {});
        if (key === 'escolas') {
          const rows = Array.isArray(value) ? value : [];
          setSchools(rows);
          setMenuSchool((prev) => prev || rows[0]?.id || '');
        }
        if (key === 'insumos') setSupplies(Array.isArray(value) ? value : []);
        if (key === 'fornecedores') setSuppliers(Array.isArray(value) ? value : []);
        if (key === 'cardapios') setMenus(Array.isArray(value) ? value : []);
        if (key === 'receitas') setRecipes(Array.isArray(value) ? value : []);
        if (key === 'entregas') {
          const rows = Array.isArray(value) ? value : [];
          setAllDeliveries(rows);
          setDeliveryRows(rows);
        }
        if (key === 'consumo') {
          const rows = Array.isArray(value) ? value : [];
          setAllMovements(rows);
          setMovementRows(rows);
        }
        if (key === 'recebimentos') {
          const rows = Array.isArray(value) ? value : [];
          setAllReceipts(rows);
          setReceiptRows(rows);
        }
        if (key === 'lotes') setLots(value || null);
        if (key === 'pnae') setPnaeDashboard(value || null);
        if (key === 'planos') setPnaePlans(Array.isArray(value) ? value : []);
        if (key === 'auditoria') {
          setAudit({
            count: n(value?.count),
            results: Array.isArray(value?.results) ? value.results : [],
          });
        }
      });

      if (failed.length) setWarning(`Alguns conjuntos nao puderam ser carregados: ${failed.join(', ')}.`);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const schoolById = useMemo(
    () => schools.reduce<Record<string, any>>((acc, school) => ({ ...acc, [school.id]: school }), {}),
    [schools],
  );
  const supplyById = useMemo(
    () => supplies.reduce<Record<string, any>>((acc, supply) => ({ ...acc, [supply.id]: supply }), {}),
    [supplies],
  );

  const overviewCards = useMemo(() => {
    const municipalities = new Set(schools.map((school) => String(school?.municipality_name || school?.city || '').trim()).filter(Boolean)).size;
    const categories = new Set(supplies.map((supply) => String(supply?.category || '').trim()).filter(Boolean)).size;
    const menuItems = menus.reduce((sum, menu) => sum + (Array.isArray(menu?.items) ? menu.items.length : 0), 0);
    const recipeLinked = menus.reduce((sum, menu) => sum + (Array.isArray(menu?.items) ? menu.items.filter((item: any) => item?.recipe || item?.calc_mode === 'RECIPE').length : 0), 0);
    const totalServed = Array.isArray(series?.served_by_school_category)
      ? series.served_by_school_category.reduce((sum: number, row: any) => sum + n(row?.value), 0)
      : 0;
    const deliveryDivergences = allDeliveries.filter((delivery) =>
      (delivery?.items || []).some((item: any) =>
        n(item?.received_quantity ?? item?.planned_quantity) < n(item?.planned_quantity)
        || String(item?.divergence_note || '').trim(),
      )).length;
    const movementQty = allMovements.reduce((sum, row) => sum + n(row?.quantity), 0);
    const receiptDirect = allReceipts.filter((row) => row?.school).length;
    const pnaeApproved = pnaePlans.filter((plan) => plan?.status === 'APPROVED').length;

    return [
      {
        title: 'Rede escolar',
        icon: 'school',
        description: 'Cobertura de escolas, distribuicao territorial e base cadastral.',
        items: [
          { label: 'Escolas', value: fi(metrics.schools_total || schools.length) },
          { label: 'Ativas', value: fi(metrics.schools_active || schools.filter((school) => school?.is_active !== false).length), tone: 'text-emerald-600 dark:text-emerald-300' },
          { label: 'Municipios', value: fi(municipalities) },
          { label: 'Auditoria', value: fi(audit.count) },
        ],
        footer: 'Escolas, municipios e trilha de uso ficam visiveis aqui com acesso rapido aos modulos de origem.',
        actions: (
          <>
            <button onClick={() => navigate('/admin/schools')} className="btn-secondary"><span className="material-symbols-outlined">open_in_new</span>Escolas</button>
            <button onClick={() => navigate('/admin/audit')} className="btn-secondary"><span className="material-symbols-outlined">history</span>Auditoria</button>
          </>
        ),
      },
      {
        title: 'Estoque e lotes',
        icon: 'inventory_2',
        description: 'Estoque consolidado, alertas de saldo e rastreabilidade por lote.',
        items: [
          { label: 'Insumos', value: fi(metrics.supplies_total || supplies.length) },
          { label: 'Categorias', value: fi(categories) },
          { label: 'Alertas', value: fi(metrics.low_stock), tone: metrics.low_stock > 0 ? 'text-danger-600 dark:text-danger-300' : undefined },
          { label: 'Lotes', value: fi(n(lots?.summary?.total_lots)) },
        ],
        footer: `Proximos do vencimento: ${fi(n(lots?.summary?.near_expiry_lots))}. Vencidos: ${fi(n(lots?.summary?.expired_lots))}.`,
        actions: (
          <>
            <button onClick={() => setSection('exports')} className="btn-secondary"><span className="material-symbols-outlined">download</span>Exportar</button>
            <button onClick={() => navigate('/admin/inventory')} className="btn-secondary"><span className="material-symbols-outlined">open_in_new</span>Estoque</button>
          </>
        ),
      },
      {
        title: 'Cardapios e receitas',
        icon: 'restaurant_menu',
        description: 'Planejamento semanal, itens publicados e base tecnica de receitas.',
        items: [
          { label: 'Cardapios', value: fi(menus.length) },
          { label: 'Publicados', value: fi(metrics.menus_published || menus.filter((menu) => menu?.status === 'PUBLISHED').length), tone: 'text-primary-600 dark:text-primary-300' },
          { label: 'Receitas', value: fi(recipes.length) },
          { label: 'Itens c/ receita', value: fi(recipeLinked) },
        ],
        footer: `Itens de cardapio cadastrados: ${fi(menuItems)}. Refeicoes agregadas no sistema: ${fi(totalServed)}.`,
        actions: (
          <>
            <button onClick={() => setSection('exports')} className="btn-secondary"><span className="material-symbols-outlined">download</span>Exports</button>
            <button onClick={() => navigate('/admin/editor')} className="btn-secondary"><span className="material-symbols-outlined">edit_calendar</span>Editor</button>
            <button onClick={() => navigate('/admin/recipes')} className="btn-secondary"><span className="material-symbols-outlined">menu_book</span>Receitas</button>
          </>
        ),
      },
      {
        title: 'Entregas e consumo',
        icon: 'local_shipping',
        description: 'Operacao de distribuicao, divergencias e saidas de estoque.',
        items: [
          { label: 'Entregas', value: fi(allDeliveries.length) },
          { label: 'Divergencias', value: fi(deliveryDivergences), tone: deliveryDivergences > 0 ? 'text-danger-600 dark:text-danger-300' : undefined },
          { label: 'Consumos', value: fi(allMovements.length) },
          { label: 'Qtd consumida', value: fd(movementQty) },
        ],
        footer: `Refeicoes servidas no mes: ${fi(n(metrics.month_summary?.meals_served))}. Entregas realizadas no mes: ${fi(n(metrics.month_summary?.deliveries_realized))}.`,
        actions: (
          <>
            <button onClick={() => setSection('deliveries')} className="btn-secondary"><span className="material-symbols-outlined">fact_check</span>Entregas</button>
            <button onClick={() => setSection('consumption')} className="btn-secondary"><span className="material-symbols-outlined">monitoring</span>Consumo</button>
            <button onClick={() => navigate('/admin/consumption-registry')} className="btn-secondary"><span className="material-symbols-outlined">restaurant</span>Registro diario</button>
          </>
        ),
      },
      {
        title: 'Fornecedores e recebimentos',
        icon: 'receipt_long',
        description: 'Cadastro de fornecedores e entradas conferidas ou pendentes.',
        items: [
          { label: 'Fornecedores', value: fi(suppliers.length) },
          { label: 'Recebimentos', value: fi(allReceipts.length) },
          { label: 'Conferidos', value: fi(allReceipts.filter((row) => row?.status === 'CONFERRED').length), tone: 'text-emerald-600 dark:text-emerald-300' },
          { label: 'Direto escola', value: fi(receiptDirect) },
        ],
        footer: 'Use a aba Recebimentos para filtrar por fornecedor, escola, status e periodo antes de gerar o PDF.',
        actions: (
          <>
            <button onClick={() => setSection('receipts')} className="btn-secondary"><span className="material-symbols-outlined">description</span>Relatorio</button>
            <button onClick={() => navigate('/admin/supplier-receipts')} className="btn-secondary"><span className="material-symbols-outlined">open_in_new</span>Modulo</button>
          </>
        ),
      },
      {
        title: 'PNAE e governanca',
        icon: 'assignment',
        description: 'Planos anuais, metas em atraso e panorama rapido de governanca.',
        items: [
          { label: 'Planos', value: fi(pnaePlans.length) },
          { label: 'Aprovados', value: fi(pnaeApproved), tone: 'text-emerald-600 dark:text-emerald-300' },
          { label: 'Metas vencidas', value: fi(n(pnaeDashboard?.overdue_goals)), tone: n(pnaeDashboard?.overdue_goals) > 0 ? 'text-danger-600 dark:text-danger-300' : undefined },
          { label: 'Escolas cobertas', value: fi(n(pnaeDashboard?.schools_covered)) },
        ],
        footer: `Acoes atrasadas: ${fi(n(pnaeDashboard?.delayed_actions))}. Execucoes em aberto: ${fi(n(pnaeDashboard?.monthly_execution_open))}.`,
        actions: <button onClick={() => navigate('/admin/pnae')} className="btn-secondary"><span className="material-symbols-outlined">open_in_new</span>PNAE</button>,
      },
    ];
  }, [allDeliveries, allMovements, allReceipts, audit.count, lots, menus, metrics, navigate, pnaeDashboard, pnaePlans, recipes, schools, series, suppliers.length, supplies]);

  const deliveryTotals = useMemo(() => ({
    total: deliveryRows.length,
    sent: deliveryRows.filter((row) => row?.status === 'SENT').length,
    conferred: deliveryRows.filter((row) => row?.status === 'CONFERRED' || row?.status === 'FINALIZED').length,
    divergent: deliveryRows.filter((delivery) => (delivery?.items || []).some((item: any) =>
      n(item?.received_quantity ?? item?.planned_quantity) < n(item?.planned_quantity)
      || String(item?.divergence_note || '').trim(),
    )).length,
  }), [deliveryRows]);

  const movementTotals = useMemo(() => ({
    total: movementRows.length,
    qty: movementRows.reduce((sum, row) => sum + n(row?.quantity), 0),
    schools: new Set(movementRows.map((row) => String(row?.school || '')).filter(Boolean)).size,
  }), [movementRows]);

  const receiptTotals = useMemo(() => ({
    total: receiptRows.length,
    expected: receiptRows.filter((row) => row?.status === 'EXPECTED').length,
    inConference: receiptRows.filter((row) => row?.status === 'IN_CONFERENCE').length,
    conferred: receiptRows.filter((row) => row?.status === 'CONFERRED').length,
  }), [receiptRows]);

  const searchDeliveries = async () => {
    setError('');
    try {
      const rows = await getDeliveries({
        school: deliverySchool || undefined,
        status: deliveryStatus || undefined,
        date_from: deliveryFrom || undefined,
        date_to: deliveryTo || undefined,
      } as any);
      setDeliveryRows(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      setError(errMsg(requestError, 'Nao foi possivel carregar as entregas filtradas.'));
    }
  };

  const searchMovements = async () => {
    setError('');
    try {
      const rows = await getStockMovements({
        type: 'OUT',
        supply: movementSupply || undefined,
        school: movementSchool || undefined,
        date_from: movementFrom || undefined,
        date_to: movementTo || undefined,
      });
      setMovementRows(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      setError(errMsg(requestError, 'Nao foi possivel carregar o consumo filtrado.'));
    }
  };

  const searchReceipts = async () => {
    setError('');
    try {
      const rows = await getSupplierReceipts({
        supplier: receiptSupplier || undefined,
        school: receiptSchool || undefined,
        status: receiptStatus || undefined,
        date_from: receiptFrom || undefined,
        date_to: receiptTo || undefined,
      });
      setReceiptRows(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      setError(errMsg(requestError, 'Nao foi possivel carregar os recebimentos filtrados.'));
    }
  };

  return (
    <div className="flex flex-col flex-1 pb-24 lg:pb-8">
      <div className="p-4 lg:p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Relatorios</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-3xl">
          Esta area cobre os dados exportaveis e os conjuntos analiticos que antes ficavam espalhados entre varios modulos.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          <div className="card p-4 text-center"><p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? '...' : fi(metrics.schools_total)}</p><p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Escolas</p></div>
          <div className="card p-4 text-center"><p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? '...' : fi(metrics.supplies_total)}</p><p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Insumos</p></div>
          <div className="card p-4 text-center"><p className={`text-2xl font-bold ${metrics.low_stock > 0 ? 'text-danger-600 dark:text-danger-300' : 'text-slate-900 dark:text-white'}`}>{loading ? '...' : fi(metrics.low_stock)}</p><p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Alertas</p></div>
          <div className="card p-4 text-center"><p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? '...' : fi(metrics.menus_published)}</p><p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Cardapios publicados</p></div>
        </div>
      </div>

      {warning ? <div className="mx-4 lg:mx-6 mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">{warning}</div> : null}
      {error ? <div className="mx-4 lg:mx-6 mt-4 p-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-300 text-sm">{error}</div> : null}

      <div className="px-4 lg:px-6 py-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            ['overview', 'Cobertura', 'dashboard'],
            ['exports', 'Exportacoes', 'download'],
            ['deliveries', 'Entregas', 'local_shipping'],
            ['consumption', 'Consumo', 'inventory_2'],
            ['receipts', 'Recebimentos', 'receipt_long'],
          ].map(([id, label, icon]) => (
            <button key={id} onClick={() => setSection(id as Section)} className={`chip shrink-0 ${section === id ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : ''}`}>
              <span className="material-symbols-outlined text-sm">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 lg:px-6 pb-4">
        {section === 'overview' ? <div className="grid gap-4 xl:grid-cols-2">{overviewCards.map((card) => <Panel key={card.title} {...card} />)}</div> : null}

        {section === 'exports' ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Estoque consolidado"
              icon="inventory_2"
              description="Exportacoes prontas do estoque central."
              items={[
                { label: 'CSV/PDF/XLSX', value: '3 formatos' },
                { label: 'Lotes', value: fi(n(lots?.summary?.total_lots)) },
                { label: 'Alertas', value: fi(metrics.low_stock) },
                { label: 'Categorias', value: fi(new Set(supplies.map((supply) => String(supply?.category || '').trim()).filter(Boolean)).size) },
              ]}
              actions={
                <>
                  <button onClick={() => exportStockCsv()} className="btn-secondary"><span className="material-symbols-outlined">table_chart</span>CSV</button>
                  <button onClick={() => exportStockPdf()} className="btn-secondary"><span className="material-symbols-outlined">picture_as_pdf</span>PDF</button>
                  <button onClick={() => exportStockXlsx()} className="btn-secondary"><span className="material-symbols-outlined">grid_on</span>XLSX</button>
                </>
              }
            />
            <Panel
              title="Cardapios"
              icon="restaurant_menu"
              description="Exportacao consolidada e PDF semanal por escola."
              items={[
                { label: 'CSV', value: 'Consolidado' },
                { label: 'Cardapios', value: fi(menus.length) },
                { label: 'Publicados', value: fi(metrics.menus_published) },
                { label: 'Receitas', value: fi(recipes.length) },
              ]}
              footer={
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select value={menuSchool} onChange={(e) => setMenuSchool(e.target.value)} className="input">
                    <option value="">Selecione a escola</option>
                    {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                  </select>
                  <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="input" />
                  <button onClick={() => { if (!menuSchool || !weekStart) { setError('Selecione escola e semana para gerar o PDF do cardapio.'); return; } setError(''); exportMenuPdf(menuSchool, weekStart); }} className="btn-primary"><span className="material-symbols-outlined">picture_as_pdf</span>PDF semanal</button>
                </div>
              }
              actions={<button onClick={() => exportMenusCsv()} className="btn-secondary"><span className="material-symbols-outlined">download</span>CSV consolidado</button>}
            />
            <Panel
              title="Entregas e divergencias"
              icon="local_shipping"
              description="Arquivos dedicados para entregas completas e ocorrencias."
              items={[
                { label: 'Entregas', value: fi(allDeliveries.length) },
                { label: 'Divergencias', value: fi(deliveryTotals.divergent) },
                { label: 'Mes', value: fi(n(metrics.month_summary?.deliveries_realized)) },
                { label: 'Conferidas', value: fi(deliveryTotals.conferred) },
              ]}
              actions={
                <>
                  <button onClick={() => exportDeliveriesPdf()} className="btn-secondary"><span className="material-symbols-outlined">picture_as_pdf</span>Entregas PDF</button>
                  <button onClick={() => exportDeliveriesXlsx()} className="btn-secondary"><span className="material-symbols-outlined">table_view</span>Entregas XLSX</button>
                  <button onClick={() => exportDeliveryDivergencesPdf()} className="btn-secondary"><span className="material-symbols-outlined">error</span>Divergencias PDF</button>
                  <button onClick={() => exportDeliveryDivergencesXlsx()} className="btn-secondary"><span className="material-symbols-outlined">fact_check</span>Divergencias XLSX</button>
                </>
              }
            />
            <Panel
              title="Consumo"
              icon="monitoring"
              description="Saidas de estoque com resumo por insumo no XLSX."
              items={[
                { label: 'Lancamentos', value: fi(allMovements.length) },
                { label: 'Qtd total', value: fd(allMovements.reduce((sum, row) => sum + n(row?.quantity), 0)) },
                { label: 'Escolas', value: fi(new Set(allMovements.map((row) => String(row?.school || '')).filter(Boolean)).size) },
                { label: 'Refeicoes mes', value: fi(n(metrics.month_summary?.meals_served)) },
              ]}
              actions={
                <>
                  <button onClick={() => exportConsumptionPdf()} className="btn-secondary"><span className="material-symbols-outlined">picture_as_pdf</span>PDF</button>
                  <button onClick={() => exportConsumptionXlsx()} className="btn-secondary"><span className="material-symbols-outlined">table_view</span>XLSX</button>
                </>
              }
            />
            <Panel
              title="Recebimentos de fornecedores"
              icon="receipt_long"
              description="PDF consolidado das entradas e conferencias."
              items={[
                { label: 'Recebimentos', value: fi(allReceipts.length) },
                { label: 'Conferidos', value: fi(allReceipts.filter((row) => row?.status === 'CONFERRED').length) },
                { label: 'Direto escola', value: fi(allReceipts.filter((row) => row?.school).length) },
                { label: 'Fornecedores', value: fi(suppliers.length) },
              ]}
              actions={
                <>
                  <button onClick={() => exportSupplierReceiptsPdf()} className="btn-secondary"><span className="material-symbols-outlined">picture_as_pdf</span>PDF</button>
                  <button onClick={() => exportSupplierReceiptsXlsx()} className="btn-secondary"><span className="material-symbols-outlined">table_view</span>XLSX</button>
                </>
              }
            />
          </div>
        ) : null}

        {section === 'deliveries' ? (
          <div className="card p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <select value={deliverySchool} onChange={(e) => setDeliverySchool(e.target.value)} className="input"><option value="">Todas as escolas</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select>
              <select value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)} className="input"><option value="">Todos os status</option><option value="DRAFT">Rascunho</option><option value="SENT">Enviada</option><option value="IN_CONFERENCE">Em conferencia</option><option value="CONFERRED">Conferida</option><option value="FINALIZED">Finalizada</option></select>
              <input type="date" value={deliveryFrom} onChange={(e) => setDeliveryFrom(e.target.value)} className="input" />
              <input type="date" value={deliveryTo} onChange={(e) => setDeliveryTo(e.target.value)} className="input" />
              <button onClick={searchDeliveries} className="btn-primary w-full"><span className="material-symbols-outlined">search</span>Buscar</button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[['Total', fi(deliveryTotals.total)], ['Enviadas', fi(deliveryTotals.sent)], ['Conferidas', fi(deliveryTotals.conferred)], ['Divergencias', fi(deliveryTotals.divergent)]].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4"><p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p><p className="text-xs text-slate-500 uppercase tracking-wide mt-1">{label}</p></div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => exportDeliveriesPdf({ school: deliverySchool || undefined, status: deliveryStatus || undefined, date_from: deliveryFrom || undefined, date_to: deliveryTo || undefined })} className="btn-secondary"><span className="material-symbols-outlined">picture_as_pdf</span>PDF</button>
              <button onClick={() => exportDeliveriesXlsx({ school: deliverySchool || undefined, status: deliveryStatus || undefined, date_from: deliveryFrom || undefined, date_to: deliveryTo || undefined })} className="btn-secondary"><span className="material-symbols-outlined">table_view</span>XLSX</button>
              <button onClick={() => exportDeliveryDivergencesPdf({ school: deliverySchool || undefined, status: deliveryStatus || undefined, date_from: deliveryFrom || undefined, date_to: deliveryTo || undefined })} className="btn-secondary"><span className="material-symbols-outlined">error</span>Divergencias PDF</button>
              <button onClick={() => exportDeliveryDivergencesXlsx({ school: deliverySchool || undefined, status: deliveryStatus || undefined, date_from: deliveryFrom || undefined, date_to: deliveryTo || undefined })} className="btn-secondary"><span className="material-symbols-outlined">fact_check</span>Divergencias XLSX</button>
            </div>
            <div className="space-y-3 max-h-[30rem] overflow-y-auto">
              {deliveryRows.length ? deliveryRows.map((delivery) => (
                <div key={delivery.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{delivery.school_name}</p>
                      <p className="text-sm text-slate-500">{fdate(delivery.delivery_date)} • {(delivery?.items || []).length} item(ns)</p>
                      <p className="text-xs text-slate-400">Atualizado em {fdatetime(delivery.updated_at)}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${deliveryTone(delivery.status)}`}>{deliveryLabel(delivery.status)}</span>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-400 text-center py-8">Nenhuma entrega encontrada.</p>}
            </div>
          </div>
        ) : null}

        {section === 'consumption' ? (
          <div className="card p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <select value={movementSupply} onChange={(e) => setMovementSupply(e.target.value)} className="input"><option value="">Todos os insumos</option>{supplies.map((supply) => <option key={supply.id} value={supply.id}>{supply.name}</option>)}</select>
              <select value={movementSchool} onChange={(e) => setMovementSchool(e.target.value)} className="input"><option value="">Todas as escolas</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select>
              <input type="date" value={movementFrom} onChange={(e) => setMovementFrom(e.target.value)} className="input" />
              <input type="date" value={movementTo} onChange={(e) => setMovementTo(e.target.value)} className="input" />
              <button onClick={searchMovements} className="btn-primary w-full"><span className="material-symbols-outlined">search</span>Buscar</button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="rounded-xl bg-gradient-to-r from-primary-500 to-secondary-500 text-white p-4"><p className="text-sm text-white/80">Quantidade consumida</p><p className="text-3xl font-bold mt-1">{fd(movementTotals.qty)}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4"><p className="text-2xl font-bold text-slate-900 dark:text-white">{fi(movementTotals.total)}</p><p className="text-xs text-slate-500 uppercase tracking-wide mt-1">Lancamentos</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4"><p className="text-2xl font-bold text-slate-900 dark:text-white">{fi(movementTotals.schools)}</p><p className="text-xs text-slate-500 uppercase tracking-wide mt-1">Escolas</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => exportConsumptionPdf({ supply: movementSupply || undefined, school: movementSchool || undefined, date_from: movementFrom || undefined, date_to: movementTo || undefined })} className="btn-secondary"><span className="material-symbols-outlined">picture_as_pdf</span>PDF</button>
              <button onClick={() => exportConsumptionXlsx({ supply: movementSupply || undefined, school: movementSchool || undefined, date_from: movementFrom || undefined, date_to: movementTo || undefined })} className="btn-secondary"><span className="material-symbols-outlined">table_view</span>XLSX</button>
            </div>
            <div className="space-y-3 max-h-[30rem] overflow-y-auto">
              {movementRows.length ? movementRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{supplyById[row.supply]?.name || 'Insumo'}</p>
                      <p className="text-sm text-slate-500">{schoolById[row.school]?.name || 'Sem escola'} • {fdate(row.movement_date)}</p>
                      {row.note ? <p className="text-xs text-slate-400">{row.note}</p> : null}
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{fd(n(row.quantity))} {supplyById[row.supply]?.unit || ''}</p>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-400 text-center py-8">Nenhum consumo encontrado.</p>}
            </div>
          </div>
        ) : null}

        {section === 'receipts' ? (
          <div className="card p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
              <select value={receiptSupplier} onChange={(e) => setReceiptSupplier(e.target.value)} className="input"><option value="">Todos os fornecedores</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
              <select value={receiptSchool} onChange={(e) => setReceiptSchool(e.target.value)} className="input"><option value="">Todos os destinos</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select>
              <select value={receiptStatus} onChange={(e) => setReceiptStatus(e.target.value)} className="input"><option value="">Todos os status</option><option value="DRAFT">Rascunho</option><option value="EXPECTED">Aguardando entrega</option><option value="IN_CONFERENCE">Em conferencia</option><option value="CONFERRED">Conferido</option><option value="CANCELLED">Cancelado</option></select>
              <input type="date" value={receiptFrom} onChange={(e) => setReceiptFrom(e.target.value)} className="input" />
              <input type="date" value={receiptTo} onChange={(e) => setReceiptTo(e.target.value)} className="input" />
              <button onClick={searchReceipts} className="btn-primary w-full"><span className="material-symbols-outlined">search</span>Buscar</button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[['Total', fi(receiptTotals.total)], ['Aguardando', fi(receiptTotals.expected)], ['Em conferencia', fi(receiptTotals.inConference)], ['Conferidos', fi(receiptTotals.conferred)]].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4"><p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p><p className="text-xs text-slate-500 uppercase tracking-wide mt-1">{label}</p></div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => exportSupplierReceiptsPdf({ supplier: receiptSupplier || undefined, school: receiptSchool || undefined, status: receiptStatus || undefined, date_from: receiptFrom || undefined, date_to: receiptTo || undefined })} className="btn-secondary"><span className="material-symbols-outlined">picture_as_pdf</span>PDF</button>
              <button onClick={() => exportSupplierReceiptsXlsx({ supplier: receiptSupplier || undefined, school: receiptSchool || undefined, status: receiptStatus || undefined, date_from: receiptFrom || undefined, date_to: receiptTo || undefined })} className="btn-secondary"><span className="material-symbols-outlined">table_view</span>XLSX</button>
            </div>
            <div className="space-y-3 max-h-[30rem] overflow-y-auto">
              {receiptRows.length ? receiptRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{row.supplier_name}</p>
                      <p className="text-sm text-slate-500">{row.school_name || 'Estoque central'} • {fdate(row.expected_date)} • {(row?.items || []).length} item(ns)</p>
                      <p className="text-xs text-slate-400">Atualizado em {fdatetime(row.updated_at)}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${receiptTone(row.status)}`}>{receiptLabel(row.status)}</span>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-400 text-center py-8">Nenhum recebimento encontrado.</p>}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Reports;
