import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Episode } from '../types';
import { VideoPlayer } from '../components/VideoPlayer';
import { ArrowLeftIcon, HeartIcon, MessageCircleIcon, ShareIcon } from '../components/icons';

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
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    api.getAnimeById(episodeId).then(async ep => {
      if (!ep) { setLoading(false); return; }
      setEpisode(ep as any);
      setSeasonNumber(1);
      const anime = await api.getAnimeById(ep.id);
      setAnimeTitle(anime?.title ?? '');
      
      // Загружаем эпизоды сезона
      const episodes = await api.getSeasonEpisodes(ep.season_id);
      setAllEpisodes(episodes);
      
      // Записываем просмотр
      api.recordView(episodeId, 0).catch(() => {});
      
      // Загружаем лайки
      try {
        const votes = await api.voteAnime(ep.id, 0);
        setLiked(votes.userVote === 1);
        setLikesCount(votes.likes);
      } catch {}
      
      setLoading(false);
      window.scrollTo({ top: 0 });
    }).catch(() => setLoading(false));
  }, [episodeId, user]);

  const toggleLike = async () => {
    if (!user || !episode) return;
    try {
      const newVote = liked ? 0 : 1;
      const result = await api.voteAnime(episode.id, newVote);
      setLiked(result.userVote === 1);
      setLikesCount(result.likes);
    } catch {}
  };

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

  const seasonEpisodes = allEpisodes;
  const currentIdx = seasonEpisodes.findIndex(e => e.id === episode.id);
  const prevEp = currentIdx > 0 ? seasonEpisodes[currentIdx - 1] : null;
  const nextEp = currentIdx < seasonEpisodes.length - 1 ? seasonEpisodes[currentIdx + 1] : null;

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-[1400px] px-2 sm:px-4 md:px-6 lg:px-8">
        <nav className="flex items-center gap-1.5 py-2 sm:py-3 text-xs sm:text-sm">
          <Link to={`/anime/${episode.id}`} className="hover:text-zinc-900 line-clamp-1">{animeTitle}</Link>
          <span>›</span>
          <span className="text-zinc-900">Серия {episode.episodeNumber || 1}</span>
        </nav>

        <VideoPlayer episode={episode} />

        {/* Кнопки и информация под видеоплеером */}
        <div className="mt-4 sm:mt-5 bg-white rounded-xl sm:rounded-2xl border border-zinc-200 p-3 sm:p-5">
          <h1 className="text-display text-xl xs:text-2xl sm:text-3xl text-zinc-900">
            {animeTitle} — Серия {episode.episodeNumber || 1}
          </h1>
          
          {episode.title && episode.title !== `Эпизод ${episode.episodeNumber}` && (
            <p className="mt-2 text-sm text-zinc-600">{episode.title}</p>
          )}

          {/* Информация о просмотрах и автор */}
          <div className="mt-4 flex items-center gap-4 text-xs sm:text-sm text-zinc-500">
            <span>{episode.viewsCount || 0} просмотров</span>
            <span>·</span>
            <span>Автор: {user?.username || 'AnimeWorld'}</span>
          </div>

          {/* Кнопки действий */}
          <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={toggleLike}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full border transition ${
                liked ? 'border-red-500 bg-red-50 text-red-600' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <HeartIcon filled={liked} className="w-4 h-4" />
              <span>{likesCount} лайков</span>
            </button>

            <Link
              to={`/anime/${episode.id}#comments`}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition"
            >
              <MessageCircleIcon className="w-4 h-4" />
              <span>Комментарии</span>
            </Link>

            <button className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition">
              <ShareIcon className="w-4 h-4" />
              <span>Поделиться</span>
            </button>
          </div>
        </div>

        {/* Навигация по эпизодам */}
        <div className="mt-4 sm:mt-5 flex justify-between gap-2 sm:gap-3">
          <button
            disabled={!prevEp}
            onClick={() => prevEp && navigate(`/watch/${prevEp.id}`)}
            className="flex-1 px-3 sm:px-5 py-3 sm:py-3.5 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <div className="flex items-center gap-2">
              <ArrowLeftIcon className="w-4 h-4" />
              <div className="text-left">
                <div className="text-xs text-zinc-500">Предыдущая</div>
                <div className="font-medium truncate">{prevEp?.title || `Серия ${prevEp?.episodeNumber || ''}`}</div>
              </div>
            </div>
          </button>
          
          <button
            disabled={!nextEp}
            onClick={() => nextEp && navigate(`/watch/${nextEp.id}`)}
            className="flex-1 px-3 sm:px-5 py-3 sm:py-3.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <div className="flex items-center gap-2 justify-end">
              <div className="text-right">
                <div className="text-xs text-white/70">Следующая</div>
                <div className="font-medium truncate">{nextEp?.title || `Серия ${nextEp?.episodeNumber || ''}`}</div>
              </div>
              <ArrowLeftIcon className="w-4 h-4 rotate-180" />
            </div>
          </button>
        </div>

        {/* Все серии сезона */}
        <div className="mt-5 sm:mt-8 bg-white rounded-xl sm:rounded-2xl border border-zinc-200 p-3 sm:p-4">
          <h3 className="font-semibold text-zinc-900 mb-3 px-1 sm:px-2 text-sm sm:text-base">
            Все серии сезона {seasonNumber}
          </h3>
          <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2">
            {allEpisodes.map(ep => {
              const active = ep.id === episode.id;
              return (
                <button
                  key={ep.id}
                  onClick={() => navigate(`/watch/${ep.id}`)}
                  className={`flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-lg transition text-center ${
                    active ? 'bg-zinc-900 text-white' : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-900'
                  }`}
                >
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-bold mb-0.5 sm:mb-1 ${
                    active ? 'bg-white/15' : 'bg-white'
                  }`}>
                    {ep.episodeNumber}
                  </div>
                  <div className="text-[9px] sm:text-[10px] truncate w-full">
                    {ep.title || `Серия ${ep.episodeNumber}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}