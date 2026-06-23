import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Anime, Comment, Episode, Season } from '../types';
import { bannerUrl, FALLBACK_BANNER } from '../hooks';
import { VideoPlayer } from '../components/VideoPlayer';
import {
  ArrowLeftIcon, HeartIcon, PlayIcon, ShareIcon, StarIcon,
  ThumbsDownIcon, ThumbsUpIcon, SendIcon,
} from '../components/icons';

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

export default function AnimePage() {
  const params = useParams();
  const rawId = params.id ?? params.animeId ?? '0';
  const animeId = parseInt(rawId);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [anime, setAnime] = useState<Anime | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [votes, setVotes] = useState<{ likes: number; dislikes: number; user_vote: number }>({ likes: 0, dislikes: 0, user_vote: 0 });
  const [rating, setRating] = useState<{ avg: number; count: number; user_score: number | null }>({ avg: 0, count: 0, user_score: null });
  const [fav, setFav] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getAnime(animeId),
      api.getSeasons(animeId),
      api.getVotes(animeId),
      api.getRating(animeId),
      api.getComments(animeId),
    ]).then(([a, ss, v, r, cmts]) => {
      setAnime(a);
      setSeasons(ss);
      setVotes(v);
      setRating(r);
      setComments(cmts);
      if (a && ss.length > 0) setCurrentSeason(ss[0]);
      if (a?.created_by) {
        api.getUser(a.created_by).then(u => {
          if (u) setAuthorName(u.username);
        }).catch(() => {});
      }
      if (user) api.isFavorite(animeId).then(setFav).catch(() => {});
      setLoading(false);
      window.scrollTo({ top: 0 });
    }).catch(() => setLoading(false));
  }, [animeId, user]);

  useEffect(() => {
    if (!currentSeason) return;
    api.getSeasonEpisodes(currentSeason.id).then(setEpisodes);
  }, [currentSeason]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
        <h1 className="text-display text-2xl text-zinc-900">Аниме не найдено</h1>
        <Link to="/" className="mt-4 inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900">
          <ArrowLeftIcon className="h-4 w-4" /> На главную
        </Link>
      </div>
    );
  }

  const vote = async (v: 1 | -1) => {
    if (!user) { navigate('/auth'); return; }
    const newVote = votes.user_vote === v ? 0 : v;
    await api.vote(anime.id, newVote);
    setVotes(await api.getVotes(anime.id));
  };

  const toggleFav = async () => {
    if (!user) { navigate('/auth'); return; }
    if (fav) { await api.removeFavorite(anime.id); setFav(false); }
    else { await api.addFavorite(anime.id); setFav(true); }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const submitComment = async () => {
    if (!user || !newComment.trim()) return;
    await api.createComment(anime.id, newComment.trim());
    setComments(await api.getComments(anime.id));
    setNewComment('');
  };

  const rateAnime = async (score: number) => {
    if (!user) { navigate('/auth'); return; }
    await api.rate(anime.id, score);
    setRating(await api.getRating(anime.id));
  };

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="relative">
        <div className="relative h-56 xs:h-64 sm:h-80 md:h-96 lg:h-[28rem] xl:h-[32rem] overflow-hidden">
          <img src={bannerUrl(anime.id)} alt="" className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_BANNER; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent" />
        </div>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-32 md:-mt-40 relative">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-zinc-900/5 p-4 sm:p-6 md:p-8 border border-zinc-200">
            <h1 className="text-display text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-zinc-900 leading-tight">
              {anime.title}
            </h1>
            <div className={`mt-3 text-sm sm:text-base text-zinc-600 max-w-3xl ${expanded ? '' : 'line-clamp-3 sm:line-clamp-none'}`}>
              {anime.description}
            </div>
            {anime.description.length > 150 && (
              <button onClick={() => setExpanded(s => !s)} className="mt-1 text-xs font-semibold text-zinc-900 hover:underline sm:hidden">
                {expanded ? 'Свернуть' : 'Читать полностью'}
              </button>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
              {(rating.avg ?? 0) > 0 && (
                <span className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800 font-semibold">
                  <StarIcon filled className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  {rating.avg.toFixed(1)}
                </span>
              )}
              <span className="px-2 sm:px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium">{anime.year}</span>
              <span className="px-2 sm:px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium">{anime.age_rating}</span>
              {anime.type === 'single' && <span className="px-2 sm:px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium">Одиночное</span>}
              {anime.type === 'season' && <span className="px-2 sm:px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium">Сезонное</span>}
              {anime.genres.slice(0, window.innerWidth < 640 ? 2 : anime.genres.length).map((g: string) => (
                <span key={g} className="px-2 sm:px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium">{g}</span>
              ))}
            </div>

            {/* Действия */}
            <div className="mt-4 sm:mt-5 flex flex-wrap items-center gap-2">
              <button onClick={() => vote(1)}
                className={`flex items-center gap-1 sm:gap-1.5 rounded-full border px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                  votes.user_vote === 1 ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                }`}>
                <ThumbsUpIcon filled={votes.user_vote === 1} className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                <span className="tabular-nums">{votes.likes}</span>
              </button>
              <button onClick={() => vote(-1)}
                className={`flex items-center gap-1 sm:gap-1.5 rounded-full border px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition ${
                  votes.user_vote === -1 ? 'border-red-300 bg-red-50 text-red-700' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                }`}>
                <ThumbsDownIcon filled={votes.user_vote === -1} className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                <span className="tabular-nums">{votes.dislikes}</span>
              </button>
              <button onClick={toggleFav}
                className={`flex items-center gap-1.5 sm:gap-2 rounded-full border px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition ${
                  fav ? 'border-pink-300 bg-pink-50 text-pink-700' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                }`}>
                <HeartIcon filled={fav} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">{fav ? 'В избранном' : 'В избранное'}</span>
              </button>
              <button onClick={share}
                className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-zinc-200 bg-white px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-zinc-900 transition hover:bg-zinc-50">
                <ShareIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">{copied ? 'Скопировано' : 'Поделиться'}</span>
              </button>
              {anime.created_by && (
                <Link to={`/user/${anime.created_by}`} className="text-[11px] sm:text-xs text-zinc-500 hover:text-zinc-900 ml-auto">
                  <span className="hidden sm:inline">Автор: </span>
                  <span className="font-semibold hover:underline">{authorName || `user #${anime.created_by}`}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
        {/* Сезоны */}
        {seasons.length > 1 && (
          <div className="mb-4 sm:mb-5 flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-zinc-700 mr-1">Сезоны:</span>
            {seasons.map(s => (
              <button key={s.id} onClick={() => setCurrentSeason(s)}
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition ${
                  s.id === currentSeason?.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}>
                Сезон {s.season_number}
              </button>
            ))}
          </div>
        )}

        {/* Для одиночного аниме — показываем видеоплеер сразу */}
        {anime.type === 'single' && episodes.length > 0 && (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-zinc-200 overflow-hidden p-4 sm:p-6">
            <VideoPlayer episode={episodes[0]} />
          </div>
        )}

        {/* Серии */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-zinc-100">
            <h2 className="font-semibold text-zinc-900 text-sm sm:text-base">
              {currentSeason ? `Сезон ${currentSeason.season_number}` : 'Серии'} — {episodes.length}
            </h2>
          </div>
          {episodes.length === 0 ? (
            <div className="px-4 py-10 sm:py-12 text-center text-sm text-zinc-500">
              В этом сезоне пока нет серий
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {episodes.map(ep => (
                <button key={ep.id} onClick={() => navigate(`/watch/${ep.id}`)}
                  className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-2.5 sm:py-3 hover:bg-zinc-50 transition text-left">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0">
                    {ep.episode_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs sm:text-sm text-zinc-900">Серия {ep.episode_number} · {ep.title}</div>
                    <div className="text-xs text-zinc-500 line-clamp-1 mt-0.5 hidden xs:block">{ep.description}</div>
                  </div>
                  <PlayIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Рейтинг */}
        <div className="mt-5 sm:mt-6 bg-white rounded-xl sm:rounded-2xl border border-zinc-200 p-4 sm:p-5">
          <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-1 mb-3">
            <h3 className="font-semibold text-zinc-900 text-sm sm:text-base">Оцените аниме</h3>
            <div className="text-xs text-zinc-500">
              {rating.count > 0 ? `Средняя: ${rating.avg.toFixed(1)} (${rating.count})` : 'Будьте первым!'}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => rateAnime(n)}
                className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-xs sm:text-sm font-bold transition ${
                  rating.user_score === n ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-500'
                  : (rating.user_score !== null && n <= (rating.user_score ?? 0)) ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Комментарии */}
        <div className="mt-5 sm:mt-6 bg-white rounded-xl sm:rounded-2xl border border-zinc-200 p-4 sm:p-5">
          <h3 className="font-semibold text-zinc-900 mb-4 text-sm sm:text-base">Комментарии · {comments.length}</h3>
          {user ? (
            <form onSubmit={(e) => { e.preventDefault(); submitComment(); }} className="flex gap-2 mb-4">
              <Link to={`/user/${user.id}`} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                style={{ backgroundColor: user.avatar_color }}>
                {user.username[0]?.toUpperCase()}
              </Link>
              <div className="flex-1 relative">
                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Оставьте комментарий..." rows={2}
                  className="w-full px-3 py-2 pr-11 sm:pr-12 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm resize-none transition" />
                <button type="submit" disabled={!newComment.trim()}
                  className="absolute right-2 bottom-2 p-1.5 sm:p-2 rounded-lg bg-black text-white hover:bg-zinc-800 disabled:opacity-40 transition">
                  <SendIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </form>
          ) : (
            <div className="mb-4 p-3 rounded-xl bg-zinc-50 text-xs sm:text-sm text-zinc-600 text-center">
              <Link to="/auth" className="text-zinc-900 font-medium underline">Войдите</Link>, чтобы оставлять комментарии
            </div>
          )}
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-center py-6 text-sm text-zinc-400">Пока никто не комментировал</p>
            ) : comments.map(c => (
              <div key={c.id} className="flex gap-2 sm:gap-3">
                <Link to={`/user/${c.user_id}`} className="shrink-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: c.avatar_color }}>
                    {c.username[0]?.toUpperCase()}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                    <Link to={`/user/${c.user_id}`} className="font-semibold text-xs sm:text-sm text-zinc-900 hover:underline">
                      {c.username}
                    </Link>
                    {(c.is_admin || c.isAdmin) && <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-semibold uppercase">Admin</span>}
                    <span className="text-xs text-zinc-400">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs sm:text-sm text-zinc-700 break-words whitespace-pre-wrap">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}