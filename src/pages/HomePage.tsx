import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import VideoCard from '../components/VideoCard';
import { api } from '../api';
import type { Anime, SortType } from '../types';
import { FilterIcon, GridIcon, ListIcon } from '../components/icons';
import { bannerUrl, FALLBACK_BANNER } from '../hooks';

const PAGE_SIZE = 24;
type View = 'grid' | 'list';

// Hero banner - будет динамически загружаться из первого аниме
const HERO_BG = null;

export default function HomePage() {
  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<SortType>('popular');
  const [genre, setGenre] = useState<string>('all');
  const [view, setView] = useState<View>('grid');
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Hero banner - берём из первого популярного аниме
  const heroAnime = items[0];
  const heroBanner = heroAnime ? bannerUrl(heroAnime.id, heroAnime.banner, heroAnime.poster) : FALLBACK_BANNER;

  useEffect(() => {
    setLoading(true);
    api.listAnime(sort, genre).then(items => {
      setItems(items.filter(a => a.views_count >= 0));
      setDisplayCount(PAGE_SIZE);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [sort, genre]);

  const allGenres = useMemo(() => {
    const s = new Set<string>();
    items.forEach((a: Anime) => a.genres.forEach((g: string) => s.add(g)));
    return ['all', ...Array.from(s).sort()];
  }, [items]);

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
      {/* HERO — динамический баннер из первого аниме */}
      <section className="relative overflow-hidden border-b border-zinc-200">
        <div className="absolute inset-0">
          <img
            src={heroBanner}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_BANNER; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pt-6 pb-6 sm:pt-10 sm:pb-8">
          <div className="max-w-3xl animate-slide-up">
            <h1 className="text-display text-4xl sm:text-5xl lg:text-6xl leading-[1]">
              <span className="text-white drop-shadow-lg">Аниме.</span>
              <br />
              <span className="text-white drop-shadow-lg">Одно место.</span>
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/80 drop-shadow sm:text-base">
              Сотни тайтлов в высоком качестве с разными озвучками и продвинутым плеером.
            </p>
          </div>
        </div>
      </section>

      {/* Блок популярного */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-display text-xl sm:text-2xl font-bold text-zinc-900">🔥 Популярное сейчас</h2>
          <Link to="/?sort=popular" className="text-sm text-zinc-600 hover:text-zinc-900">
            Все популярные →
          </Link>
        </div>
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
            {items.slice(0, 6).map((anime, i) => (
              <div key={anime.id} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <VideoCard anime={anime} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* КАТАЛОГ */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-10 sm:pb-12 md:pb-16">
        <div className="sticky top-14 z-20 mb-4 sm:mb-5 -mx-4 sm:-mx-6 lg:-mx-8 border-b border-zinc-200 bg-white/95 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <FilterIcon className="h-4 w-4 text-zinc-400 shrink-0" />
            <select value={genre} onChange={(e) => setGenre(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3 sm:px-3.5 py-1.5 text-xs font-medium text-zinc-700 outline-none hover:bg-zinc-50 cursor-pointer max-w-[140px] sm:max-w-none">
              {allGenres.map(g => <option key={g} value={g}>{g === 'all' ? 'Все жанры' : g}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortType)}
              className="rounded-full border border-zinc-200 bg-white px-3 sm:px-3.5 py-1.5 text-xs font-medium text-zinc-700 outline-none hover:bg-zinc-50 cursor-pointer max-w-[140px] sm:max-w-none">
              <option value="popular">По популярности</option>
              <option value="newest">Сначала новые</option>
              <option value="rating">По рейтингу</option>
              <option value="title">По алфавиту</option>
            </select>
            <div className="flex-1 hidden sm:block" />
            <span className="text-xs text-zinc-500 hidden xs:inline">{items.length} {pluralize(items.length, ['тайтл', 'тайтла', 'тайтлов'])}</span>
            <div className="flex gap-1 rounded-full border border-zinc-200 bg-white p-1 ml-auto sm:ml-0">
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
          <CenterSpinner />
        ) : items.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl border border-dashed border-zinc-200 bg-white p-8 sm:p-12 md:p-16 text-center">
            <h2 className="text-display text-2xl sm:text-3xl md:text-4xl text-zinc-900">Каталог пуст</h2>
          </div>
        ) : view === 'grid' ? (
          <>
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5 md:gap-6">
              {displayed.map((v, i) => (
                <div key={v.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 15, 150)}ms` }}>
                  <VideoCard anime={v} />
                </div>
              ))}
            </div>
            <div ref={sentinelRef} className="h-12 sm:h-16" />
            {displayCount >= items.length && items.length > PAGE_SIZE && (
              <div className="py-6 text-center text-xs text-zinc-400">— Конец каталога —</div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            {displayed.map((v) => <VideoRow key={v.id} anime={v} />)}
            <div ref={sentinelRef} className="h-12 sm:h-16" />
          </div>
        )}
      </section>
    </div>
  );
}

function CenterSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-20">
      <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-zinc-300 border-t-zinc-900" />
    </div>
  );
}

function VideoRow({ anime }: { anime: Anime }) {
  return (
    <Link to={`/anime/${anime.id}`} className="group flex items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border border-zinc-200 bg-white p-3 sm:p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-20 w-14 xs:h-24 xs:w-16 sm:h-28 sm:w-20 flex-shrink-0 overflow-hidden rounded-lg">
        <img src={bannerUrl(anime.id, anime.banner, anime.poster)} alt={anime.title} loading="lazy" className="h-full w-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_BANNER; }} />
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900 group-hover:underline">{anime.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 xs:gap-2 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-900">★ {(anime.rating ?? 0).toFixed(1) || '—'}</span>
          <span className="hidden xs:inline">·</span>
          <span className="hidden xs:inline">{anime.year}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-zinc-500 hidden sm:block">{anime.description}</p>
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

