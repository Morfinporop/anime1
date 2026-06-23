import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Episode } from '../types';
import { VideoPlayer } from '../components/VideoPlayer';
import { ArrowLeftIcon } from '../components/icons';

export default function WatchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const episodeId = parseInt(id ?? '0');

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [animeTitle, setAnimeTitle] = useState('');
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getEpisode(episodeId).then(async ep => {
      if (!ep) { setLoading(false); return; }
      setEpisode(ep);
      setSeasonNumber(1);
      const anime = await api.getAnime(ep.anime_id);
      setAnimeTitle(anime?.title ?? '');
      const seasons = await api.getSeasons(ep.anime_id);
      const curSeason = seasons.find(s => s.id === ep.season_id);
      if (curSeason) setSeasonNumber(curSeason.season_number);
      const all: Episode[] = [];
      for (const s of seasons) {
        const eps = await api.getSeasonEpisodes(s.id);
        all.push(...eps);
      }
      setAllEpisodes(all);
      api.recordView(episodeId).catch(() => {});
      if (user) api.addHistory(episodeId).catch(() => {});
      setLoading(false);
      window.scrollTo({ top: 0 });
    });
  }, [episodeId, user]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
        <h1 className="text-display text-2xl text-zinc-900">Серия не найдена</h1>
        <Link to="/" className="mt-4 inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900">
          <ArrowLeftIcon className="h-4 w-4" /> На главную
        </Link>
      </div>
    );
  }

  const seasonEpisodes = allEpisodes.filter(e => e.season_id === episode.season_id);
  const currentIdx = seasonEpisodes.findIndex(e => e.id === episode.id);
  const prevEp = currentIdx > 0 ? seasonEpisodes[currentIdx - 1] : null;
  const nextEp = currentIdx < seasonEpisodes.length - 1 ? seasonEpisodes[currentIdx + 1] : null;

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-[1400px] px-2 sm:px-4 md:px-6 lg:px-8">
        <nav className="flex items-center gap-1.5 py-2 sm:py-3 text-xs sm:text-sm">
          <Link to={`/anime/${episode.anime_id}`} className="hover:text-zinc-900 line-clamp-1">{animeTitle}</Link>
          <span>›</span>
          <span className="hidden sm:inline">Сезон {seasonNumber}</span>
          <span className="hidden sm:inline">›</span>
          <span className="text-zinc-900">Серия {episode.episode_number}</span>
        </nav>

        <VideoPlayer episode={episode} />

        <div className="mt-3 sm:mt-5 px-1 sm:px-0">
          <h1 className="text-display text-xl xs:text-2xl sm:text-3xl text-zinc-900">
            {animeTitle} {episode.season_id ? `— Серия ${episode.episode_number}` : ''}
          </h1>
          {episode.title && <p className="mt-1 text-sm text-zinc-600">{episode.title}</p>}
          <div className="mt-2 sm:mt-3 flex items-center gap-3 sm:gap-4 text-xs text-zinc-500">
            <span>{episode.views_count} просмотров</span>
          </div>
        </div>

        <div className="mt-3 sm:mt-5 flex justify-between gap-2 sm:gap-3">
          <button disabled={!prevEp} onClick={() => prevEp && navigate(`/watch/${prevEp.id}`)}
            className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-full border border-zinc-200 bg-white text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
            ← <span className="hidden sm:inline">Предыдущая</span>
          </button>
          <button disabled={!nextEp} onClick={() => nextEp && navigate(`/watch/${nextEp.id}`)}
            className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-full bg-black text-white text-xs sm:text-sm font-medium hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition">
            <span className="hidden sm:inline">Следующая </span>→
          </button>
        </div>

        {/* Сайдбар — все серии */}
        <div className="mt-5 sm:mt-8 bg-white rounded-xl sm:rounded-2xl border border-zinc-200 p-3 sm:p-4">
          <h3 className="font-semibold text-zinc-900 mb-3 px-1 sm:px-2 text-sm sm:text-base">Все серии</h3>
          <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2">
            {allEpisodes.map(ep => {
              const active = ep.id === episode.id;
              return (
                <button key={ep.id} onClick={() => navigate(`/watch/${ep.id}`)}
                  className={`flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-lg transition text-center ${
                    active ? 'bg-zinc-900 text-white' : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-900'
                  }`}>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-bold mb-0.5 sm:mb-1 ${
                    active ? 'bg-white/15' : 'bg-white'
                  }`}>
                    {ep.episode_number}
                  </div>
                  <div className="text-[9px] sm:text-[10px] truncate w-full">{ep.title || `Серия ${ep.episode_number}`}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}