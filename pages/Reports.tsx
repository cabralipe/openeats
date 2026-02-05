import React, { useEffect, useMemo, useState } from 'react';
import { exportConsumptionPdf, exportConsumptionXlsx, exportDeliveriesPdf, exportDeliveriesXlsx, exportMenuPdf, exportMenusCsv, exportStockCsv, getDashboard, getDeliveries, getSchools, getStockMovements, getSupplies } from '../api';

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

  useEffect(() => {
    setError('');
    getDashboard()
      .then((data) => setMetrics(data))
      .catch(() => setError('Nao foi possivel carregar os indicadores.'));

    getSchools()
      .then((data) => {
        setSchools(data);
        if (data.length) setSelectedSchool(data[0].id);
        if (data.length) setDeliverySchool(data[0].id);
      })
      .catch(() => setError('Nao foi possivel carregar as escolas.'));

    getSupplies()
      .then((data) => {
        setSupplies(data);
        if (data.length) setMovementSupply(data[0].id);
      })
      .catch(() => setError('Nao foi possivel carregar os insumos.'));
  }, []);

  const handleExportMenuPdf = () => {
    if (!selectedSchool || !weekStart) {
      setError('Selecione a escola e a semana para exportar o PDF.');
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
      setError('Nao foi possivel carregar as entregas.');
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
      setError('Nao foi possivel carregar o consumo.');
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
    const sent = filteredDeliveries.filter((delivery) => delivery.status !== 'DRAFT').length;
    const conferences = filteredDeliveries.filter((delivery) => delivery.conference_submitted_at).length;
    return { total, sent, conferences };
  }, [filteredDeliveries]);

  const consumptionTotals = useMemo(() => {
    const total = movements.reduce((acc, movement) => acc + Number(movement.quantity || 0), 0);
    return { total };
  }, [movements]);

  const supplyById = useMemo(() => {
    return supplies.reduce<Record<string, any>>((acc, supply) => {
      acc[supply.id] = supply;
      return acc;
    }, {});
  }, [supplies]);

  return (
    <div className="flex flex-col flex-1 pb-24">
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
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 w-fit">Alertas Criticos</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-lg">restaurant_menu</span>
            <p className="text-[#4e7397] dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Cardapios</p>
          </div>
          <p className="text-[#0d141b] dark:text-slate-100 tracking-tight text-2xl font-bold">{metrics.menus_published}</p>
          <p className="text-blue-500 text-[10px] font-bold uppercase">Publicados</p>
        </div>
      </div>

      {error && <div className="px-4 text-red-600 text-sm">{error}</div>}

      <h3 className="text-[#0d141b] dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-2">Exportacoes Rapidas</h3>
      <div className="px-4 py-2">
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Relatorio de estoque</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Lista completa de insumos e quantidades atuais.</p>
            </div>
            <button onClick={() => exportStockCsv()} className="h-10 rounded-lg bg-primary/10 text-primary text-sm font-semibold px-4">Exportar CSV</button>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Relatorio de cardapios</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Exportacao consolidada de cardapios por escola.</p>
            </div>
            <button onClick={() => exportMenusCsv()} className="h-10 rounded-lg bg-primary/10 text-primary text-sm font-semibold px-4">Exportar CSV</button>
          </div>
        </div>
      </div>

      <h3 className="text-[#0d141b] dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-6">Relatorio de Cardapio (PDF)</h3>
      <div className="px-4 py-2">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col">
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
            <label className="flex flex-col">
              <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Semana inicial</p>
              <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal" />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">Use a segunda-feira como inicio para o PDF semanal.</div>
            <button
              onClick={handleExportMenuPdf}
              disabled={!selectedSchool || !weekStart}
              className={`h-11 px-5 rounded-xl text-sm font-semibold ${(!selectedSchool || !weekStart) ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-primary text-white shadow-lg shadow-primary/20'}`}
            >
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <h3 className="text-[#0d141b] dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-6">Observacoes</h3>
      <div className="px-4 pb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-600 dark:text-slate-300">
          Os relatorios sao gerados com os dados mais recentes. Para cardapios em PDF, selecione a escola e o inicio da semana desejada.
        </div>
      </div>

      <h3 className="text-[#0d141b] dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-6">Relatorio de Entregas</h3>
      <div className="px-4 py-2">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex flex-col">
              <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Escola</p>
              <div className="relative">
                <select value={deliverySchool} onChange={(e) => setDeliverySchool(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal">
                  <option value="">Todas</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#4c739a]">
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </label>
            <label className="flex flex-col">
              <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Status</p>
              <div className="relative">
                <select value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal">
                  <option value="">Todos</option>
                  <option value="DRAFT">Rascunho</option>
                  <option value="SENT">Enviada</option>
                  <option value="CONFERRED">Conferida</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#4c739a]">
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </label>
            <div className="flex items-end">
              <button onClick={handleSearchDeliveries} className="h-12 w-full rounded-xl bg-primary text-white font-bold text-sm">Buscar</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <label className="flex flex-col">
              <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Data inicial</p>
              <input type="date" value={deliveryFrom} onChange={(e) => setDeliveryFrom(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal" />
            </label>
            <label className="flex flex-col">
              <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Data final</p>
              <input type="date" value={deliveryTo} onChange={(e) => setDeliveryTo(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal" />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 py-2">
              <p className="text-slate-900 dark:text-white text-base font-bold">{deliveryTotals.total}</p>
              <p>Total</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 py-2">
              <p className="text-slate-900 dark:text-white text-base font-bold">{deliveryTotals.sent}</p>
              <p>Enviadas</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 py-2">
              <p className="text-slate-900 dark:text-white text-base font-bold">{deliveryTotals.conferences}</p>
              <p>Conferidas</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => exportDeliveriesPdf({ school: deliverySchool || undefined, status: deliveryStatus || undefined, date_from: deliveryFrom || undefined, date_to: deliveryTo || undefined })}
              className="h-10 rounded-lg bg-primary/10 text-primary text-sm font-semibold px-4"
            >
              Exportar PDF
            </button>
            <button
              onClick={() => exportDeliveriesXlsx({ school: deliverySchool || undefined, status: deliveryStatus || undefined, date_from: deliveryFrom || undefined, date_to: deliveryTo || undefined })}
              className="h-10 rounded-lg bg-primary/10 text-primary text-sm font-semibold px-4"
            >
              Exportar XLSX
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {filteredDeliveries.map((delivery) => (
              <div key={delivery.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 dark:text-white">{delivery.school_name}</p>
                  <span className="text-xs font-bold text-slate-500">{delivery.status}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {delivery.delivery_date} • {delivery.items?.length || 0} itens
                </div>
              </div>
            ))}
            {filteredDeliveries.length === 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">Nenhuma entrega encontrada.</div>
            )}
          </div>
        </div>
      </div>

      <h3 className="text-[#0d141b] dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-6">Relatorio de Consumo</h3>
      <div className="px-4 py-2">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="flex flex-col">
              <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Insumo</p>
              <div className="relative">
                <select value={movementSupply} onChange={(e) => setMovementSupply(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal">
                  <option value="">Todos</option>
                  {supplies.map((supply) => (
                    <option key={supply.id} value={supply.id}>{supply.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#4c739a]">
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </label>
            <label className="flex flex-col">
              <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Escola</p>
              <div className="relative">
                <select value={movementSchool} onChange={(e) => setMovementSchool(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal">
                  <option value="">Todas</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#4c739a]">
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </label>
            <label className="flex flex-col">
              <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Data inicial</p>
              <input type="date" value={movementFrom} onChange={(e) => setMovementFrom(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal" />
            </label>
            <div className="flex items-end gap-3">
              <label className="flex flex-col flex-1">
                <p className="text-[#0d141b] dark:text-slate-200 text-sm font-medium leading-normal pb-1.5 px-1">Data final</p>
                <input type="date" value={movementTo} onChange={(e) => setMovementTo(e.target.value)} className="form-input flex w-full appearance-none rounded-xl text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-base font-normal leading-normal" />
              </label>
              <button onClick={handleSearchConsumption} className="h-12 rounded-xl bg-primary text-white font-bold text-sm px-5">Buscar</button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 py-2">
              <p className="text-slate-900 dark:text-white text-base font-bold">{consumptionTotals.total.toFixed(2)}</p>
              <p>Quantidade consumida</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => exportConsumptionPdf({ supply: movementSupply || undefined, school: movementSchool || undefined, date_from: movementFrom || undefined, date_to: movementTo || undefined })}
              className="h-10 rounded-lg bg-primary/10 text-primary text-sm font-semibold px-4"
            >
              Exportar PDF
            </button>
            <button
              onClick={() => exportConsumptionXlsx({ supply: movementSupply || undefined, school: movementSchool || undefined, date_from: movementFrom || undefined, date_to: movementTo || undefined })}
              className="h-10 rounded-lg bg-primary/10 text-primary text-sm font-semibold px-4"
            >
              Exportar XLSX
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {movements.map((movement) => (
              <div key={movement.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 dark:text-white">{supplyById[movement.supply]?.name || 'Insumo'}</p>
                  <span className="text-xs font-bold text-slate-500">{movement.movement_date}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Saida • {Number(movement.quantity || 0).toFixed(2)} {supplyById[movement.supply]?.unit || ''}
                </div>
              </div>
            ))}
            {movements.length === 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">Nenhum consumo encontrado.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
