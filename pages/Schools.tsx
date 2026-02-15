import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { createSchool, deleteSchool, getPublicLink, getSchools, getSchoolStock, updateSchool, getMenus, copyMenu, getSchoolStockConfig, updateSchoolStockLimit } from '../api';
import { School } from '../types';

interface StockConfigItem {
  id: string;
  supply: { id: string; name: string; category: string; unit: string; min_stock: number };
  quantity: number;
  min_stock: number;
  status: string;
}

interface MenuData {
  id: string;
  name?: string;
  week_start: string;
  week_end: string;
  status: string;
  items_count?: number;
  school_name?: string;
}

const Schools: React.FC = () => {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    is_active: true,
  });
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [addressFilter, setAddressFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [stockModal, setStockModal] = useState<{ school: School; data: any } | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  // Menu modal state
  const [menuModal, setMenuModal] = useState<{ school: School; menus: MenuData[] } | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyingMenuId, setCopyingMenuId] = useState<string | null>(null);
  const [copyTargetSchool, setCopyTargetSchool] = useState('');
  const [copyWeekStart, setCopyWeekStart] = useState('');
  const [copyWeekEnd, setCopyWeekEnd] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  // Stock config modal state
  const [configModal, setConfigModal] = useState<{ school: School; items: StockConfigItem[] } | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [editingLimits, setEditingLimits] = useState<Record<string, string>>({});
  const [plaqueModal, setPlaqueModal] = useState<{ schoolName: string; link: string; title: string } | null>(null);
  const [plaqueQr, setPlaqueQr] = useState('');

  const locationLabel = useMemo(() => {
    return (school: School) => school.location || 'Sem endereço';
  }, []);

  const loadSchools = (filters?: { q?: string; is_active?: boolean; city?: string; address?: string }) => {
    return getSchools(filters)
      .then((data) => {
        const mapped = (data as any[]).map((school: any) => ({
          id: school.id,
          name: school.name,
          location: [school.address, school.city].filter(Boolean).join(' • ') || 'Sem endereço',
          status: school.is_active ? 'active' : 'pending',
          publicSlug: school.public_slug,
          publicToken: school.public_token,
        }));
        setSchools(mapped);
      })
      .catch(() => setError('Não foi possível carregar as escolas.'));
  };

  useEffect(() => {
    setIsLoading(true);
    loadSchools().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active';
      loadSchools({ q: search, is_active: isActive, city: cityFilter, address: addressFilter });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, statusFilter, cityFilter, addressFilter]);

  useEffect(() => {
    let active = true;
    if (!plaqueModal) {
      setPlaqueQr('');
      return;
    }
    QRCode.toDataURL(plaqueModal.link, { width: 320, margin: 1 })
      .then((url) => {
        if (active) setPlaqueQr(url);
      })
      .catch(() => setError('Não foi possível gerar o QR Code.'));
    return () => {
      active = false;
    };
  }, [plaqueModal]);

  const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };

  const buildSchoolLink = async (school: School, route: '/public/menu' | '/public/meal-service') => {
    const link = await getPublicLink(school.id) as { slug: string; token: string };
    const search = new URLSearchParams({ slug: link.slug, token: link.token }).toString();
    return `${window.location.origin}/#${route}?${search}`;
  };

  const openPublicMenu = async (school: School) => {
    try {
      const url = await buildSchoolLink(school, '/public/menu');
      await copyText(url);
      setSuccess('Link do cardápio copiado automaticamente.');
    } catch {
      setError('Não foi possível gerar o link público.');
    }
  };

  const openPublicConsumption = async (school: School) => {
    try {
      const url = await buildSchoolLink(school, '/public/meal-service');
      await copyText(url);
      setSuccess('Link de refeições servidas copiado automaticamente.');
    } catch {
      setError('Não foi possível gerar o link público.');
    }
  };

  const openPlaque = async (school: School) => {
    try {
      const url = await buildSchoolLink(school, '/public/meal-service');
      await copyText(url);
      setPlaqueModal({
        schoolName: school.name,
        link: url,
        title: 'Plaquinha de Refeições Servidas',
      });
      setSuccess('Link copiado e plaquinha gerada.');
    } catch {
      setError('Não foi possível gerar a plaquinha.');
    }
  };

  const printPlaque = () => {
    if (!plaqueModal || !plaqueQr) return;
    const win = window.open('', '_blank', 'width=540,height=720');
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>${plaqueModal.title}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px; text-align: center;">
          <h2 style="margin: 0 0 8px;">${plaqueModal.title}</h2>
          <p style="margin: 0 0 16px; font-size: 18px; font-weight: 600;">${plaqueModal.schoolName}</p>
          <img src="${plaqueQr}" alt="QR Code" style="width: 320px; height: 320px;" />
          <p style="margin-top: 16px; font-size: 12px; word-break: break-all;">${plaqueModal.link}</p>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const drawWrappedCenteredText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    });
    if (line) ctx.fillText(line, x, currentY);
    return currentY;
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => (
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    })
  );

  const buildPlaqueCanvas = async () => {
    if (!plaqueModal || !plaqueQr) return null;
    const width = 1240;
    const height = 1754;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = '700 56px Arial';
    ctx.fillText(plaqueModal.title, width / 2, 120);

    ctx.fillStyle = '#334155';
    ctx.font = '700 46px Arial';
    drawWrappedCenteredText(ctx, plaqueModal.schoolName, width / 2, 200, width - 180, 56);

    const qrImage = await loadImage(plaqueQr);
    const qrSize = 760;
    const qrX = (width - qrSize) / 2;
    const qrY = 320;
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    ctx.fillStyle = '#475569';
    ctx.font = '600 30px Arial';
    ctx.fillText('Escaneie para acessar', width / 2, 1130);

    ctx.fillStyle = '#64748b';
    ctx.font = '400 22px Arial';
    drawWrappedCenteredText(ctx, plaqueModal.link, width / 2, 1210, width - 160, 30);

    return canvas;
  };

  const downloadPlaquePng = async () => {
    try {
      const canvas = await buildPlaqueCanvas();
      if (!canvas || !plaqueModal) return;
      const a = document.createElement('a');
      const schoolSlug = plaqueModal.schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.href = canvas.toDataURL('image/png');
      a.download = `plaquinha-${schoolSlug || 'escola'}.png`;
      a.click();
      setSuccess('Plaquinha em PNG baixada.');
    } catch {
      setError('Não foi possível baixar a plaquinha em PNG.');
    }
  };

  const downloadPlaquePdf = async () => {
    try {
      const canvas = await buildPlaqueCanvas();
      if (!canvas || !plaqueModal) return;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL('image/png');
      const imgRatio = canvas.width / canvas.height;
      let renderWidth = pageWidth - 40;
      let renderHeight = renderWidth / imgRatio;
      if (renderHeight > pageHeight - 40) {
        renderHeight = pageHeight - 40;
        renderWidth = renderHeight * imgRatio;
      }
      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;
      pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
      const schoolSlug = plaqueModal.schoolName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      pdf.save(`plaquinha-${schoolSlug || 'escola'}.pdf`);
      setSuccess('Plaquinha em PDF baixada.');
    } catch {
      setError('Não foi possível baixar a plaquinha em PDF.');
    }
  };

  const openSchoolStock = async (school: School) => {
    setStockLoading(true);
    try {
      const data = await getSchoolStock(school.id);
      setStockModal({ school, data });
    } catch {
      setError('Não foi possível carregar o estoque da escola.');
    } finally {
      setStockLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', address: '', city: '', is_active: true });
    setShowModal(true);
  };

  const openMenuModal = async (school: School) => {
    setMenuLoading(true);
    setMenuModal({ school, menus: [] });
    try {
      const menusData = await getMenus({ school: school.id });
      setMenuModal({ school, menus: menusData });
    } catch {
      setError('Não foi possível carregar os cardápios.');
    } finally {
      setMenuLoading(false);
    }
  };

  const openCopyModal = (menuId: string) => {
    setCopyingMenuId(menuId);
    setCopyTargetSchool('');
    setCopyWeekStart('');
    setCopyWeekEnd('');
    setCopySuccess('');
    setCopyModalOpen(true);
  };

  const handleCopyMenu = async () => {
    if (!copyingMenuId || !copyTargetSchool) return;
    try {
      await copyMenu(copyingMenuId, copyTargetSchool, copyWeekStart || undefined, copyWeekEnd || undefined);
      setCopySuccess('Cardápio copiado com sucesso!');
      setTimeout(() => {
        setCopyModalOpen(false);
        setCopySuccess('');
      }, 2000);
    } catch {
      setError('Não foi possível copiar o cardápio.');
    }
  };

  const openConfigModal = async (school: School) => {
    setConfigLoading(true);
    setConfigModal({ school, items: [] });
    setEditingLimits({});
    try {
      const items = await getSchoolStockConfig(school.id);
      setConfigModal({ school, items: items as StockConfigItem[] });
      // Initialize editing limits with current values
      const limits: Record<string, string> = {};
      (items as StockConfigItem[]).forEach((item: StockConfigItem) => {
        limits[item.id] = item.min_stock.toString();
      });
      setEditingLimits(limits);
    } catch {
      setError('Não foi possível carregar configurações de estoque.');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSaveLimit = async (itemId: string, newLimit: number) => {
    try {
      await updateSchoolStockLimit(itemId, newLimit);
      setConfigModal(prev => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.map(item =>
            item.id === itemId ? { ...item, min_stock: newLimit } : item
          )
        };
      });
    } catch (error) {
      let message = 'Não foi possível atualizar limite.';
      if (error instanceof Error && error.message) {
        try {
          const parsed = JSON.parse(error.message);
          if (typeof parsed?.detail === 'string') {
            message = parsed.detail;
          } else if (Array.isArray(parsed?.min_stock) && parsed.min_stock[0]) {
            message = parsed.min_stock[0];
          }
        } catch {
          // Keep default message when response is not JSON.
        }
      }
      setError(message);
    }
  };

  const openEdit = (school: School) => {
    setEditing(school);
    const [address, city] = school.location.split(' • ');
    setForm({
      name: school.name,
      address: address || '',
      city: city || '',
      is_active: school.status === 'active',
    });
    setShowModal(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      if (editing) {
        await updateSchool(editing.id, form);
      } else {
        await createSchool(form);
      }
      setShowModal(false);
      const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active';
      await loadSchools({ q: search, is_active: isActive, city: cityFilter, address: addressFilter });
    } catch {
      setError('Não foi possível salvar a escola.');
    }
  };

  const handleDelete = async (school: School) => {
    if (!confirm(`Excluir ${school.name}?`)) return;
    try {
      await deleteSchool(school.id);
      const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active';
      await loadSchools({ q: search, is_active: isActive, city: cityFilter, address: addressFilter });
    } catch {
      setError('Não foi possível excluir a escola.');
    }
  };

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(''), 2500);
    return () => clearTimeout(timer);
  }, [success]);

  // Generate avatar color from school name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-primary-500', 'bg-secondary-500', 'bg-accent-500',
      'bg-success-500', 'bg-warning-500', 'bg-pink-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="flex flex-col flex-1 pb-24 lg:pb-8">
      {/* Header */}
      <div className="p-4 lg:p-6 space-y-4">
        {/* Title & Add Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Escolas</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {schools.length} escola{schools.length !== 1 ? 's' : ''} cadastrada{schools.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary">
            <span className="material-symbols-outlined">add</span>
            <span className="hidden sm:inline">Nova Escola</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-with-icon"
            placeholder="Pesquisar escola..."
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setStatusFilter(statusFilter === 'all' ? 'active' : statusFilter === 'active' ? 'pending' : 'all')}
            className={`chip shrink-0 ${statusFilter !== 'all' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : ''}`}
          >
            <span className="material-symbols-outlined text-sm">filter_list</span>
            {statusFilter === 'all' ? 'Todos' : statusFilter === 'active' ? 'Ativas' : 'Pendentes'}
          </button>

          <div className="chip shrink-0">
            <span className="material-symbols-outlined text-sm">location_city</span>
            <input
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-transparent outline-none w-20 text-sm"
              placeholder="Cidade"
            />
          </div>

          <div className="chip shrink-0">
            <span className="material-symbols-outlined text-sm">home_pin</span>
            <input
              value={addressFilter}
              onChange={(e) => setAddressFilter(e.target.value)}
              className="bg-transparent outline-none w-20 text-sm"
              placeholder="Bairro"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mb-4 p-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}
      {success && (
        <div className="mx-4 mb-4 p-4 rounded-xl bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          {success}
        </div>
      )}

      {/* Schools Grid */}
      <div className="flex-1 px-4 lg:px-6">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : schools.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined text-3xl">school</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Nenhuma escola encontrada</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">Cadastre sua primeira escola para começar</p>
            <button onClick={openCreate} className="btn-primary">
              <span className="material-symbols-outlined">add</span>
              Cadastrar Escola
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {schools.map((school, index) => (
              <div
                key={school.id}
                className="card p-5 hover:shadow-card-hover animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl ${getAvatarColor(school.name)} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                    {school.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{school.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{locationLabel(school)}</p>
                  </div>
                  <span className={`badge shrink-0 ${school.status === 'active' ? 'badge-success' : 'badge-warning'
                    }`}>
                    {school.status === 'active' ? 'Ativa' : 'Pendente'}
                  </span>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-6 gap-2">
                  <button
                    onClick={() => openEdit(school)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-slate-500">edit</span>
                    <span className="text-[10px] font-medium text-slate-500">Editar</span>
                  </button>
                  <button
                    onClick={() => openPublicMenu(school)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-primary-500">link</span>
                    <span className="text-[10px] font-medium text-slate-500">Link</span>
                  </button>
                  <button
                    onClick={() => openPublicConsumption(school)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-accent-500">inventory_2</span>
                    <span className="text-[10px] font-medium text-slate-500">Consumo</span>
                  </button>
                  <button
                    onClick={() => openPlaque(school)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-secondary-500">qr_code_2</span>
                    <span className="text-[10px] font-medium text-slate-500">Plaquinha</span>
                  </button>
                  <button
                    onClick={() => openConfigModal(school)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Configurar limites de estoque"
                  >
                    <span className="material-symbols-outlined text-warning-500">settings</span>
                    <span className="text-[10px] font-medium text-slate-500">Limites</span>
                  </button>
                  <button
                    onClick={() => handleDelete(school)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-danger-500">delete</span>
                    <span className="text-[10px] font-medium text-slate-500">Excluir</span>
                  </button>
                </div>

                {/* Menu Button */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => openSchoolStock(school)}
                    disabled={stockLoading}
                    className="btn bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400 hover:bg-success-100 dark:hover:bg-success-900/30"
                  >
                    <span className="material-symbols-outlined">warehouse</span>
                    Estoque
                  </button>
                  <button
                    onClick={() => openMenuModal(school)}
                    disabled={menuLoading}
                    className="btn bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30"
                  >
                    <span className="material-symbols-outlined">restaurant_menu</span>
                    Cardápio
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary-500">school</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editing ? 'Editar Escola' : 'Nova Escola'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nome</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome da escola"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Endereço</label>
                  <input
                    className="input"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Rua, número"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cidade</label>
                  <input
                    className="input"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Escola ativa</p>
                  <p className="text-xs text-slate-500">Aparecer nas listagens e relatórios</p>
                </div>
              </label>

              <button type="submit" className="w-full btn-primary h-12">
                <span className="material-symbols-outlined">check</span>
                {editing ? 'Salvar Alterações' : 'Cadastrar Escola'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Stock Modal */}
      {stockModal && (
        <div className="modal-overlay" onClick={() => setStockModal(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-content max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-success-500">warehouse</span>
                  Estoque da Escola
                </h2>
                <p className="text-sm text-slate-500">{stockModal.school.name}</p>
              </div>
              <button onClick={() => setStockModal(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 p-5 bg-slate-50 dark:bg-slate-800/50">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stockModal.data.summary?.total_items || 0}</p>
                <p className="text-xs text-slate-500 uppercase">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success-500">{stockModal.data.summary?.normal_stock || 0}</p>
                <p className="text-xs text-slate-500 uppercase">Normal</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-danger-500">{stockModal.data.summary?.low_stock || 0}</p>
                <p className="text-xs text-slate-500 uppercase">Baixo</p>
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {stockModal.data.items?.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
                  <p>Nenhum insumo no estoque desta escola</p>
                  <p className="text-xs mt-1">O estoque será atualizado quando entregas forem conferidas</p>
                </div>
              ) : (
                stockModal.data.items?.map((item: any) => (
                  <div
                    key={item.supply?.id}
                    className={`p-3 rounded-xl border ${item.status === 'BAIXO'
                      ? 'border-danger-200 bg-danger-50 dark:border-danger-900/50 dark:bg-danger-900/10'
                      : item.status === 'ALTO'
                        ? 'border-success-200 bg-success-50 dark:border-success-900/50 dark:bg-success-900/10'
                        : 'border-slate-200 dark:border-slate-700'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">{item.supply?.name}</p>
                        <p className="text-xs text-slate-500">{item.supply?.category}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {Number(item.quantity).toFixed(2)} <span className="text-sm font-normal text-slate-500">{item.supply?.unit}</span>
                        </p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.status === 'BAIXO'
                          ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                          : item.status === 'ALTO'
                            ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setStockModal(null)} className="btn-secondary w-full">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Modal */}
      {menuModal && (
        <div className="modal-overlay" onClick={() => setMenuModal(null)}>
          <div className="modal-content max-w-xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary-500">restaurant_menu</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cardápios</h3>
                  <p className="text-xs text-slate-500">{menuModal.school.name}</p>
                </div>
              </div>
              <button
                onClick={() => setMenuModal(null)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              {menuLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-slate-500">Carregando cardápios...</p>
                </div>
              ) : menuModal.menus.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <span className="material-symbols-outlined text-4xl mb-2">restaurant_menu</span>
                  <p>Nenhum cardápio cadastrado</p>
                  <button onClick={() => { setMenuModal(null); navigate('/admin/editor'); }} className="btn-primary mt-4">
                    <span className="material-symbols-outlined">add</span>
                    Criar Cardápio
                  </button>
                </div>
              ) : (
                menuModal.menus.map((menu) => (
                  <div key={menu.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge ${menu.status === 'PUBLISHED' ? 'badge-success' : 'badge-warning'}`}>
                            {menu.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}
                          </span>
                        </div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {menu.week_start} a {menu.week_end}
                        </p>
                        {menu.name && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{menu.name}</p>
                        )}
                        <p className="text-xs text-slate-500">{(menu as any).items?.length || 0} itens</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/admin/editor?school=${menuModal.school.id}&week_start=${menu.week_start}&week_end=${menu.week_end}`)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Visualizar/Editar"
                        >
                          <span className="material-symbols-outlined text-slate-500">visibility</span>
                        </button>
                        <button
                          onClick={() => openCopyModal(menu.id)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                          title="Copiar para outra escola"
                        >
                          <span className="material-symbols-outlined text-primary-500">content_copy</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex gap-2">
              <button onClick={() => setMenuModal(null)} className="btn-secondary flex-1">Fechar</button>
              <button onClick={() => { setMenuModal(null); navigate('/admin/editor'); }} className="btn-primary flex-1">
                <span className="material-symbols-outlined">add</span>
                Novo Cardápio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Menu Modal */}
      {copyModalOpen && (
        <div className="modal-overlay" onClick={() => setCopyModalOpen(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Copiar Cardápio</h3>

              {copySuccess ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-4xl text-success-500 mb-2">check_circle</span>
                  <p className="text-success-600">{copySuccess}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Escola destino *</label>
                    <select
                      value={copyTargetSchool}
                      onChange={(e) => setCopyTargetSchool(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Selecione...</option>
                      {schools.filter(s => s.id !== menuModal?.school.id).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Início da semana</label>
                      <input
                        type="date"
                        value={copyWeekStart}
                        onChange={(e) => setCopyWeekStart(e.target.value)}
                        className="input w-full"
                        placeholder="Manter original"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fim da semana</label>
                      <input
                        type="date"
                        value={copyWeekEnd}
                        onChange={(e) => setCopyWeekEnd(e.target.value)}
                        className="input w-full"
                        placeholder="Manter original"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Deixe as datas em branco para usar as mesmas do cardápio original.</p>
                </div>
              )}
            </div>
            {!copySuccess && (
              <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                <button onClick={() => setCopyModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleCopyMenu} disabled={!copyTargetSchool} className="btn-primary flex-1">
                  <span className="material-symbols-outlined">content_copy</span>
                  Copiar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {plaqueModal && (
        <div className="modal-overlay" onClick={() => setPlaqueModal(null)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plaqueModal.title}</h3>
                <p className="text-sm text-slate-500">{plaqueModal.schoolName}</p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-center min-h-72 bg-white">
                {plaqueQr ? (
                  <img src={plaqueQr} alt="QR Code da escola" className="w-64 h-64" />
                ) : (
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              <p className="text-xs text-slate-500 break-all">{plaqueModal.link}</p>
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2">
              <button onClick={() => copyText(plaqueModal.link)} className="btn-secondary">Copiar</button>
              <button onClick={printPlaque} className="btn-secondary">Imprimir</button>
              <button onClick={downloadPlaquePng} className="btn-primary">Baixar PNG</button>
              <button onClick={downloadPlaquePdf} className="btn-primary">Baixar PDF</button>
              <button onClick={() => setPlaqueModal(null)} className="btn-secondary col-span-2">Fechar</button>
            </div>
          </div>
        </div>
      )}
      {/* Stock Config Modal */}
      {configModal && (
        <div className="modal-overlay" onClick={() => setConfigModal(null)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-warning-500">settings</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Configurar Limites de Estoque</h3>
                  <p className="text-xs text-slate-500">{configModal.school.name}</p>
                </div>
              </div>
              <button onClick={() => setConfigModal(null)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {configLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-slate-500">Carregando itens...</p>
                </div>
              ) : configModal.items.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
                  <p>Nenhum item em estoque para configurar.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-slate-500 uppercase">
                    <div className="col-span-6">Item</div>
                    <div className="col-span-3 text-right">Estoque Atual</div>
                    <div className="col-span-3 text-right">Mínimo</div>
                  </div>
                  {configModal.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-4 items-center p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                      <div className="col-span-6">
                        <p className="font-medium text-slate-900 dark:text-white">{item.supply.name}</p>
                        <p className="text-xs text-slate-500">{item.supply.category} • {item.supply.unit}</p>
                      </div>
                      <div className="col-span-3 text-right font-mono text-sm text-slate-600 dark:text-slate-400">
                        {item.quantity}
                      </div>
                      <div className="col-span-3 flex justify-end">
                        <div className="relative w-24">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingLimits[item.id] ?? item.min_stock}
                            onChange={(e) => setEditingLimits(prev => ({ ...prev, [item.id]: e.target.value }))}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val !== item.min_stock) {
                                handleSaveLimit(item.id, val);
                              }
                            }}
                            className="w-full px-3 py-1.5 text-right text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                          />
                          {item.min_stock > 0 && item.quantity < item.min_stock && (
                            <div className="absolute -right-2 -top-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" title="Estoque abaixo do mínimo"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 text-center">
              Alterações são salvas automaticamente ao sair do campo.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default Schools;
