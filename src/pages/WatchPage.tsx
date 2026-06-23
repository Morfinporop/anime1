import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { store } from '../store';
import type { Episode } from '../types';
import { useAuth } from '../auth';
import { VideoPlayer } from '../components/VideoPlayer';
import { ArrowLeftIcon, StarIcon, SendIcon } from '../components/icons';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
}

export default function WatchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const episodeId = parseInt(id ?? '0');

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [animeTitle, setAnimeTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState<number | undefined>(undefined);
  const [ratingStats, setRatingStats] = useState({ avg: 0, count: 0 });
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<ReturnType<typeof store.listComments>>([]);

  useEffect(() => {
    const ep = store.getEpisode(episodeId);
    if (!ep) { setLoading(false); return; }
    const anime = store.getAnime(ep.anime_id);
    setEpisode(ep);
    setAnimeTitle(anime?.title ?? '');
    setAllEpisodes(store.listEpisodes(ep.anime_id));
    store.recordView(episodeId);
    if (user) {
      store.addHistory(user.id, episodeId);
      setUserRating(store.getRating(user.id, episodeId));
    }
    setRatingStats(store.ratingStats(episodeId));
    setComments(store.listComments(episodeId));
    setLoading(false);
    window.scrollTo({ top: 0 });
  }, [episodeId, user]);

  const seasonEpisodes = useMemo(() => {
    if (!episode) return [];
    return allEpisodes.filter(e => e.season === episode.season);
  }, [allEpisodes, episode]);

  const currentIdx = useMemo(() => {
    if (!episode) return -1;
    return seasonEpisodes.findIndex(e => e.id === episode.id);
  }, [episode, seasonEpisodes]);

  const prevEp = currentIdx > 0 ? seasonEpisodes[currentIdx - 1] : null;
  const nextEp = currentIdx >= 0 && currentIdx < seasonEpisodes.length - 1 ? seasonEpisodes[currentIdx + 1] : null;

  const rate = (v: number) => {
    if (!user || !episode) return;
    store.setRating(user.id, episode.id, v);
    setUserRating(v);
    setRatingStats(store.ratingStats(episode.id));
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !episode || !commentText.trim()) return;
    store.createComment(user.id, episode.id, commentText.trim());
    setComments(store.listComments(episode.id));
    setCommentText('');
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

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-[1400px] px-3 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1.5 py-3 text-xs text-zinc-500 sm:text-sm">
          <Link to={`/anime/${episode.anime_id}`} className="hover:text-zinc-900 line-clamp-1">{animeTitle}</Link>
          <span>›</span>
          <span>Сезон {episode.season}</span>
          <span>›</span>
          <span className="text-zinc-900">Серия {episode.episode_number}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div>
            <VideoPlayer episode={episode} />

            <div className="mt-5">
              <h1 className="text-display text-2xl text-zinc-900 sm:text-3xl">
                {animeTitle} — Серия {episode.episode_number}
              </h1>
              {episode.title && <p className="mt-1 text-sm text-zinc-600">{episode.title}</p>}
              <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                <span>{episode.views} просмотров</span>
              </div>
            </div>

            {/* ОЦЕНКА */}
            <div className="mt-6 bg-white rounded-2xl border border-zinc-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-900">Ваша оценка</h3>
                <div className="flex items-center gap-1.5 text-sm">
                  <StarIcon filled className="w-4 h-4 text-yellow-500" />
                  <span className="font-bold text-zinc-900">{ratingStats.avg > 0 ? ratingStats.avg.toFixed(1) : '—'}</span>
                  <span className="text-zinc-500">({ratingStats.count})</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                  const active = (userRating ?? 0) >= n;
                  return (
                    <button key={n} onClick={() => rate(n)} disabled={!user}
                      className={`p-1 transition-transform hover:scale-125 disabled:opacity-50 disabled:cursor-not-allowed ${active ? 'text-yellow-500' : 'text-zinc-300'}`}
                      aria-label={`Оценить на ${n}`}>
                      <StarIcon filled={active} className="w-6 h-6 sm:w-7 sm:h-7" />
                    </button>
                  );
                })}
              </div>
              {!user && <p className="mt-3 text-xs text-zinc-500">Войдите, чтобы оценить серию</p>}
            </div>

            {/* КОММЕНТАРИИ */}
            <div className="mt-6 bg-white rounded-2xl border border-zinc-200 p-5">
              <h3 className="font-semibold text-zinc-900 mb-4">Комментарии · {comments.length}</h3>
              {user ? (
                <form onSubmit={submitComment} className="flex gap-2 mb-4">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {user.username[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 relative">
                    <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Оставьте комментарий..." rows={2}
                      className="w-full px-3 py-2 pr-12 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm resize-none transition" />
                    <button type="submit" disabled={!commentText.trim()}
                      className="absolute right-2 bottom-2 p-2 rounded-lg bg-black text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition">
                      <SendIcon className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mb-4 p-3 rounded-xl bg-zinc-50 text-sm text-zinc-600 text-center">
                  <Link to="/auth" className="text-zinc-900 font-medium underline">Войдите</Link>, чтобы оставлять комментарии
                </div>
              )}

              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-center py-6 text-sm text-zinc-400">Пока никто не комментировал</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ backgroundColor: c.avatar_color }}>
                        {c.username[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-sm text-zinc-900">{c.username}</span>
                          <span className="text-xs text-zinc-400">{timeAgo(c.created_at)}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-zinc-700 break-words whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-between gap-3">
              <button disabled={!prevEp} onClick={() => prevEp && navigate(`/watch/${prevEp.id}`)}
                className="px-5 py-2.5 rounded-full border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
                ← Предыдущая
              </button>
              <button disabled={!nextEp} onClick={() => nextEp && navigate(`/watch/${nextEp.id}`)}
                className="px-5 py-2.5 rounded-full bg-black text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition">
                Следующая →
              </button>
            </div>
          </div>

          <aside className="bg-white rounded-2xl border border-zinc-200 p-4 lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
            <h3 className="font-semibold text-zinc-900 mb-3 px-2">Все серии</h3>
            <div className="space-y-1">
              {allEpisodes.map(ep => {
                const active = ep.id === episode.id;
                return (
                  <button key={ep.id} onClick={() => navigate(`/watch/${ep.id}`)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition text-left ${
                      active ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-50 text-zinc-700'
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      active ? 'bg-white/15' : 'bg-zinc-100'
                    }`}>
                      {ep.episode_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{ep.title}</div>
                      {ep.season !== episode.season && (
                        <div className={`text-xs ${active ? 'text-zinc-300' : 'text-zinc-400'}`}>Сезон {ep.season}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}