import React, { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Schools from './pages/Schools';
import Inventory from './pages/Inventory';
import MenuEditor from './pages/MenuEditor';
import ConsumptionRegistry from './pages/ConsumptionRegistry';
import Deliveries from './pages/Deliveries';
import PublicMenu from './pages/PublicMenu';
import PublicDeliveryConference from './pages/PublicDeliveryConference';
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

  // Mapping paths to titles
  const getTitle = () => {
    switch(location.pathname) {
      case '/admin': return 'SEMED Admin';
      case '/admin/schools': return 'Escolas';
      case '/admin/inventory': return 'Insumos';
      case '/admin/deliveries': return 'Entregas';
      case '/admin/editor': return 'Editor de Cardápio';
      case '/admin/consumption': return 'Registro de Consumo';
      default: return 'Merenda SEMED';
    }
  };

  const isEditor = location.pathname === '/admin/editor';
  const isConsumption = location.pathname === '/admin/consumption';

  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Sidebar for Desktop */}
      <div className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 fixed h-full z-10">
        <div className="p-6">
           <h2 className="text-xl font-bold text-primary flex items-center gap-2">
             <span className="material-symbols-outlined">restaurant</span> SEMED
           </h2>
        </div>
        <nav className="flex-1 flex flex-col gap-1 px-3">
           <button onClick={() => navigate('/admin')} className={`flex items-center gap-3 px-3 py-3 rounded-lg font-bold ${location.pathname === '/admin' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
             <span className="material-symbols-outlined">dashboard</span> Home
           </button>
           <button onClick={() => navigate('/admin/schools')} className={`flex items-center gap-3 px-3 py-3 rounded-lg font-bold ${location.pathname === '/admin/schools' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
             <span className="material-symbols-outlined">school</span> Escolas
           </button>
           <button onClick={() => navigate('/admin/inventory')} className={`flex items-center gap-3 px-3 py-3 rounded-lg font-bold ${location.pathname === '/admin/inventory' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
             <span className="material-symbols-outlined">inventory_2</span> Insumos
           </button>
           <button onClick={() => navigate('/admin/deliveries')} className={`flex items-center gap-3 px-3 py-3 rounded-lg font-bold ${location.pathname === '/admin/deliveries' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
             <span className="material-symbols-outlined">local_shipping</span> Entregas
           </button>
           <button onClick={() => navigate('/admin/editor')} className={`flex items-center gap-3 px-3 py-3 rounded-lg font-bold ${location.pathname === '/admin/editor' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
             <span className="material-symbols-outlined">edit_calendar</span> Editor
           </button>
           <button onClick={() => navigate('/admin/consumption')} className={`flex items-center gap-3 px-3 py-3 rounded-lg font-bold ${location.pathname === '/admin/consumption' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
             <span className="material-symbols-outlined">checklist</span> Consumo
           </button>
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
           <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-red-500 transition-colors font-medium">
             <span className="material-symbols-outlined">logout</span> Sair
           </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col w-full md:pl-64">
        {/* Top Bar (Mobile Only generally, but adapted for layout) */}
        {!isConsumption && (
          <header className={`sticky top-0 z-30 flex items-center bg-background-light dark:bg-background-dark p-4 border-b border-slate-200 dark:border-slate-800 justify-between ${isEditor ? 'bg-white' : ''}`}>
            <div 
              className="text-[#0d141b] dark:text-slate-100 flex size-12 shrink-0 items-center cursor-pointer md:hidden" 
              onClick={() => {
                if (isEditor) navigate(-1);
                else setSidebarOpen(true)
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                {isEditor ? 'arrow_back' : 'menu'}
              </span>
            </div>
            <h2 className="text-[#0d141b] dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center md:text-left md:pl-4">
              {getTitle()}
            </h2>
            <div className="flex w-12 items-center justify-end">
              <button className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 bg-transparent text-[#0d141b] dark:text-slate-100 min-w-0 p-0">
                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                  {isEditor ? 'more_vert' : 'account_circle'}
                </span>
              </button>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        
        <BottomNav />
      </div>
    </div>
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
              </Routes>
            </Layout>
          </RequireAuth>
        } />
      </Routes>
    </HashRouter>
  );
};

export default App;
