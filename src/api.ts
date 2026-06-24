import type { Anime, Episode, Comment, User } from './types';

import {
  catalogCache,
  animeDetailCache,
  episodesCache,
  commentsCache,
  statsCache,
  userCache,
  favoritesCache,
} from './cache';

const API_BASE = '/api';

// ================================================================
// HTTP
// ================================================================
async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ================================================================
// ПРЕДЗАГРУЗКА
// ================================================================
let preloadStarted = false;
let preloadPromise: Promise<void> | null = null;

export function preloadAll(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    if (preloadStarted) return;
    preloadStarted = true;

    try {
      await Promise.allSettled([
        (async () => {
          try {
            if (catalogCache.isFresh() && catalogCache.read()?.length) return;
            const { items } = await http<{ items: Anime[] }>('/anime?sort=popular');
            catalogCache.write(items || []);
          } catch (e) {
            console.warn('[preload] catalog failed:', e);
          }
        })(),

        (async () => {
          try {
            if (userCache.isFresh() && userCache.read() !== null) return;
            const { user } = await http<{ user: User | null }>('/auth/me');
            userCache.write(user);
          } catch (e) {
            console.warn('[preload] user failed:', e);
            userCache.write(null);
          }
        })(),
      ]);
    } catch (e) {
      console.warn('[preload] failed:', e);
    }
  })();

  return preloadPromise;
}

export async function refreshAll(): Promise<void> {
  preloadStarted = false;
  preloadPromise = null;
  await preloadAll();
}

// ================================================================
// АККАУНТЫ
// ================================================================
export const users = {
  async getCurrent(): Promise<User | null> {
    const cached = userCache.read();
    if (cached !== null) {
      http<{ user: User | null }>('/auth/me')
        .then(({ user }) => {
          userCache.write(user);
          window.dispatchEvent(new Event('corpmult_user_change'));
        })
        .catch(() => {});
      return cached;
    }
    try {
      const { user } = await http<{ user: User | null }>('/auth/me');
      userCache.write(user);
      return user;
    } catch {
      userCache.write(null);
      return null;
    }
  },

  async login(username: string, password: string): Promise<User> {
    const { user } = await http<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    userCache.write(user);
    return user;
  },

  async register(username: string, password: string): Promise<User> {
    const { user } = await http<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    userCache.write(user);
    return user;
  },

  async logout(): Promise<void> {
    await http('/auth/logout', { method: 'POST' });
    userCache.write(null);
    favoritesCache.write([]);
  },
};

// ================================================================
// КАТАЛОГ
// ================================================================
export async function loadCatalog(
  sort = 'popular',
  genre?: string,
): Promise<Anime[]> {
  if (!genre && sort === 'popular') {
    const cached = catalogCache.read();
    if (cached && cached.length > 0) {
      http<{ items: Anime[] }>('/anime?sort=popular')
        .then(({ items }) => {
          if (items && items.length > 0) catalogCache.write(items);
        })
        .catch(() => {});
      return cached;
    }
  }

  const params = new URLSearchParams({ sort });
  if (genre && genre !== 'all') params.set('genre', genre);
  const { items } = await http<{ items: Anime[] }>(`/anime?${params}`);
  if (!genre && sort === 'popular') catalogCache.write(items);
  return items || [];
}

export async function getAnimeById(id: number): Promise<Anime | null> {
  const cached = animeDetailCache.read(id);
  if (cached) {
    http<{ anime: Anime }>(`/anime/${id}`)
      .then(({ anime }) => {
        if (anime) animeDetailCache.write(id, anime);
      })
      .catch(() => {});
    return cached;
  }

  try {
    const { anime } = await http<{ anime: Anime }>(`/anime/${id}`);
    if (anime) animeDetailCache.write(id, anime);
    return anime ?? null;
  } catch {
    return null;
  }
}

export async function searchAnime(query: string): Promise<Anime[]> {
  if (!query.trim()) return [];
  const all = await loadCatalog('popular');
  const q = query.trim().toLowerCase();
  return all.filter(
    (v) =>
      v.title.toLowerCase().includes(q) ||
      v.genres.some((g) => g.toLowerCase().includes(q)) ||
      v.description.toLowerCase().includes(q),
  );
}

// ================================================================
// СОЗДАНИЕ АНИМЕ / СЕЗОНА / СЕРИИ
// ================================================================
export interface CreateAnimeOptions {
  title: string;
  description?: string;
  year?: number;
  ageRating?: string;
  genres?: string;
}

export async function createAnime(opts: CreateAnimeOptions): Promise<number> {
  const { animeId } = await http<{ animeId: number }>('/anime', {
    method: 'POST',
    body: JSON.stringify({
      title: opts.title,
      description: opts.description || '',
      year: opts.year || new Date().getFullYear(),
      ageRating: opts.ageRating || '12+',
      genres: opts.genres || '',
    }),
  });
  catalogCache.write([]);
  return animeId;
}

export interface CreateSeasonOptions {
  animeId: number;
  seasonNumber: number;
  description?: string;
}

export async function createSeason(opts: CreateSeasonOptions): Promise<number> {
  const { seasonId } = await http<{ seasonId: number }>(
    `/anime/${opts.animeId}/seasons`,
    {
      method: 'POST',
      body: JSON.stringify({
        seasonNumber: opts.seasonNumber,
        description: opts.description || '',
      }),
    },
  );
  return seasonId;
}

export interface UploadEpisodeOptions {
  seasonId: number;
  episodeNumber: number;
  title?: string;
  video: File;
  poster?: File | null;
  onProgress?: (pct: number) => void;
}

export async function uploadEpisode(
  opts: UploadEpisodeOptions,
): Promise<number> {
  const { episodeId } = await http<{ episodeId: number }>(
    `/seasons/${opts.seasonId}/episodes`,
    {
      method: 'POST',
      body: JSON.stringify({
        episodeNumber: opts.episodeNumber,
        title: opts.title || `Эпизод ${opts.episodeNumber}`,
      }),
    },
  );

  if (opts.video) {
    await uploadVideo({
      episodeId,
      video: opts.video,
      onProgress: opts.onProgress,
    });
  }

  if (opts.poster) {
    await uploadSeasonPoster(opts.seasonId, opts.poster);
  }

  return episodeId;
}

// ================================================================
// СЕРИИ СЕЗОНА
// ================================================================
export async function getSeasonEpisodes(
  seasonId: number,
): Promise<Episode[]> {
  const cached = episodesCache.read(seasonId);
  if (cached && cached.length > 0) {
    http<{ episodes: Episode[] }>(`/seasons/${seasonId}/episodes`)
      .then(({ episodes }) => {
        if (episodes && episodes.length > 0)
          episodesCache.write(seasonId, episodes);
      })
      .catch(() => {});
    return cached as Episode[];
  }

  const { episodes } = await http<{ episodes: Episode[] }>(
    `/seasons/${seasonId}/episodes`,
  );
  if (episodes && episodes.length > 0) episodesCache.write(seasonId, episodes);
  return episodes || [];
}

// ================================================================
// ПРЕДЗАГРУЗКА СТАТИСТИКИ
// ================================================================
export async function preloadAllStats(animeIds: number[]): Promise<void> {
  const BATCH = 6;
  for (let i = 0; i < animeIds.length; i += BATCH) {
    const batch = animeIds.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (id) => {
        if (statsCache.isFresh(id)) return;
        try {
          const [votesRes, ratingRes, commentsRes] = await Promise.all([
            http<{ likes: number; dislikes: number; userVote: number }>(
              `/anime/${id}/votes`,
            ),
            http<{ average: number; count: number; userScore: number | null }>(
              `/anime/${id}/rating`,
            ),
            http<{ comments: Comment[] }>(`/anime/${id}/comments`),
          ]);

          statsCache.write(id, {
            likesCount: votesRes.likes,
            dislikesCount: votesRes.dislikes,
            userVote: votesRes.userVote as -1 | 0 | 1,
            rating: ratingRes,
          });

          commentsCache.write(id, commentsRes.comments);
        } catch {}
      }),
    );
  }
}

// ================================================================
// ЛАЙКИ / ДИЗЛАЙКИ
// ================================================================
export async function voteAnime(animeId: number, vote: 1 | -1 | 0) {
  const result = await http<{
    likes: number;
    dislikes: number;
    userVote: number;
  }>(`/anime/${animeId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ vote }),
  });

  const cached = statsCache.read(animeId);
  if (cached) {
    statsCache.write(animeId, {
      ...cached,
      likesCount: result.likes,
      dislikesCount: result.dislikes,
      userVote: result.userVote as -1 | 0 | 1,
    });
  }
  return result;
}

// ================================================================
// РЕЙТИНГИ
// ================================================================
export async function rateAnime(animeId: number, score: number) {
  const result = await http<{
    average: number;
    count: number;
    userScore: number;
  }>(`/anime/${animeId}/rate`, {
    method: 'POST',
    body: JSON.stringify({ score }),
  });

  const cached = statsCache.read(animeId);
  if (cached) {
    statsCache.write(animeId, { ...cached, rating: result });
  }
  return result;
}

export async function getAnimeRating(animeId: number) {
  const cached = statsCache.read(animeId);
  if (cached) {
    http<{ average: number; count: number; userScore: number | null }>(
      `/anime/${animeId}/rating`,
    )
      .then((fresh) => {
        statsCache.write(animeId, { ...cached, rating: fresh });
      })
      .catch(() => {});
    return cached.rating;
  }

  const fresh = await http<{
    average: number;
    count: number;
    userScore: number | null;
  }>(`/anime/${animeId}/rating`);
  return fresh;
}

// ================================================================
// КОММЕНТАРИИ
// ================================================================
export async function getComments(animeId: number): Promise<Comment[]> {
  const cached = commentsCache.read(animeId);
  if (cached && cached.length > 0) {
    http<{ comments: Comment[] }>(`/anime/${animeId}/comments`)
      .then(({ comments }) => {
        if (comments) commentsCache.write(animeId, comments);
      })
      .catch(() => {});
    return cached;
  }

  const { comments } = await http<{ comments: Comment[] }>(
    `/anime/${animeId}/comments`,
  );
  if (comments) commentsCache.write(animeId, comments);
  return comments || [];
}

export async function addComment(
  animeId: number,
  text: string,
  episodeId?: number,
): Promise<Comment> {
  const { comment } = await http<{ comment: Comment }>(
    `/anime/${animeId}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ text, episodeId }),
    },
  );

  const cached = commentsCache.read(animeId) || [];
  commentsCache.write(animeId, [comment, ...cached]);
  return comment;
}

export async function toggleCommentLike(commentId: number) {
  const result = await http<{ likes: number; liked: boolean }>(
    `/comments/${commentId}/like`,
    { method: 'POST' },
  );
  window.dispatchEvent(new Event('corpmult_comments_change'));
  return result;
}

export async function deleteComment(commentId: number) {
  await http(`/comments/${commentId}`, { method: 'DELETE' });
  window.dispatchEvent(new Event('corpmult_comments_change'));
}

// ================================================================
// ПРОСМОТРЫ
// ================================================================
export async function recordView(
  episodeId: number,
  watchedSeconds: number,
): Promise<number> {
  try {
    const { views } = await http<{ views: number; counted: boolean }>(
      `/episodes/${episodeId}/view`,
      {
        method: 'POST',
        body: JSON.stringify({ watchedSeconds }),
      },
    );
    return views;
  } catch {
    return 0;
  }
}

// ================================================================
// ИЗБРАННОЕ
// ================================================================
export async function getFavorites(): Promise<
  {
    id: number;
    title: string;
    poster: string;
    year: number;
    likesCount: number;
    rating: number;
  }[]
> {
  const cached = favoritesCache.read();
  if (cached !== null) {
    http<{ items: any[] }>('/favorites')
      .then(({ items }) => {
        favoritesCache.write(items.map((i: any) => i.id));
      })
      .catch(() => {});

    const catalog = catalogCache.read() || [];
    return cached
      .map((id) => catalog.find((c) => c.id === id))
      .filter((c): c is Anime => Boolean(c))
      .map((c) => ({
        id: c.id,
        title: c.title,
        year: c.year,
        likesCount: c.likesCount ?? 0,
        rating: c.rating ?? 0,
        poster: `/api/files/anime/${c.id}/poster`,
      }));
  }

  try {
    const { items } = await http<{ items: any[] }>('/favorites');
    favoritesCache.write(items.map((i: any) => i.id));
    return items.map((i: any) => ({
      ...i,
      poster: `/api/files/anime/${i.id}/poster`,
    }));
  } catch {
    return [];
  }
}

export async function toggleFavorite(animeId: number): Promise<boolean> {
  const { favorite } = await http<{ favorite: boolean }>(
    `/favorites/${animeId}`,
    { method: 'POST' },
  );

  const cached = favoritesCache.read() || [];
  const idx = cached.indexOf(animeId);
  if (favorite && idx === -1) cached.push(animeId);
  if (!favorite && idx >= 0) cached.splice(idx, 1);
  favoritesCache.write(cached);

  window.dispatchEvent(new Event('corpmult_favorites_change'));
  return favorite;
}

// ================================================================
// ИСТОРИЯ
// ================================================================
export async function getHistory() {
  try {
    return (await http<{ history: any[] }>('/history')).history;
  } catch {
    return [];
  }
}

export async function pushHistory(episodeId: number) {
  try {
    await http(`/history/${episodeId}`, { method: 'POST' });
  } catch {}
}

// ================================================================
// СМЕНА ПАРОЛЯ
// ================================================================
export async function changePassword(
  oldPassword: string,
  newPassword: string,
) {
  return http('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

// ================================================================
// АДМИНКА
// ================================================================
export const admin = {
  async listUsers() {
    return (await http<{ users: any[] }>('/admin/users')).users;
  },

  async setUploadPermission(userId: number, canUpload: boolean) {
    await http(`/admin/users/${userId}/upload-permission`, {
      method: 'POST',
      body: JSON.stringify({ canUpload }),
    });
  },

  async setAdmin(userId: number, isAdmin: boolean) {
    await http(`/admin/users/${userId}/admin`, {
      method: 'POST',
      body: JSON.stringify({ isAdmin }),
    });
  },

  async deleteComment(commentId: number) {
    await http(`/admin/comments/${commentId}`, { method: 'DELETE' });
  },

  async deleteAnime(animeId: number) {
    await fetch(`${API_BASE}/admin/anime/${animeId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    catalogCache.write([]);
  },
};

// ================================================================
// FILE UPLOAD
// ================================================================
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadAnimePoster(
  animeId: number,
  file: File,
): Promise<void> {
  const base64Data = await fileToBase64(file);
  await http(`/files/anime/${animeId}/poster`, {
    method: 'POST',
    body: JSON.stringify({ data: base64Data, mime: file.type }),
  });
}

export async function uploadAnimeBanner(
  animeId: number,
  file: File,
): Promise<void> {
  const base64Data = await fileToBase64(file);
  await http(`/files/anime/${animeId}/banner`, {
    method: 'POST',
    body: JSON.stringify({ data: base64Data, mime: file.type }),
  });
}

export async function uploadSeasonPoster(
  seasonId: number,
  file: File,
): Promise<void> {
  const base64Data = await fileToBase64(file);
  await http(`/files/season/${seasonId}/poster`, {
    method: 'POST',
    body: JSON.stringify({ data: base64Data, mime: file.type }),
  });
}

export interface UploadVideoOptions {
  episodeId: number;
  video: File;
  durationSeconds?: number;
  sizeBytes?: number;
  onProgress?: (pct: number) => void;
}

export async function uploadVideo(opts: UploadVideoOptions): Promise<void> {
  const base64Data = await fileToBase64(opts.video);
  await http(`/files/episode/${opts.episodeId}/video`, {
    method: 'POST',
    body: JSON.stringify({
      data: base64Data,
      mime: opts.video.type,
      durationSeconds: opts.durationSeconds || 0,
      sizeBytes: opts.sizeBytes || opts.video.size,
    }),
  });
}

// ================================================================
// ЭКСПОРТ (совместимость со старым кодом)
// ================================================================
export type Video = Anime;

export const api = {
  me: users.getCurrent,
  login: users.login,
  register: users.register,

  listAnime: loadCatalog,
  
  loadCatalog,
  getAnimeById,
  searchAnime,
  createAnime,

  createSeason,
  uploadEpisode,
  getSeasonEpisodes,

  getComments,
  addComment,
  toggleCommentLike,
  deleteComment,

  voteAnime,
  rateAnime,
  getAnimeRating,

  getFavorites,
  toggleFavorite,

  getHistory,
  pushHistory,

  admin,

  recordView,
  changePassword,

  preloadAll,
  refreshAll,
};
