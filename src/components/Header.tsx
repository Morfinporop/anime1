import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { store } from '../store';
import type { Anime } from '../types';
import { SearchIcon, UserIcon, UploadIcon, LogoutIcon } from './icons';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    setResults(store.search(q).slice(0, 6));
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const goSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    setShowResults(false);
  };

  const canUpload = user && (user.role === 'admin' || user.can_upload);

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-zinc-200">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-bold text-base text-zinc-900 hidden sm:block">AnimeWorld</span>
        </Link>

        <div ref={searchRef} className="flex-1 max-w-2xl mx-auto">
          <form onSubmit={goSearch} className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => { setQ(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              placeholder="Поиск аниме..."
              className="w-full pl-10 pr-4 py-2 rounded-full bg-zinc-100 border border-transparent focus:bg-white focus:border-zinc-300 focus:outline-none placeholder:text-zinc-400 text-sm transition"
            />
          </form>
          {showResults && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden z-50">
              {results.map(a => (
                <button key={a.id} onClick={() => { navigate(`/anime/${a.id}`); setQ(''); setShowResults(false); }}
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-zinc-50 text-left">
                  <img src={a.banner} alt="" className="w-12 h-8 object-cover rounded shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-zinc-900 truncate">{a.title}</div>
                    <div className="text-xs text-zinc-500">{a.year} · {a.genres.slice(0, 2).join(', ')}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canUpload && (
            <Link to="/upload" className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black text-white text-sm font-medium hover:bg-zinc-800 transition">
              <UploadIcon className="w-4 h-4" />
              Загрузить
            </Link>
          )}

          {user ? (
            <div ref={profileRef} className="relative">
              <button onClick={() => setProfileOpen(v => !v)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-zinc-100 transition">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-xs">
                  {user.username[0]?.toUpperCase()}
                </div>
                <span className="hidden sm:block text-sm font-medium">{user.username}</span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden z-50">
                  <div className="p-4 border-b border-zinc-100">
                    <div className="font-semibold text-sm text-zinc-900 truncate">{user.username}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">ID #{user.id} · {user.role === 'admin' ? 'Администратор' : 'Пользователь'}</div>
                  </div>
                  <Link to="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-3 hover:bg-zinc-50 text-sm">
                    <UserIcon className="w-4 h-4 text-zinc-500" /> Профиль
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-3 hover:bg-zinc-50 text-sm border-t border-zinc-100">
                      <UploadIcon className="w-4 h-4 text-zinc-500" /> Панель администратора
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
              <UserIcon className="w-4 h-4" />
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}