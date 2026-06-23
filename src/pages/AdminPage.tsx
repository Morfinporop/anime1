import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { api } from '../api';
import type { User } from '../types';
import { ShieldIcon, SearchIcon } from '../components/icons';

interface AdminAnime {
  id: number;
  title: string;
  type: string;
  year: number;
  created_at: string;
  author: string | null;
  seasons_count: number;
  episodes_count: number;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [animeList, setAnimeList] = useState<AdminAnime[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'content'>('users');

  const load = (s?: string) => {
    api.adminListUsers(s).then(setUsers).catch(() => {});
    api.adminListAnime().then(setAnimeList as any).catch(() => {});
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.is_admin) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
        <ShieldIcon className="mx-auto mb-3 h-8 w-8 sm:h-10 sm:w-10 text-zinc-300" />
        <h1 className="text-display text-2xl text-zinc-900">Только для администратора</h1>
      </div>
    );
  }

  const toggleAdmin = async (id: number, isAdmin: boolean) => {
    await api.adminUpdateRole(id, { is_admin: !isAdmin });
    load(search);
  };

  const toggleUpload = async (id: number, canUpload: boolean) => {
    await api.adminUpdateRole(id, { can_upload: !canUpload });
    load(search);
  };

  const deleteAnime = async (id: number) => {
    if (!confirm('Удалить аниме целиком? Все сезоны и серии будут удалены.')) return;
    await api.adminDeleteAnime(id);
    load(search);
  };

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 animate-fade-in">
      <div className="bg-black rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 text-white mb-4 sm:mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ShieldIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          <h1 className="text-display text-2xl sm:text-3xl">Панель администратора</h1>
        </div>
        <p className="text-zinc-400 text-xs sm:text-sm">Управление пользователями и контентом</p>
      </div>

      <div className="flex gap-2 mb-3 sm:mb-4 overflow-x-auto">
        <button onClick={() => setActiveTab('users')}
          className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
            activeTab === 'users' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 border border-zinc-200'
          }`}>
          Пользователи ({users.length})
        </button>
        <button onClick={() => setActiveTab('content')}
          className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
            activeTab === 'content' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 border border-zinc-200'
          }`}>
          Контент ({animeList.length})
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-zinc-100">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); load(e.target.value); }}
                placeholder="Поиск по ID или нику..."
                className="w-full pl-9 sm:pl-10 pr-4 py-2 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="divide-y divide-zinc-100">
            {users.length === 0 ? (
              <p className="text-center py-8 sm:py-10 text-xs sm:text-sm text-zinc-500">Никого не найдено</p>
            ) : users.map(u => (
              <div key={u.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 flex-wrap">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0"
                  style={{ backgroundColor: u.avatar_color }}>
                  {u.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-xs sm:text-sm text-zinc-900 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {u.username}
                    {u.is_admin && <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-semibold uppercase">Admin</span>}
                    {u.can_upload && <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold uppercase">Автор</span>}
                  </div>
                  <div className="text-[11px] sm:text-xs text-zinc-500">ID #{u.id}</div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
                  <button
                    onClick={() => toggleUpload(u.id, u.can_upload)}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold transition ${
                      u.can_upload ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}>
                    {u.can_upload ? 'Автор ✓' : 'Загрузка'}
                  </button>
                  <button
                    onClick={() => toggleAdmin(u.id, u.is_admin)}
                    disabled={u.id === user.id}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold transition disabled:opacity-30 ${
                      u.is_admin ? 'bg-yellow-100 text-yellow-800' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}>
                    {u.is_admin ? 'Admin ✓' : 'Админ'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'content' && (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {animeList.length === 0 ? (
              <p className="text-center py-8 sm:py-10 text-xs sm:text-sm text-zinc-500">Контента нет</p>
            ) : animeList.map(a => (
              <div key={a.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-xs sm:text-sm text-zinc-900 truncate">{a.title}</div>
                  <div className="text-[11px] sm:text-xs text-zinc-500">
                    {a.type === 'season' ? `Сезонное · ${a.seasons_count} сез. / ${a.episodes_count} сер.` : 'Одиночное'} · {a.author || 'Система'}
                  </div>
                </div>
                <button
                  onClick={() => deleteAnime(a.id)}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition">
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}