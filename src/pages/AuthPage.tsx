import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { CloseIcon } from '../components/icons';

export default function AuthPage() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/profile" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (username.length < 3) return setError('Имя пользователя — минимум 3 символа');
    if (password.length < 4) return setError('Пароль — минимум 4 символа');
    setBusy(true);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
      navigate('/profile');
    } catch (err: any) {
      setError(err.message ?? 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-zinc-900 text-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Крестик закрытия */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
          aria-label="Закрыть"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Переключатель */}
          <div className="flex bg-white/5 rounded-full p-1 mb-6 mt-2">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${mode === 'login' ? 'bg-white text-zinc-900' : 'text-white/70 hover:text-white'}`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${mode === 'register' ? 'bg-white text-zinc-900' : 'text-white/70 hover:text-white'}`}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:bg-white/10 focus:border-white/30 focus:outline-none text-sm text-white placeholder:text-white/40 transition"
                placeholder="Имя пользователя"
                autoComplete="username"
              />
            </div>
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:bg-white/10 focus:border-white/30 focus:outline-none text-sm text-white placeholder:text-white/40 transition"
                placeholder="Пароль"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-xl bg-white text-zinc-900 font-bold hover:bg-zinc-200 disabled:opacity-50 transition"
            >
              {busy ? 'Подождите...' : (mode === 'login' ? 'Войти' : 'Создать аккаунт')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}