import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login
    navigate('/admin');
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden">
      <div className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between">
        <div className="w-12 h-12 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-3xl">restaurant</span>
        </div>
        <h2 className="text-[#0d141b] dark:text-white text-lg font-bold leading-tight flex-1 text-center">Merenda SEMED</h2>
        <div className="w-12"></div>
      </div>

      <div className="@container">
        <div className="@[480px]:px-4 @[480px]:py-3">
          <div 
            className="w-full bg-center bg-no-repeat bg-cover flex flex-col justify-end overflow-hidden bg-slate-200 dark:bg-slate-800 @[480px]:rounded-lg min-h-[218px]" 
            style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.4)), url("${IMAGES.loginBg}")` }}
          >
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-[#0d141b] dark:text-white tracking-light text-[28px] font-bold leading-tight px-4 text-center pb-1 pt-6">Bem-vindo</h2>
        <p className="text-[#4c739a] dark:text-slate-400 text-base font-normal leading-normal pb-6 pt-1 px-8 text-center">
          Faça login para gerenciar o sistema de alimentação escolar
        </p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col w-full">
            <p className="text-[#0d141b] dark:text-white text-base font-medium leading-normal pb-2">E-mail</p>
            <div className="relative">
              <input 
                required
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-14 placeholder:text-[#4c739a] p-[15px] pl-12 text-base font-normal leading-normal" 
                placeholder="exemplo@semed.com" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#4c739a]">mail</span>
            </div>
          </label>
          <label className="flex flex-col w-full">
            <p className="text-[#0d141b] dark:text-white text-base font-medium leading-normal pb-2">Senha</p>
            <div className="relative">
              <input 
                required
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d141b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-900 h-14 placeholder:text-[#4c739a] p-[15px] pl-12 text-base font-normal leading-normal" 
                placeholder="••••••••" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#4c739a]">lock</span>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#4c739a] cursor-pointer">visibility</span>
            </div>
          </label>
        </div>
        <div className="flex flex-col gap-4 pt-4">
          <button type="submit" className="w-full bg-primary text-white font-bold h-14 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
            <span>Entrar</span>
            <span className="material-symbols-outlined">login</span>
          </button>
          <a className="text-primary text-sm font-semibold text-center py-2 hover:underline" href="#">
            Esqueci minha senha
          </a>
        </div>
      </form>

      <div className="mt-auto p-8 flex flex-col items-center gap-2">
        <button onClick={() => navigate('/public/menu')} className="text-sm text-slate-500 underline mb-4">Ver Cardápio Público</button>
        <div className="flex items-center gap-2 text-[#4c739a] text-xs">
          <span>Central de Administração SEMED</span>
        </div>
        <p className="text-[#4c739a] text-[10px] uppercase tracking-widest font-bold">Versão 2.4.0</p>
      </div>
      <div className="h-5 bg-background-light dark:bg-background-dark"></div>
    </div>
  );
};

export default Login;
