import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Anime, User } from '../types';
import { useAuth } from '../auth';
import VideoCard from '../components/VideoCard';
import { ShieldIcon, StarIcon } from '../components/icons';

export default function UserPage() {
  const { id } = useParams();
  const userId = parseInt(id ?? '0');
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [uploads, setUploads] = useState<Anime[]>([]);
  const [favorites, setFavorites] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'uploads' | 'favorites'>('uploads');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getUser(userId),
      api.getUserAnime(userId),
      api.getUserFavorites(userId),
    ]).then(([u, up, fav]) => {
      setUser(u);
      setUploads(up);
      setFavorites(fav);
      if (up.length === 0 && fav.length > 0) setTab('favorites');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
        <h1 className="text-display text-2xl text-zinc-900">Пользователь не найден</h1>
      </div>
    );
  }

  const isMe = currentUser?.id === user.id;
  const items = tab === 'uploads' ? uploads : favorites;
  const hasUploads = uploads.length > 0;
  const hasFavorites = favorites.length > 0;

  return (
    <div className="mx-auto max-w-[1400px] px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 animate-fade-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200 p-4 sm:p-6 md:p-8">
        <div className="flex items-start gap-3 sm:gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white font-bold text-xl sm:text-2xl shrink-0"
            style={{ backgroundColor: user.avatar_color }}>
            {user.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-display text-2xl sm:text-3xl md:text-4xl text-zinc-900 flex items-center gap-2 flex-wrap">
              {user.username}
              {user.is_admin && (
                <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-yellow-100 text-yellow-800 text-[10px] sm:text-xs font-bold">
                  <ShieldIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Администратор
                </span>
              )}
            </h1>
            <div className="mt-1 sm:mt-2 text-zinc-500 text-xs sm:text-sm">
              ID #{user.id} · с нами с {new Date(user.created_at).toLocaleDateString('ru-RU')}
            </div>
          </div>
          {!isMe && currentUser && (
            <button onClick={() => navigate('/auth')}
              className="text-xs text-zinc-500 hover:text-zinc-900 hidden sm:block">
              Не вы
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 sm:mt-6 bg-white rounded-xl sm:rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="flex border-b border-zinc-200">
          <button onClick={() => setTab('uploads')}
            className={`flex-1 px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition ${
              tab === 'uploads' ? 'bg-white text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
            }`}>
            <span className="hidden xs:inline">Загруженные </span>{hasUploads && `(${uploads.length})`}
          </button>
          <button onClick={() => setTab('favorites')}
            className={`flex-1 px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition ${
              tab === 'favorites' ? 'bg-white text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
            }`}>
            Избранное {hasFavorites && `(${favorites.length})`}
          </button>
        </div>

        <div className="p-3 sm:p-5">
          {items.length === 0 ? (
            <div className="text-center py-10 sm:py-12">
              <StarIcon className="mx-auto mb-3 h-8 w-8 sm:h-10 sm:w-10 text-zinc-300" />
              <p className="text-xs sm:text-sm text-zinc-500">
                {tab === 'uploads' ? 'Пользователь пока ничего не загрузил' : 'Нет избранного'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {items.map(a => <VideoCard key={a.id} anime={a} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}