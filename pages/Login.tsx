import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import { login } from '../api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      setError('Credenciais inválidas ou servidor indisponível.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background-light dark:bg-background-dark">
      {/* Left Panel - Hero Image/Gradient (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-600">
          {/* Mesh gradient overlay */}
          <div className="absolute inset-0 bg-mesh-dark opacity-50"></div>

          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 -left-20 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="max-w-lg">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-3xl">restaurant</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Merenda SEMED</h1>
                <p className="text-white/70 text-sm">Sistema de Alimentação Escolar</p>
              </div>
            </div>

            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              Gestão inteligente da merenda escolar
            </h2>
            <p className="text-lg text-white/80 leading-relaxed">
              Controle estoque, cardápios, entregas e consumo de forma simples e eficiente.
              Tudo em uma única plataforma.
            </p>

            {/* Stats */}
            <div className="flex gap-8 mt-12">
              <div>
                <p className="text-3xl font-bold text-white">50+</p>
                <p className="text-sm text-white/60">Escolas</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">10k+</p>
                <p className="text-sm text-white/60">Refeições/dia</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">100%</p>
                <p className="text-sm text-white/60">Digital</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow-primary mb-4">
              <span className="material-symbols-outlined text-white text-3xl">restaurant</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Merenda SEMED</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Sistema de Alimentação Escolar</p>
          </div>

          {/* Login Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-700">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Bem-vindo de volta</h2>
              <p className="text-slate-500 dark:text-slate-400">
                Faça login para acessar o sistema
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  E-mail
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-xl">
                    mail
                  </span>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-with-icon"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Senha
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-xl">
                    lock
                  </span>
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-with-icon pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500" />
                  <span>Lembrar de mim</span>
                </label>
                <a href="#" className="text-sm font-medium text-primary-500 hover:text-primary-600 transition-colors">
                  Esqueci a senha
                </a>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm animate-fade-in">
                  <span className="material-symbols-outlined text-lg">error</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                disabled={isSubmitting}
                type="submit"
                className="w-full btn-primary h-12 text-base shadow-lg shadow-primary-500/30"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Entrar
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Public Links */}
          <div className="mt-8 text-center space-y-4">
            <button
              onClick={() => navigate('/public/menu')}
              className="text-sm text-primary-500 hover:text-primary-600 font-medium transition-colors"
            >
              Ver Cardápio Público
            </button>

            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
              <span>Central de Administração SEMED</span>
              <span>•</span>
              <span className="font-semibold">v2.5.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
