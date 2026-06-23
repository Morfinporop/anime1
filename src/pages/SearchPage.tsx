import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import VideoCard from '../components/VideoCard';
import type { Anime } from '../types';
import { SearchIcon } from '../components/icons';

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim()) {
      setLoading(true);
      api.searchAnime(q).then(r => {
        setResults(r);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setResults([]);
    }
  }, [q]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-12 animate-fade-in">
      <div className="mb-4 sm:mb-6 animate-slide-up">
        <h1 className="text-display text-2xl sm:text-3xl md:text-5xl text-zinc-900">
          {q ? 'Результаты поиска' : 'Поиск'}
        </h1>
        {q && <p className="mt-1 text-xs sm:text-sm text-zinc-500">По запросу <strong className="text-zinc-900">«{q}»</strong> найдено {results.length}</p>}
      </div>

      {loading ? (
        <div className="flex justify-center py-12 sm:py-16">
          <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-zinc-300 border-t-zinc-900" />
        </div>
      ) : !q ? (
        <div className="rounded-2xl sm:rounded-3xl border border-dashed border-zinc-200 py-12 sm:py-16 text-center">
          <SearchIcon className="mx-auto mb-3 h-8 w-8 sm:h-10 sm:w-10 text-zinc-300" />
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900">Введите запрос</h2>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl sm:rounded-3xl border border-dashed border-zinc-200 py-12 sm:py-16 text-center">
          <SearchIcon className="mx-auto mb-3 h-8 w-8 sm:h-10 sm:w-10 text-zinc-300" />
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900">Ничего не найдено</h2>
        </div>
      ) : (
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {results.map((v, i) => (
            <div key={v.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 15, 150)}ms` }}>
              <VideoCard anime={v} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}