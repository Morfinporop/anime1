import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { store } from '../store';
import type { Anime, SortType } from '../types';
import VideoCard from '../components/VideoCard';
import { FilterIcon, GridIcon, ListIcon, ArrowLeftIcon } from '../components/icons';

type View = 'grid' | 'list';

export default function SeasonPage() {
  const { season } = useParams<{ season: string }>();
  // Поддержка URL /season/1, /season/2 — для будущего расширения
  void season;

  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [genre, setGenre] = useState('all');
  const [sort, setSort] = useState<SortType>('popular');
  const [view, setView] = useState<View>('grid');

  useEffect(() => {
    setLoading(true);
    const all = store.listAnime(sort, genre).filter(a => a.type === 'season');
    setItems(all);
    setLoading(false);
  }, [sort, genre]);

  const allGenres = useMemo(() => {
    const s = new Set<string>();
    items.forEach(a => a.genres.forEach(g => s.add(g)));
    return ['all', ...Array.from(s).sort()];
  }, [items]);

  return (
    <div className="animate-fade-in">
      <section className="relative overflow-hidden bg-white">
        <div className="relative mx-auto max-w-[1400px] px-5 pt-6 pb-6 sm:px-8 sm:pt-10 sm:pb-8">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" /> На главную
          </Link>
          <div className="mt-5 max-w-4xl animate-slide-up">
            <h1 className="text-display text-5xl text-zinc-900 sm:text-7xl lg:text-[6rem]">Аниме</h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-500 sm:text-base">
              Японская анимация в высоком качестве с разными озвучками и продвинутым плеером.
            </p>
          </div>
        </div>
      </section>

      <div className="sticky top-14 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-5 py-3 sm:px-8">
          <FilterIcon className="h-4 w-4 text-zinc-400" />
          <select value={genre} onChange={(e) => setGenre(e.target.value)} className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 outline-none hover:bg-zinc-50 cursor-pointer">
            {allGenres.map(g => <option key={g} value={g}>{g === 'all' ? 'Все жанры' : g}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortType)} className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 outline-none hover:bg-zinc-50 cursor-pointer">
            <option value="popular">По популярности</option>
            <option value="newest">Сначала новые</option>
            <option value="rating">По рейтингу</option>
            <option value="title">По алфавиту</option>
          </select>
          <div className="flex-1" />
          <span className="text-xs text-zinc-500">{items.length} {pluralize(items.length, ['тайтл', 'тайтла', 'тайтлов'])}</span>
          <div className="flex gap-1 rounded-full border border-zinc-200 bg-white p-1">
            <button onClick={() => setView('grid')} className={`flex h-7 w-7 items-center justify-center rounded-full transition ${view === 'grid' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`} aria-label="Сетка">
              <GridIcon className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView('list')} className={`flex h-7 w-7 items-center justify-center rounded-full transition ${view === 'list' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`} aria-label="Список">
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-zinc-300 border-t-zinc-900" />
            <p className="mt-3 text-sm text-zinc-500">Загрузка каталога...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 py-16 text-center">
            <h3 className="text-xl font-bold text-zinc-900">Пока ничего нет</h3>
            <p className="mt-2 text-sm text-zinc-500">Загрузите первое аниме — оно появится здесь для всех.</p>
            <Link to="/upload" className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:scale-105">
              Загрузить аниме
            </Link>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((v, i) => (
              <div key={v.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 15, 150)}ms` }}>
                <VideoCard anime={v} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(v => <VideoRow key={v.id} anime={v} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function VideoRow({ anime }: { anime: Anime }) {
  return (
    <Link to={`/anime/${anime.id}`} className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-20">
        <img src={anime.banner} alt={anime.title} loading="lazy" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900 group-hover:underline">{anime.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-900">★ {store.avgRating(anime.id).toFixed(1) || '—'}</span>
          <span>·</span>
          <span>{anime.year}</span>
          <span>·</span>
          <span className="truncate">{anime.genres.slice(0, 2).join(', ')}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{anime.description}</p>
      </div>
    </Link>
  );
}

function pluralize(n: number, forms: [string, string, string]) {
  const n100 = n % 100;
  const n10 = n % 10;
  if (n100 >= 11 && n100 <= 14) return forms[2];
  if (n10 === 1) return forms[0];
  if (n10 >= 2 && n10 <= 4) return forms[1];
  return forms[2];
}