import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: 'dashboard', label: 'Home', path: '/admin' },
  { icon: 'school', label: 'Escolas', path: '/admin/schools' },
  { icon: 'inventory_2', label: 'Insumos', path: '/admin/inventory' },
  { icon: 'edit_calendar', label: 'Editor', path: '/admin/editor' },
  { icon: 'checklist', label: 'Consumo', path: '/admin/consumption' },
];

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center h-20 px-2 pb-5 pt-2 z-40 md:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      {navItems.slice(0, 4).map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-slate-400'}`}
          >
            <span className={`material-symbols-outlined ${isActive ? 'filled' : ''}`}>{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#141414]/40 flex" onClick={onClose}>
      <div 
        className="flex h-full w-10/12 max-w-xs flex-col gap-4 bg-background-light dark:bg-background-dark p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-primary">SEMED Admin</h2>
          <span className="material-symbols-outlined cursor-pointer" onClick={onClose}>close</span>
        </div>
        <ul className="flex flex-col gap-2">
          {navItems.map((item) => {
             const isActive = location.pathname === item.path;
             return (
              <li 
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  onClose();
                }}
                className={`flex h-12 items-center gap-4 rounded-lg px-4 cursor-pointer ${
                  isActive ? 'bg-primary/10 text-primary' : 'hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <p className="text-base font-bold leading-tight truncate">{item.label}</p>
              </li>
             );
          })}
           <li 
                onClick={() => {
                  navigate('/');
                  onClose();
                }}
                className="flex h-12 items-center gap-4 rounded-lg px-4 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 mt-auto border-t border-slate-200 dark:border-slate-800"
              >
                <span className="material-symbols-outlined">logout</span>
                <p className="text-base font-bold leading-tight truncate">Sair</p>
              </li>
        </ul>
      </div>
    </div>
  );
};
