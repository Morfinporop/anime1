import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useNotify } from '../notify';
import { CloseIcon, EyeIcon, EyeOffIcon } from '../components/icons';

export default function AuthPage() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const notify = useNotify();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to={`/user/${user.id}`} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      notify.error('Имя пользователя должно содержать минимум 3 символа');
      return;
    }
    if (password.length < 4) {
      notify.error('Пароль должен содержать минимум 4 символа');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(username, password);
        notify.success('Добро пожаловать');
      } else {
        await register(username, password);
        notify.success('Аккаунт создан');
      }
      navigate(-1);
    } catch (err: any) {
      notify.error(err.message ?? 'Произошла ошибка');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md bg-zinc-900 text-white rounded-3xl shadow-2xl overflow-hidden border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Кнопка закрытия */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition flex items-center justify-center"
          aria-label="Закрыть"
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        <div className="relative p-6 sm:p-8 pt-8">
          <h1 className="text-center text-2xl font-bold tracking-tight">
            {mode === 'login' ? 'С возвращением' : 'Добро пожаловать'}
          </h1>
          <p className="text-center text-xs sm:text-sm text-zinc-400 mt-1.5">
            {mode === 'login' ? 'Войдите в свой аккаунт' : 'Создайте новый аккаунт'}
          </p>

          {/* Переключатель */}
          <div className="mt-4 flex bg-white/5 rounded-2xl p-1 border border-white/5">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                mode === 'login' ? 'bg-white text-zinc-900 shadow-lg' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                mode === 'register' ? 'bg-white text-zinc-900 shadow-lg' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Регистрация
            </button>
          </div>

          {/* Форма */}
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
                Имя пользователя
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:bg-white/10 focus:border-white/25 focus:outline-none text-sm text-white placeholder:text-zinc-500 transition"
                placeholder="Введите имя"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
                Пароль
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-white/5 border border-white/10 focus:bg-white/10 focus:border-white/25 focus:outline-none text-sm text-white placeholder:text-zinc-500 transition"
                  placeholder="Введите пароль"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-white transition"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full mt-2 py-3 rounded-xl bg-white text-zinc-900 font-bold hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
            >
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-zinc-300 border-t-zinc-900 animate-spin-slow" />
                  Подождите...
                </span>
              ) : (
                mode === 'login' ? 'Войти' : 'Создать аккаунт'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}