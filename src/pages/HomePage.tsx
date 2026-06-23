import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import VideoCard from '../components/VideoCard';
import { store } from '../store';
import type { Anime, SortType } from '../types';
import { FilterIcon, GridIcon, ListIcon } from '../components/icons';

const PAGE_SIZE = 24;
type View = 'grid' | 'list';

export default function HomePage() {
  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<SortType>('popular');
  const [genre, setGenre] = useState<string>('all');
  const [view, setView] = useState<View>('grid');
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setItems(store.listAnime(sort, genre));
    setDisplayCount(PAGE_SIZE);
    setLoading(false);
  }, [sort, genre]);

  const allGenres = useMemo(() => {
    const s = new Set<string>();
    store.listAnime('newest', null).forEach(a => a.genres.forEach(g => s.add(g)));
    return ['all', ...Array.from(s).sort()];
  }, [items.length]);

  const totalSeries = useMemo(() => store.listAnime('newest', null).length, [items.length]);
  const totalVideos = useMemo(() => {
    return store.listAnime('newest', null).reduce((acc, a) => acc + store.listEpisodes(a.id).length, 0);
  }, [items.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setTimeout(() => setDisplayCount(c => Math.min(c + PAGE_SIZE, items.length)), 100);
      }
    }, { rootMargin: '300px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [items.length]);

  const displayed = items.slice(0, displayCount);

  return (
    <div className="animate-fade-in">
      {/* HERO с картинкой и текстом сверху */}
      <section className="relative overflow-hidden">
        <img
          src="https://img.magnific.com/free-photo/anime-style-cozy-home-interior-with-furnishings_23-2151176465.jpg?semt=ais_hybrid&w=1400&q=80"
          alt=""
          className="w-full h-[500px] sm:h-[600px] object-cover"
        />
        {/* Затемнение снизу для текста */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/20" />
        <div className="absolute inset-x-0 top-0 px-5 sm:px-8 pt-8 sm:pt-12">
          <h1 className="text-display text-5xl text-white sm:text-7xl lg:text-[6.5rem] leading-[0.95]">
            Аниме
          </h1>
          <p className="mt-3 max-w-xl text-sm sm:text-base text-white/90">
            Сотни тайтлов, тысячи серий в одном месте.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white">
            <span className="rounded-full bg-white/15 backdrop-blur-md px-3 py-1.5 font-semibold text-white border border-white/20">
              {totalSeries} {pluralize(totalSeries, ['тайтл', 'тайтла', 'тайтлов'])}
            </span>
            <span className="rounded-full bg-white/15 backdrop-blur-md px-3 py-1.5 font-medium text-white border border-white/20">
              {totalVideos} {pluralize(totalVideos, ['серия', 'серии', 'серий'])}
            </span>
            <span className="rounded-full bg-white/15 backdrop-blur-md px-3 py-1.5 font-medium text-white border border-white/20">HD · Full HD</span>
          </div>
        </div>
      </section>

      {/* КАТАЛОГ */}
      <section className="mx-auto max-w-[1400px] px-5 pb-12 sm:px-8 sm:pb-16">
        <div className="sticky top-14 z-20 mb-5 -mx-5 border-b border-zinc-200 bg-white/90 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <FilterIcon className="h-4 w-4 text-zinc-400" />
            <select value={genre} onChange={(e) => setGenre(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 outline-none hover:bg-zinc-50 transition cursor-pointer">
              {allGenres.map(g => <option key={g} value={g}>{g === 'all' ? 'Все жанры' : g}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortType)}
              className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 outline-none hover:bg-zinc-50 transition cursor-pointer">
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-zinc-300 border-t-zinc-900" />
            <p className="mt-3 text-sm text-zinc-500">Загрузка каталога...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 bg-white p-10 text-center sm:p-16">
            <h2 className="text-display text-3xl text-zinc-900 sm:text-4xl">Каталог пуст</h2>
            <p className="mt-3 mx-auto max-w-md text-sm text-zinc-500">
              Здесь пока ничего нет — добавьте первый тайтл, чтобы он появился в каталоге.
            </p>
          </div>
        ) : view === 'grid' ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {displayed.map((v, i) => (
                <div key={v.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 15, 150)}ms` }}>
                  <VideoCard anime={v} />
                </div>
              ))}
            </div>
            <div ref={sentinelRef} className="h-16" />
            {displayCount >= items.length && items.length > PAGE_SIZE && (
              <div className="py-6 text-center text-xs text-zinc-400">— Конец каталога —</div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            {displayed.map(v => <VideoRow key={v.id} anime={v} />)}
            <div ref={sentinelRef} className="h-16" />
          </div>
        )}
      </section>
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