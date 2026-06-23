import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { UserIcon } from '../components/icons';

export default function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const isAdmin = user.role === 'admin';

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-12 animate-fade-in">
      <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-2xl shrink-0">
            {user.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-display text-3xl text-zinc-900 sm:text-4xl">{user.username}</h1>
            <div className="mt-2 flex items-center gap-3 text-zinc-500 text-sm">
              <span className="flex items-center gap-1.5">
                <UserIcon className="w-4 h-4" />
                ID: <span className="font-bold text-zinc-900">#{user.id}</span>
              </span>
              <span>·</span>
              <span>С нами с {new Date(user.created_at).toLocaleDateString('ru-RU')}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-200 p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Роль</div>
            <div className="mt-1 text-lg font-semibold text-zinc-900">{isAdmin ? 'Администратор' : 'Пользователь'}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Права на загрузку</div>
            <div className="mt-1 text-lg font-semibold text-zinc-900">{isAdmin || user.can_upload ? 'Разрешено' : 'Не выданы'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}