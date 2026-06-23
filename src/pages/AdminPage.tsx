import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { store } from '../store';
import type { User } from '../types';
import { ShieldIcon, UploadIcon } from '../components/icons';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    setUsers(store.allUsers());
  }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
        <ShieldIcon className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
        <h1 className="text-display text-2xl text-zinc-900">Доступ только для администратора</h1>
      </div>
    );
  }

  const toggleCanUpload = (id: number) => {
    const u = users.find(x => x.id === id);
    if (!u || u.role === 'admin') return;
    store.setCanUpload(id, !u.can_upload);
    setUsers(store.allUsers());
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
      <div className="bg-black rounded-3xl shadow-xl p-6 sm:p-8 text-white mb-6">
        <div className="flex items-center gap-3 mb-2">
          <ShieldIcon className="w-7 h-7" />
          <h1 className="text-display text-3xl">Панель администратора</h1>
        </div>
        <p className="text-zinc-400 text-sm">Управление пользователями и доступом к загрузке.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        <Link to="/upload" className="bg-white rounded-2xl border border-zinc-200 p-5 hover:shadow-lg transition flex items-center gap-3">
          <UploadIcon className="w-6 h-6 text-zinc-900" />
          <div>
            <div className="font-semibold text-zinc-900">Загрузить аниме</div>
            <div className="text-xs text-zinc-500">Новый тайтл, серия или фильм</div>
          </div>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">Пользователи · {users.length}</h2>
        </div>
        <div className="divide-y divide-zinc-100">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {u.username[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
                  {u.username}
                  {u.role === 'admin' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-semibold uppercase tracking-wider">
                      Администратор
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">ID #{u.id} · {new Date(u.created_at).toLocaleDateString('ru-RU')}</div>
              </div>
              {u.role !== 'admin' && (
                <button
                  onClick={() => toggleCanUpload(u.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                    u.can_upload ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {u.can_upload ? 'Автор ✓' : 'Выдать права'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}