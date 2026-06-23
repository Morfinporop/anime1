import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useNotify } from '../notify';
import { api } from '../api';
import type { User } from '../types';
import {
  ShieldIcon, SearchIcon, UploadIcon, UserIcon, CheckIcon,
} from '../components/icons';
import { UserAvatar } from '../components/UserAvatar';

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
  const notify = useNotify();
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
  if (!user.is_admin && !user.isAdmin) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
        <ShieldIcon className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
        <h1 className="text-display text-2xl text-zinc-900">Только для администратора</h1>
      </div>
    );
  }

  const isAdmin = (u: User) => u.is_admin || u.isAdmin;
  const canUpload = (u: User) => u.can_upload || u.canUpload;

  const toggleAdmin = async (id: number, isCurrentlyAdmin: boolean) => {
    try {
      await api.adminUpdateRole(id, { is_admin: !isCurrentlyAdmin });
      notify.success(isCurrentlyAdmin ? 'Права админа сняты' : 'Выданы права администратора');
      load(search);
    } catch (err: any) {
      notify.error(err.message ?? 'Ошибка');
    }
  };

  const toggleUpload = async (id: number, canUploadNow: boolean) => {
    try {
      await api.adminUpdateRole(id, { can_upload: !canUploadNow });
      notify.success(canUploadNow ? 'Права на загрузку сняты' : 'Права на загрузку выданы');
      load(search);
    } catch (err: any) {
      notify.error(err.message ?? 'Ошибка');
    }
  };

  const deleteAnime = async (id: number, title: string) => {
    if (!confirm(`Удалить "${title}"? Все сезоны и серии будут удалены безвозвратно.`)) return;
    try {
      await api.adminDeleteAnime(id);
      notify.success('Аниме удалено');
      load(search);
    } catch (err: any) {
      notify.error(err.message ?? 'Ошибка');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 animate-fade-in">
      {/* Шапка */}
      <div className="bg-black rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 text-white mb-4 sm:mb-6">
        <div className="flex items-center gap-3 mb-2">
          <ShieldIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          <h1 className="text-display text-2xl sm:text-3xl">Панель администратора</h1>
        </div>
        <p className="text-zinc-400 text-xs sm:text-sm">Управление пользователями и контентом</p>

        {/* Быстрые действия */}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link to="/upload" className="flex items-center gap-3 bg-white/10 hover:bg-white/15 rounded-xl p-3 transition">
            <UploadIcon className="w-5 h-5" />
            <div>
              <div className="font-semibold text-sm">Загрузить аниме</div>
              <div className="text-xs text-zinc-400">Новый тайтл, серия или фильм</div>
            </div>
          </Link>
          <Link to={`/user/${user.id}`} className="flex items-center gap-3 bg-white/10 hover:bg-white/15 rounded-xl p-3 transition">
            <UserIcon className="w-5 h-5" />
            <div>
              <div className="font-semibold text-sm">Мой профиль</div>
              <div className="text-xs text-zinc-400">ID #{user.id} · {user.username}</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-2 mb-3 sm:mb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
            activeTab === 'users' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 border border-zinc-200'
          }`}
        >
          Пользователи ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
            activeTab === 'content' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 border border-zinc-200'
          }`}
        >
          Контент ({animeList.length})
        </button>
      </div>

      {/* ПОЛЬЗОВАТЕЛИ */}
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
                <Link to={`/user/${u.id}`} className="shrink-0">
                  <UserAvatar user={u} size="md" />
                </Link>
                <Link to={`/user/${u.id}`} className="flex-1 min-w-0">
                  <div className="font-semibold text-xs sm:text-sm text-zinc-900 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {u.username}
                    {isAdmin(u) && (
                      <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-semibold uppercase inline-flex items-center gap-1">
                        <ShieldIcon className="w-2.5 h-2.5" /> Admin
                      </span>
                    )}
                    {canUpload(u) && !isAdmin(u) && (
                      <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold uppercase">Автор</span>
                    )}
                  </div>
                  <div className="text-[11px] sm:text-xs text-zinc-500">ID #{u.id} · {new Date(u.created_at).toLocaleDateString('ru-RU')}</div>
                </Link>
                <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
                  {u.id !== user.id && (
                    <>
                      <button
                        onClick={() => toggleUpload(u.id, canUpload(u))}
                        className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold transition ${
                          canUpload(u) ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {canUpload(u) ? (
                          <span className="inline-flex items-center gap-1"><CheckIcon className="w-3 h-3" /> Автор</span>
                        ) : (
                          '+ Загрузка'
                        )}
                      </button>
                      <button
                        onClick={() => toggleAdmin(u.id, isAdmin(u))}
                        className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold transition ${
                          isAdmin(u) ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {isAdmin(u) ? (
                          <span className="inline-flex items-center gap-1"><CheckIcon className="w-3 h-3" /> Admin</span>
                        ) : (
                          '+ Админ'
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* КОНТЕНТ */}
      {activeTab === 'content' && (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {animeList.length === 0 ? (
              <p className="text-center py-8 sm:py-10 text-xs sm:text-sm text-zinc-500">Контента нет</p>
            ) : animeList.map(a => (
              <div key={a.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3">
                <Link to={`/anime/${a.id}`} className="flex-1 min-w-0">
                  <div className="font-semibold text-xs sm:text-sm text-zinc-900 truncate hover:underline">{a.title}</div>
                  <div className="text-[11px] sm:text-xs text-zinc-500">
                    {a.type === 'season' ? `Сезонное · ${a.seasons_count} сез. / ${a.episodes_count} сер.` : 'Одиночное'} · {a.author || 'Система'}
                  </div>
                </Link>
                <button
                  onClick={() => deleteAnime(a.id, a.title)}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition"
                >
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

