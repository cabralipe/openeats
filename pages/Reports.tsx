import React, { useEffect, useMemo, useState } from 'react';
import { exportConsumptionPdf, exportConsumptionXlsx, exportDeliveriesPdf, exportDeliveriesXlsx, exportMenuPdf, exportMenusCsv, exportStockCsv, exportStockPdf, exportStockXlsx, exportSupplierReceiptsPdf, getDashboard, getDeliveries, getSchools, getStockMovements, getSupplies } from '../api';


const Reports: React.FC = () => {
  const [metrics, setMetrics] = useState({
    schools_total: 0,
    schools_active: 0,
    supplies_total: 0,
    low_stock: 0,
    menus_published: 0,
  });
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [supplies, setSupplies] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [deliverySchool, setDeliverySchool] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [deliveryFrom, setDeliveryFrom] = useState('');
  const [deliveryTo, setDeliveryTo] = useState('');
  const [movements, setMovements] = useState<any[]>([]);
  const [movementSupply, setMovementSupply] = useState('');
  const [movementFrom, setMovementFrom] = useState('');
  const [movementTo, setMovementTo] = useState('');
  const [movementSchool, setMovementSchool] = useState('');
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<'quick' | 'menu' | 'delivery' | 'consumption'>('quick');

  useEffect(() => {
    setError('');
    getDashboard().then((data) => setMetrics(data)).catch(() => setError('Erro ao carregar indicadores.'));
    getSchools().then((data) => {
      setSchools(data);
      if (data.length) {
        setSelectedSchool(data[0].id);
        setDeliverySchool(data[0].id);
      }
    }).catch(() => setError('Erro ao carregar escolas.'));
    getSupplies().then((data) => {
      setSupplies(data);
      if (data.length) setMovementSupply(data[0].id);
    }).catch(() => setError('Erro ao carregar insumos.'));
  }, []);

  const handleExportMenuPdf = () => {
    if (!selectedSchool || !weekStart) {
      setError('Selecione escola e semana.');
      return;
    }
    setError('');
    exportMenuPdf(selectedSchool, weekStart);
  };

  const handleSearchDeliveries = async () => {
    setError('');
    try {
      const data = await getDeliveries({
        school: deliverySchool || undefined,
        status: deliveryStatus || undefined,
      });
      setDeliveries(data);
    } catch {
      setError('Erro ao carregar entregas.');
    }
  };

  const handleSearchConsumption = async () => {
    setError('');
    try {
      const data = await getStockMovements({
        type: 'OUT',
        supply: movementSupply || undefined,
        school: movementSchool || undefined,
        date_from: movementFrom || undefined,
        date_to: movementTo || undefined,
      });
      setMovements(data);
    } catch {
      setError('Erro ao carregar consumo.');
    }
  };

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      if (deliveryFrom && delivery.delivery_date < deliveryFrom) return false;
      if (deliveryTo && delivery.delivery_date > deliveryTo) return false;
      return true;
    });
  }, [deliveries, deliveryFrom, deliveryTo]);

  const deliveryTotals = useMemo(() => {
    const total = filteredDeliveries.length;
    const sent = filteredDeliveries.filter((d) => d.status !== 'DRAFT').length;
    const conferences = filteredDeliveries.filter((d) => d.conference_submitted_at).length;
    return { total, sent, conferences };
  }, [filteredDeliveries]);

  const consumptionTotals = useMemo(() => {
    const total = movements.reduce((acc, m) => acc + Number(m.quantity || 0), 0);
    return { total };
  }, [movements]);

  const supplyById = useMemo(() => {
    return supplies.reduce<Record<string, any>>((acc, s) => {
      acc[s.id] = s;
      return acc;
    }, {});
  }, [supplies]);

  const sections = [
    { id: 'quick', label: 'Exportações', icon: 'download' },
    { id: 'menu', label: 'Cardápio', icon: 'restaurant_menu' },
    { id: 'delivery', label: 'Entregas', icon: 'local_shipping' },
    { id: 'consumption', label: 'Consumo', icon: 'inventory_2' },
  ];

  return (
    <div className="flex flex-col flex-1 pb-24 lg:pb-8">
      {/* Header Stats */}
      <div className="p-4 lg:p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white mb-4">Relatórios</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-2">
              <span className="material-symbols-outlined text-primary-500">school</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.schools_total}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Escolas</p>
          </div>
          <div className="card p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center mx-auto mb-2">
              <span className="material-symbols-outlined text-secondary-500">inventory_2</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.supplies_total}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Insumos</p>
          </div>
          <div className={`card p-4 text-center ${metrics.low_stock > 0 ? 'border-danger-200 dark:border-danger-900/50' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center mx-auto mb-2">
              <span className="material-symbols-outlined text-danger-500">warning</span>
            </div>
            <p className={`text-2xl font-bold ${metrics.low_stock > 0 ? 'text-danger-600' : 'text-slate-900 dark:text-white'}`}>{metrics.low_stock}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Alertas</p>
          </div>
          <div className="card p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center mx-auto mb-2">
              <span className="material-symbols-outlined text-accent-500">restaurant_menu</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.menus_published}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Cardápios</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 lg:mx-6 mt-4 p-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 text-danger-600 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* Section Tabs */}
      <div className="px-4 lg:px-6 py-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`chip shrink-0 ${activeSection === section.id ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : ''
                }`}
            >
              <span className="material-symbols-outlined text-sm">{section.icon}</span>
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 lg:px-6 pb-4">
        {activeSection === 'quick' && (
          <div className="space-y-4">
            {/* Stock Report Card */}
            <div className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary-500">inventory_2</span>
                    Relatório de Estoque Detalhado
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Todos os insumos organizados por nível (baixo, normal, alto) e categoria
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => exportStockCsv()} className="btn-secondary flex-col gap-1 py-3">
                  <span className="material-symbols-outlined">table_chart</span>
                  <span className="text-xs">CSV</span>
                </button>
                <button onClick={() => exportStockPdf()} className="btn flex-col gap-1 py-3 bg-danger-500 text-white hover:bg-danger-600">
                  <span className="material-symbols-outlined">picture_as_pdf</span>
                  <span className="text-xs">PDF</span>
                </button>
                <button onClick={() => exportStockXlsx()} className="btn flex-col gap-1 py-3 bg-success-500 text-white hover:bg-success-600">
                  <span className="material-symbols-outlined">grid_on</span>
                  <span className="text-xs">Excel</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">info</span>
                O Excel inclui abas separadas: Resumo, Todos os Itens, Estoque Baixo, Normal e Alto
              </p>
            </div>

            {/* Menus Report Card */}
            <div className="card p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary-500">restaurant_menu</span>
                  Relatório de Cardápios
                </h3>
                <p className="text-sm text-slate-500">Exportação consolidada por escola</p>
              </div>
              <button onClick={() => exportMenusCsv()} className="btn-primary">
                <span className="material-symbols-outlined">download</span>
                CSV
              </button>
            </div>

            {/* Supplier Receipts PDF */}
            <div className="card p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-accent-500">receipt_long</span>
                  Recebimentos de Fornecedores
                </h3>
                <p className="text-sm text-slate-500">Exportação em PDF dos recebimentos e itens conferidos</p>
              </div>
              <button onClick={() => exportSupplierReceiptsPdf()} className="btn bg-danger-500 text-white hover:bg-danger-600">
                <span className="material-symbols-outlined">picture_as_pdf</span>
                PDF
              </button>
            </div>
          </div>
        )}


        {activeSection === 'menu' && (
          <div className="card p-6 max-w-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Cardápio Semanal (PDF)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Escola</label>
                <select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)} className="input">
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Início da semana</label>
                <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="input" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">Use a segunda-feira como início para o PDF semanal.</p>
            <button onClick={handleExportMenuPdf} disabled={!selectedSchool || !weekStart} className="btn-primary">
              <span className="material-symbols-outlined">picture_as_pdf</span>
              Exportar PDF
            </button>
          </div>
        )}

        {activeSection === 'delivery' && (
          <div className="card p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Relatório de Entregas</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Escola</label>
                <select value={deliverySchool} onChange={(e) => setDeliverySchool(e.target.value)} className="input">
                  <option value="">Todas</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                <select value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)} className="input">
                  <option value="">Todos</option>
                  <option value="DRAFT">Rascunho</option>
                  <option value="SENT">Enviada</option>
                  <option value="CONFERRED">Conferida</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={handleSearchDeliveries} className="btn-primary w-full">Buscar</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data inicial</label>
                <input type="date" value={deliveryFrom} onChange={(e) => setDeliveryFrom(e.target.value)} className="input" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data final</label>
                <input type="date" value={deliveryTo} onChange={(e) => setDeliveryTo(e.target.value)} className="input" />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{deliveryTotals.total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                <p className="text-2xl font-bold text-primary-500">{deliveryTotals.sent}</p>
                <p className="text-xs text-slate-500">Enviadas</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                <p className="text-2xl font-bold text-success-500">{deliveryTotals.conferences}</p>
                <p className="text-xs text-slate-500">Conferidas</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => exportDeliveriesPdf({ school: deliverySchool || undefined, status: deliveryStatus || undefined, date_from: deliveryFrom || undefined, date_to: deliveryTo || undefined })}
                className="btn-secondary"
              >
                <span className="material-symbols-outlined">picture_as_pdf</span>
                PDF
              </button>
              <button
                onClick={() => exportDeliveriesXlsx({ school: deliverySchool || undefined, status: deliveryStatus || undefined, date_from: deliveryFrom || undefined, date_to: deliveryTo || undefined })}
                className="btn-secondary"
              >
                <span className="material-symbols-outlined">table_view</span>
                XLSX
              </button>
            </div>

            {/* Results */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredDeliveries.map((d) => (
                <div key={d.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{d.school_name}</p>
                    <p className="text-xs text-slate-500">{d.delivery_date} • {d.items?.length || 0} itens</p>
                  </div>
                  <span className={`badge ${d.status === 'CONFERRED' ? 'badge-success' : d.status === 'SENT' ? 'badge-primary' : 'badge-warning'}`}>
                    {d.status}
                  </span>
                </div>
              ))}
              {filteredDeliveries.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Nenhuma entrega encontrada</p>
              )}
            </div>
          </div>
        )}

        {activeSection === 'consumption' && (
          <div className="card p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Relatório de Consumo</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Insumo</label>
                <select value={movementSupply} onChange={(e) => setMovementSupply(e.target.value)} className="input">
                  <option value="">Todos</option>
                  {supplies.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Escola</label>
                <select value={movementSchool} onChange={(e) => setMovementSchool(e.target.value)} className="input">
                  <option value="">Todas</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data inicial</label>
                <input type="date" value={movementFrom} onChange={(e) => setMovementFrom(e.target.value)} className="input" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data final</label>
                <input type="date" value={movementTo} onChange={(e) => setMovementTo(e.target.value)} className="input" />
              </div>
            </div>

            <button onClick={handleSearchConsumption} className="btn-primary mb-4">Buscar</button>

            {/* Stats */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary-500 to-secondary-500 text-white mb-4">
              <p className="text-sm opacity-80">Quantidade consumida</p>
              <p className="text-3xl font-bold">{consumptionTotals.total.toFixed(2)}</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => exportConsumptionPdf({ supply: movementSupply || undefined, school: movementSchool || undefined, date_from: movementFrom || undefined, date_to: movementTo || undefined })}
                className="btn-secondary"
              >
                <span className="material-symbols-outlined">picture_as_pdf</span>
                PDF
              </button>
              <button
                onClick={() => exportConsumptionXlsx({ supply: movementSupply || undefined, school: movementSchool || undefined, date_from: movementFrom || undefined, date_to: movementTo || undefined })}
                className="btn-secondary"
              >
                <span className="material-symbols-outlined">table_view</span>
                XLSX
              </button>
            </div>

            {/* Results */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {movements.map((m) => (
                <div key={m.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{supplyById[m.supply]?.name || 'Insumo'}</p>
                    <p className="text-xs text-slate-500">{m.movement_date}</p>
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {Number(m.quantity || 0).toFixed(2)} {supplyById[m.supply]?.unit || ''}
                  </p>
                </div>
              ))}
              {movements.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Nenhum consumo encontrado</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
