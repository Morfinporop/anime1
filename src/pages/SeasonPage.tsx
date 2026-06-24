import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Anime, Season } from '../types';
import { getAnimeBannerUrl, FALLBACK_BANNER } from '../hooks';

export default function SeasonPage() {
  const { season } = useParams<{ season: string }>();
  const [params] = useSearchParams();
  const animeIdParam = params.get('anime');
  const seasonNum = parseInt(season ?? '1');
  const animeId = animeIdParam ? parseInt(animeIdParam) : 0;

  const [anime, setAnime] = useState<Anime | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!animeId) { setLoading(false); return; }
    Promise.all([api.getAnime(animeId), api.getSeasons(animeId)]).then(async ([a, ss]) => {
      setAnime(a);
      setSeasons(ss);
      const targetSeason = ss.find(s => s.season_number === seasonNum) || ss[0];
      if (targetSeason) {
        const eps = await api.getSeasonEpisodes(targetSeason.id);
        setEpisodes(eps);
      }
      setLoading(false);
      window.scrollTo({ top: 0 });
    });
  }, [animeId, seasonNum]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="text-display text-2xl text-zinc-900">Аниме не найдено</h1>
        <Link to="/" className="mt-4 inline-flex text-sm text-sakura-600 hover:underline">На главную</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <section className="relative">
        <div className="relative h-48 sm:h-64">
          <img src={getAnimeBannerUrl(anime.id)} alt="" className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_BANNER; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent" />
        </div>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 -mt-20 sm:-mt-32 relative">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 border border-zinc-200">
            <Link to={`/anime/${anime.id}`} className="text-xs sm:text-sm text-zinc-500 hover:text-zinc-900 inline-block mb-1">
              ← {anime.title}
            </Link>
            <h1 className="text-display text-2xl sm:text-3xl md:text-5xl">Сезон {seasonNum}</h1>
            <p className="mt-2 text-xs sm:text-sm text-zinc-500">{episodes.length} серий</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
        {seasons.length > 1 && (
          <div className="mb-4 sm:mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-zinc-700 mr-1">Сезоны:</span>
            {seasons.map(s => (
              <Link key={s.id} to={`/season/${s.season_number}?anime=${anime.id}`}
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition ${
                  s.season_number === seasonNum ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}>
                Сезон {s.season_number}
              </Link>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl sm:rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-zinc-100">
            <h2 className="font-semibold text-zinc-900 text-sm sm:text-base">Серии</h2>
          </div>
          {episodes.length === 0 ? (
            <div className="px-4 py-10 sm:py-12 text-center text-xs sm:text-sm text-zinc-500">
              Серий пока нет
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {episodes.map(ep => (
                <Link key={ep.id} to={`/watch/${ep.id}`}
                  className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-2.5 sm:py-3 hover:bg-zinc-50 transition">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0">
                    {ep.episode_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs sm:text-sm text-zinc-900">Серия {ep.episode_number} · {ep.title}</div>
                    <div className="text-xs text-zinc-500 line-clamp-1 mt-0.5 hidden xs:block">{ep.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}