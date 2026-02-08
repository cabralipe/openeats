import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tokenStore } from '../api';

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: 'dashboard', label: 'Home', path: '/admin' },
  { icon: 'school', label: 'Escolas', path: '/admin/schools' },
  { icon: 'inventory_2', label: 'Estoque', path: '/admin/inventory' },
  { icon: 'local_shipping', label: 'Entregas', path: '/admin/deliveries' },
];

const moreNavItems: NavItem[] = [
  { icon: 'edit_calendar', label: 'Editor', path: '/admin/editor' },
  { icon: 'checklist', label: 'Consumo', path: '/admin/consumption' },
  { icon: 'insert_chart', label: 'Relatórios', path: '/admin/reports' },
];

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const allItems = [...navItems];
  const activeIndex = allItems.findIndex(item => item.path === location.pathname);

  return (
    <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 z-40 pb-safe">
      <div className="relative flex items-center justify-around h-16 px-2">
        {/* Animated indicator */}
        {activeIndex >= 0 && (
          <div
            className="absolute top-0 h-0.5 w-12 bg-gradient-primary rounded-full transition-all duration-300"
            style={{
              left: `calc(${(activeIndex + 0.5) * (100 / navItems.length)}% - 24px)`
            }}
          />
        )}

        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-4 rounded-2xl transition-all duration-200 ${isActive
                  ? 'text-primary-500'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
            >
              <span className={`material-symbols-outlined text-2xl transition-transform duration-200 ${isActive ? 'filled scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-semibold ${isActive ? 'text-primary-500' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    tokenStore.clear();
    navigate('/', { replace: true });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sidebar Panel */}
      <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-primary">
                <span className="material-symbols-outlined text-white text-xl">restaurant</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Merenda</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">SEMED Admin</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-slate-500">close</span>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Principal</p>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${isActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                <span className={`material-symbols-outlined ${isActive ? 'filled' : ''}`}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-4">
            <p className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Operações</p>
          </div>
          {moreNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${isActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                <span className={`material-symbols-outlined ${isActive ? 'filled' : ''}`}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <button
            onClick={onLogout || handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors font-medium"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Sair da conta</span>
          </button>
          <p className="text-center text-xs text-slate-400">v2.5.0 • SEMED</p>
        </div>
      </div>
    </div>
  );
};
