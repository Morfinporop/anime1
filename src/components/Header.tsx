import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { api } from '../api';
import type { Anime } from '../types';
import { SearchIcon, UserIcon, UploadIcon, LogoutIcon, MenuIcon, CloseIcon } from './icons';
import { bannerUrl, FALLBACK_BANNER } from '../hooks';
import { UserAvatar } from './UserAvatar';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    api.searchAnime(q).then(r => setResults(r.slice(0, 6))).catch(() => {});
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => { setMobileMenuOpen(false); }, [navigate]);

  useEffect(() => {
    if (mobileMenuOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const goSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    setShowResults(false);
    setMobileMenuOpen(false);
  };

  const canUpload = user && (user.is_admin || user.isAdmin || user.can_upload || user.canUpload);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 h-14 flex items-center gap-2 sm:gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/images/logov.png" alt="AnimeWorld" className="w-8 h-8 rounded-lg shadow-sm"
              onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_BANNER; }} />
            <span className="font-bold text-base text-zinc-900 hidden sm:block">AnimeWorld</span>
          </Link>

          <div ref={searchRef} className="flex-1 min-w-0 max-w-2xl mx-auto">
            <form onSubmit={goSearch} className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => { setQ(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                placeholder="Поиск..."
                className="w-full pl-9 pr-3 sm:pl-10 sm:pr-4 py-2 rounded-full bg-zinc-100 border border-transparent focus:bg-white focus:border-zinc-300 focus:outline-none placeholder:text-zinc-400 text-sm transition"
              />
            </form>
            {showResults && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden z-50">
                {results.map(a => (
                  <button key={a.id} onClick={() => { navigate(`/anime/${a.id}`); setQ(''); setShowResults(false); }}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-zinc-50 text-left">
                    <img src={bannerUrl(a.id)} alt="" className="w-12 h-8 object-cover rounded shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_BANNER; }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-zinc-900 truncate">{a.title}</div>
                      <div className="text-xs text-zinc-500">{a.year}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Десктоп */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {user && (user.is_admin || user.isAdmin) ? (
              <Link to="/admin" className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-yellow-500 text-black text-sm font-medium hover:bg-yellow-400 transition">
                <UploadIcon className="w-4 h-4" /> Админ меню
              </Link>
            ) : canUpload && (
              <Link to="/upload" className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black text-white text-sm font-medium hover:bg-zinc-800 transition">
                <UploadIcon className="w-4 h-4" /> Загрузить
              </Link>
            )}
            {user ? (
              <div ref={profileRef} className="relative">
                <button onClick={() => setProfileOpen(v => !v)}
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-zinc-100 transition">
                  <UserAvatar user={user} size="sm" />
                  <span className="text-sm font-medium">{user.username}</span>
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden z-50">
                    <div className="p-4 border-b border-zinc-100 flex items-center gap-3">
                      <UserAvatar user={user} size="md" />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-zinc-900 truncate">{user.username}</div>
                        <div className="text-xs text-zinc-500">ID #{user.id}</div>
                      </div>
                    </div>
                    <Link to={`/user/${user.id}`} onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-3 hover:bg-zinc-50 text-sm">
                      <UserIcon className="w-4 h-4 text-zinc-500" /> Мой профиль
                    </Link>
                    {user.is_admin ? (
                      <Link to="/admin" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-3 hover:bg-zinc-50 text-sm border-t border-zinc-100">
                        <UploadIcon className="w-4 h-4 text-zinc-500" /> Админ меню
                      </Link>
                    ) : canUpload && (
                      <Link to="/upload" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-3 hover:bg-zinc-50 text-sm border-t border-zinc-100">
                        <UploadIcon className="w-4 h-4 text-zinc-500" /> Загрузить аниме
                      </Link>
                    )}
                    <button onClick={() => { logout(); setProfileOpen(false); navigate('/'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-zinc-50 text-sm border-t border-zinc-100 text-red-600">
                      <LogoutIcon className="w-4 h-4" /> Выйти
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/auth" className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-black text-white text-sm font-medium hover:bg-zinc-800 transition">
                <UserIcon className="w-4 h-4" /> Войти
              </Link>
            )}
          </div>

          {/* Мобильный */}
          <div className="flex md:hidden items-center gap-1 shrink-0">
            {canUpload && (
              <Link to="/upload" className="p-2 rounded-full hover:bg-zinc-100 transition" aria-label="Загрузить">
                <UploadIcon className="w-5 h-5 text-zinc-700" />
              </Link>
            )}
            {user && <UserAvatar user={user} size="sm" variant="filled" showLink />}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-full hover:bg-zinc-100 transition"
              aria-label="Меню"
            >
              <MenuIcon className="w-5 h-5 text-zinc-700" />
            </button>
          </div>
        </div>
      </header>

      {/* Мобильное меню */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-white animate-fade-in">
          <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <img src="/images/logov.png" alt="AnimeWorld" className="w-8 h-8 rounded-lg"
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_BANNER; }} />
              <span className="font-bold text-base text-zinc-900">AnimeWorld</span>
            </div>
            <button onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-full hover:bg-zinc-100 transition" aria-label="Закрыть">
              <CloseIcon className="w-5 h-5 text-zinc-700" />
            </button>
          </div>

          <div className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-3.5rem)]">
            {!user && (
              <Link to="/auth" onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black text-white font-semibold">
                <UserIcon className="w-4 h-4" /> Войти
              </Link>
            )}

            {user && (
              <Link to={`/user/${user.id}`} onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200">
                <UserAvatar user={user} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-zinc-900 truncate">{user.username}</div>
                  <div className="text-xs text-zinc-500">ID #{user.id} · {user.is_admin ? 'Администратор' : 'Пользователь'}</div>
                </div>
              </Link>
            )}

            <div className="pt-2">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-3 mb-1">Меню</div>
              <Link to="/" onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 text-sm text-zinc-900">
                Главная
              </Link>
              {canUpload && (
                <Link to="/upload" onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 text-sm text-zinc-900">
                  <UploadIcon className="w-4 h-4 text-zinc-500" /> Загрузить аниме
                </Link>
              )}
              {user && (user.is_admin || user.isAdmin) && (
                <Link to="/admin" onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-100 text-sm text-zinc-900">
                  Панель администратора
                </Link>
              )}
            </div>

            {user && (
              <div className="pt-2">
                <button onClick={() => { logout(); setMobileMenuOpen(false); navigate('/'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 text-sm text-red-600">
                  <LogoutIcon className="w-4 h-4" /> Выйти
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}