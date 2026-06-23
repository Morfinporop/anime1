import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Anime, User } from '../types';
import { useAuth } from '../auth';
import VideoCard from '../components/VideoCard';
import { UserAvatar } from '../components/UserAvatar';
import { ShieldIcon } from '../components/icons';

export default function UserPage() {
  const { id } = useParams();
  const userId = parseInt(id ?? '0');
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getUser(userId),
      api.getUserFavorites(userId),
    ]).then(([u, fav]) => {
      setUser(u);
      setFavorites(fav);
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

  return (
    <div className="mx-auto max-w-[1400px] px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 animate-fade-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200 p-4 sm:p-6 md:p-8">
        <div className="flex items-start gap-3 sm:gap-5">
          <UserAvatar user={user} size="xl" />
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
        <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-zinc-100">
          <h3 className="font-semibold text-zinc-900 text-sm sm:text-base">
            Избранное {favorites.length > 0 && `(${favorites.length})`}
          </h3>
        </div>

        <div className="p-3 sm:p-5">
          {favorites.length === 0 ? (
            <div className="text-center py-10 sm:py-12">
              <p className="text-xs sm:text-sm text-zinc-500">Пока пусто</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {favorites.map(a => <VideoCard key={a.id} anime={a} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}