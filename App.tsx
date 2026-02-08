import React, { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Schools from './pages/Schools';
import Inventory from './pages/Inventory';
import MenuEditor from './pages/MenuEditor';
import ConsumptionRegistry from './pages/ConsumptionRegistry';
import Deliveries from './pages/Deliveries';
import Reports from './pages/Reports';
import PublicMenu from './pages/PublicMenu';
import PublicDeliveryConference from './pages/PublicDeliveryConference';
import PublicConsumption from './pages/PublicConsumption';
import { BottomNav, Sidebar } from './components/Navigation';
import { AUTH_EXPIRED_EVENT, tokenStore } from './api';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleAuthExpired = () => navigate('/', { replace: true });
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [navigate]);

  const handleLogout = () => {
    tokenStore.clear();
    navigate('/', { replace: true });
  };

  // Page titles mapping
  const getTitle = () => {
    const titles: Record<string, string> = {
      '/admin': 'Dashboard',
      '/admin/schools': 'Escolas',
      '/admin/inventory': 'Estoque',
      '/admin/deliveries': 'Entregas',
      '/admin/editor': 'Editor de Cardápio',
      '/admin/consumption': 'Registro de Consumo',
      '/admin/reports': 'Relatórios',
    };
    return titles[location.pathname] || 'SEMED';
  };

  // Page icons mapping
  const getIcon = () => {
    const icons: Record<string, string> = {
      '/admin': 'dashboard',
      '/admin/schools': 'school',
      '/admin/inventory': 'inventory_2',
      '/admin/deliveries': 'local_shipping',
      '/admin/editor': 'edit_calendar',
      '/admin/consumption': 'checklist',
      '/admin/reports': 'insert_chart',
    };
    return icons[location.pathname] || 'home';
  };

  const isEditor = location.pathname === '/admin/editor';
  const isConsumption = location.pathname === '/admin/consumption';

  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark">
      {/* Mobile Sidebar Overlay */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 fixed h-full z-20">
        {/* Logo */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-primary">
              <span className="material-symbols-outlined text-white text-xl">restaurant</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Merenda</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">SEMED Admin</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem icon="dashboard" label="Dashboard" path="/admin" current={location.pathname} onClick={() => navigate('/admin')} />
          <NavItem icon="school" label="Escolas" path="/admin/schools" current={location.pathname} onClick={() => navigate('/admin/schools')} />
          <NavItem icon="inventory_2" label="Estoque" path="/admin/inventory" current={location.pathname} onClick={() => navigate('/admin/inventory')} />
          <NavItem icon="local_shipping" label="Entregas" path="/admin/deliveries" current={location.pathname} onClick={() => navigate('/admin/deliveries')} />

          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Operações</p>
          </div>

          <NavItem icon="edit_calendar" label="Editor de Cardápio" path="/admin/editor" current={location.pathname} onClick={() => navigate('/admin/editor')} />
          <NavItem icon="checklist" label="Registro de Consumo" path="/admin/consumption" current={location.pathname} onClick={() => navigate('/admin/consumption')} />
          <NavItem icon="insert_chart" label="Relatórios" path="/admin/reports" current={location.pathname} onClick={() => navigate('/admin/reports')} />
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors font-medium"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full lg:pl-72">
        {/* Top Header */}
        {!isConsumption && (
          <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
            <div className="flex items-center justify-between h-16 px-4">
              {/* Left side - Menu button (mobile) or breadcrumb */}
              <div className="flex items-center gap-3">
                <button
                  className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => isEditor ? navigate(-1) : setSidebarOpen(true)}
                >
                  <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">
                    {isEditor ? 'arrow_back' : 'menu'}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/30 items-center justify-center">
                    <span className="material-symbols-outlined text-primary-500 text-lg">{getIcon()}</span>
                  </div>
                  <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{getTitle()}</h1>
                </div>
              </div>

              {/* Right side - Actions */}
              <div className="flex items-center gap-2">
                <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative">
                  <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">notifications</span>
                  <span className="absolute top-2 right-2 w-2 h-2 bg-danger-500 rounded-full"></span>
                </button>
                <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">
                    {isEditor ? 'more_vert' : 'account_circle'}
                  </span>
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>

        {/* Bottom Navigation (Mobile) */}
        <BottomNav />
      </div>
    </div>
  );
};

// Navigation Item Component
const NavItem: React.FC<{
  icon: string;
  label: string;
  path: string;
  current: string;
  onClick: () => void;
}> = ({ icon, label, path, current, onClick }) => {
  const isActive = current === path;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${isActive
          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }`}
    >
      <span className={`material-symbols-outlined text-xl ${isActive ? 'filled' : ''}`}>{icon}</span>
      <span>{label}</span>
      {isActive && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500"></span>
      )}
    </button>
  );
};

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  if (!tokenStore.getAccess()) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/public/menu" element={<PublicMenu />} />
        <Route path="/public/delivery" element={<PublicDeliveryConference />} />
        <Route path="/public/consumption" element={<PublicConsumption />} />
        <Route path="/admin/*" element={
          <RequireAuth>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/schools" element={<Schools />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/deliveries" element={<Deliveries />} />
                <Route path="/editor" element={<MenuEditor />} />
                <Route path="/consumption" element={<ConsumptionRegistry />} />
                <Route path="/reports" element={<Reports />} />
              </Routes>
            </Layout>
          </RequireAuth>
        } />
      </Routes>
    </HashRouter>
  );
};

export default App;
