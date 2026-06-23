import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { store } from '../store';
import type { Anime, Comment, Episode } from '../types';
import { useAuth } from '../auth';
import { ArrowLeftIcon, HeartIcon, PlayIcon, ShareIcon, StarIcon, ThumbsDownIcon, ThumbsUpIcon, SendIcon } from '../components/icons';

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
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [userVote, setUserVote] = useState<1 | -1 | 0>(0);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [fav, setFav] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const a = store.getAnime(animeId);
    if (!a) return;
    setAnime(a);
    const eps = store.listEpisodes(animeId);
    setEpisodes(eps);
    if (a.type === 'single' || a.type === 'movie') {
      setSelectedSeason(1);
    } else {
      const seasons = Array.from(new Set(eps.map(e => e.season))).sort((x, y) => x - y);
      setSelectedSeason(seasons[0] ?? 1);
    }
    // Comments из первого эпизода (для одиночного аниме)
    if (eps[0]) setComments(store.listComments(eps[0].id));
    const stats = store.animeVoteStats(animeId, user?.id);
    setLikesCount(stats.likes);
    setDislikesCount(stats.dislikes);
    setUserVote(stats.userVote);
    if (user) setFav(store.isFavorite(user.id, animeId));
    window.scrollTo({ top: 0 });
  }, [animeId, user]);

  const seasonEpisodes = useMemo(() => {
    if (selectedSeason === null) return [];
    return episodes.filter(e => e.season === selectedSeason);
  }, [episodes, selectedSeason]);

  const seasons = useMemo(() => Array.from(new Set(episodes.map(e => e.season))).sort((a, b) => a - b), [episodes]);

  const rating = useMemo(() => anime ? store.avgRating(anime.id) : 0, [anime]);

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

  // Одиночное аниме — сразу показываем плеер + взаимодействия
  if (anime.type === 'single' || (anime.type === 'movie' && episodes.length <= 1)) {
    const ep = episodes[0];
    if (!ep) {
      return (
        <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
          <h1 className="text-display text-2xl text-zinc-900">Видео ещё не загружено</h1>
        </div>
      );
    }
    return (
      <div className="animate-fade-in">
        <div className="mx-auto max-w-[1400px] px-3 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 mb-3">
            <ArrowLeftIcon className="h-4 w-4" /> К каталогу
          </Link>
          <h1 className="text-display text-3xl text-zinc-900 sm:text-4xl">{anime.title}</h1>
          <p className="mt-2 text-sm text-zinc-600 max-w-3xl">{anime.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {rating > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800 font-semibold">
                <StarIcon filled className="w-3.5 h-3.5" />
                {rating.toFixed(1)}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium">{anime.year}</span>
            <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium">{anime.age_rating}</span>
            <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium">Одиночное аниме</span>
          </div>

          <AnimeInteractions
            userVote={userVote}
            likesCount={likesCount}
            dislikesCount={dislikesCount}
            fav={fav}
            user={user}
            comments={comments}
            newComment={newComment}
            setNewComment={setNewComment}
            onVote={(v: 1 | -1 | 0) => {
              if (!user) return;
              const result = store.voteAnime(user.id, anime.id, v);
              setLikesCount(result.likes);
              setDislikesCount(result.dislikes);
              setUserVote(result.userVote);
            }}
            onFav={() => {
              if (!user) return;
              setFav(store.toggleFavorite(user.id, anime.id));
            }}
            onShare={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {}
            }}
            copied={copied}
            onComment={() => {
              if (!user || !ep || !newComment.trim()) return;
              store.createComment(user.id, ep.id, newComment.trim());
              setComments(store.listComments(ep.id));
              setNewComment('');
            }}
          />

          <div className="mt-6">
            {/* Плеер */}
            {/* @ts-ignore — VideoPlayer принимает episode */}
            <SinglePlayer episode={ep} />
          </div>
        </div>
      </div>
    );
  }

  // Сезонное аниме — список серий + превью
  return (
    <div className="animate-fade-in">
      <div className="relative">
        <div className="relative h-64 sm:h-80 lg:h-96 overflow-hidden">
          <img src={anime.banner} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent" />
        </div>
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 -mt-32 sm:-mt-40 relative">
          <div className="bg-white rounded-3xl shadow-xl shadow-zinc-900/5 p-6 sm:p-8 border border-zinc-200">
            <h1 className="text-display text-3xl text-zinc-900 sm:text-5xl">{anime.title}</h1>
            <div className={`mt-3 text-sm sm:text-base text-zinc-600 max-w-3xl ${expanded ? '' : 'line-clamp-3'}`}>{anime.description}</div>
            {anime.description.length > 150 && (
              <button onClick={() => setExpanded(s => !s)} className="mt-1 text-xs font-semibold text-zinc-900 hover:underline">
                {expanded ? 'Свернуть' : 'Читать полностью'}
              </button>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              {rating > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800 font-semibold">
                  <StarIcon filled className="w-3.5 h-3.5" />
                  {rating.toFixed(1)}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium">{anime.year}</span>
              <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium">{anime.age_rating}</span>
              {anime.genres.map(g => (
                <span key={g} className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium">{g}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 py-8 sm:py-12">
        {seasons.length > 1 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-zinc-700 mr-1">Сезоны:</span>
            {seasons.map(s => (
              <button key={s} onClick={() => setSelectedSeason(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                  s === selectedSeason ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}>
                Сезон {s}
              </button>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">Сезон {selectedSeason} — {seasonEpisodes.length} серий</h2>
          </div>
          {seasonEpisodes.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-zinc-500">
              В этом сезоне пока нет серий
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {seasonEpisodes.map(ep => (
                <button key={ep.id} onClick={() => navigate(`/watch/${ep.id}`)}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-zinc-50 transition text-left">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {ep.episode_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-zinc-900">Серия {ep.episode_number} · {ep.title}</div>
                    <div className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{ep.description}</div>
                  </div>
                  <PlayIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnimeInteractions({ userVote, likesCount, dislikesCount, fav, user, comments, newComment, setNewComment, onVote, onFav, onShare, copied, onComment }: any) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => onVote(userVote === 1 ? 0 : 1)}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all disabled:opacity-50 ${
            userVote === 1 ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
          }`}>
          <ThumbsUpIcon filled={userVote === 1} className="h-[18px] w-[18px]" />
          <span className="tabular-nums">{likesCount}</span>
        </button>
        <button onClick={() => onVote(userVote === -1 ? 0 : -1)}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all disabled:opacity-50 ${
            userVote === -1 ? 'border-red-300 bg-red-50 text-red-700' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
          }`}>
          <ThumbsDownIcon filled={userVote === -1} className="h-[18px] w-[18px]" />
          <span className="tabular-nums">{dislikesCount}</span>
        </button>
        <button onClick={onFav} disabled={!user}
          className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all disabled:opacity-50 ${
            fav ? 'border-pink-300 bg-pink-50 text-pink-700' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
          }`}>
          <HeartIcon filled={fav} className="h-4 w-4" />
          {fav ? 'В избранном' : 'В избранное'}
        </button>
        <button onClick={onShare}
          className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-900 transition-all hover:bg-zinc-50">
          <ShareIcon className="h-4 w-4" />
          {copied ? 'Скопировано' : 'Поделиться'}
        </button>
      </div>

      {/* Комментарии */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-5">
        <h3 className="font-semibold text-zinc-900 mb-4">Комментарии · {comments.length}</h3>
        {user ? (
          <form onSubmit={(e) => { e.preventDefault(); onComment(); }} className="flex gap-2 mb-4">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {user.username[0]?.toUpperCase()}
            </div>
            <div className="flex-1 relative">
              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Оставьте комментарий..." rows={2}
                className="w-full px-3 py-2 pr-12 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-none text-sm resize-none transition" />
              <button type="submit" disabled={!newComment.trim()}
                className="absolute right-2 bottom-2 p-2 rounded-lg bg-black text-white hover:bg-zinc-800 disabled:opacity-40 transition">
                <SendIcon className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <div className="mb-4 p-3 rounded-xl bg-zinc-50 text-sm text-zinc-600 text-center">
            <Link to="/auth" className="text-zinc-900 font-medium underline">Войдите</Link>, чтобы комментировать
          </div>
        )}
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-center py-6 text-sm text-zinc-400">Пока никто не комментировал</p>
          ) : comments.map((c: Comment) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}

import { VideoPlayer } from '../components/VideoPlayer';
function SinglePlayer({ episode }: { episode: Episode }) {
  return <VideoPlayer episode={episode} />;
}