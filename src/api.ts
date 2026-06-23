// API клиент для AnimeWorld — работает с PostgreSQL через бэкенд Express
import type { Anime, Comment, Episode, HistoryItem, Season, User } from './types';

const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('aw_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // AUTH
  async register(username: string, password: string): Promise<{ user: User; token: string }> {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  async login(username: string, password: string): Promise<{ user: User; token: string }> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  async me(): Promise<User | null> {
    try {
      return await request('/auth/me');
    } catch {
      return null;
    }
  },

  // USERS
  async getUser(id: number): Promise<User | null> {
    try {
      return await request(`/users/${id}`);
    } catch {
      return null;
    }
  },
  async getUserAnime(id: number): Promise<Anime[]> {
    return request(`/users/${id}/anime`);
  },
  async getUserFavorites(id: number): Promise<Anime[]> {
    return request(`/users/${id}/favorites`);
  },

  // ANIME
  async listAnime(sort: string = 'popular', genre?: string | null): Promise<Anime[]> {
    const params = new URLSearchParams({ sort });
    if (genre && genre !== 'all') params.set('genre', genre);
    return request(`/anime?${params}`);
  },
  async searchAnime(q: string): Promise<Anime[]> {
    return request(`/anime/search?q=${encodeURIComponent(q)}`);
  },
  async getAnime(id: number): Promise<Anime | null> {
    try { return await request(`/anime/${id}`); } catch { return null; }
  },
  async getSeasons(animeId: number): Promise<Season[]> {
    return request(`/anime/${animeId}/seasons`);
  },
  async getSeasonEpisodes(seasonId: number): Promise<Episode[]> {
    return request(`/seasons/${seasonId}/episodes`);
  },
  async getEpisode(id: number): Promise<Episode | null> {
    try { return await request(`/episodes/${id}`); } catch { return null; }
  },

  // COMMENTS
  async getComments(animeId: number): Promise<Comment[]> {
    return request(`/anime/${animeId}/comments`);
  },
  async createComment(animeId: number, text: string): Promise<Comment> {
    return request(`/anime/${animeId}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
  },
  async deleteComment(id: number): Promise<void> {
    await request(`/comments/${id}`, { method: 'DELETE' });
  },
  async likeComment(id: number): Promise<{ likes: number }> {
    return request(`/comments/${id}/like`, { method: 'POST' });
  },

  // VOTES
  async getVotes(animeId: number): Promise<{ likes: number; dislikes: number; user_vote: number }> {
    return request(`/anime/${animeId}/votes`);
  },
  async vote(animeId: number, vote: number): Promise<void> {
    await request(`/anime/${animeId}/vote`, { method: 'POST', body: JSON.stringify({ vote }) });
  },

  // RATINGS
  async getRating(animeId: number): Promise<{ avg: number; count: number; user_score: number | null }> {
    return request(`/anime/${animeId}/rating`);
  },
  async rate(animeId: number, score: number): Promise<void> {
    await request(`/anime/${animeId}/rate`, { method: 'POST', body: JSON.stringify({ score }) });
  },

  // FAVORITES
  async getFavorites(): Promise<Anime[]> {
    return request(`/favorites`);
  },
  async addFavorite(animeId: number): Promise<void> {
    await request(`/anime/${animeId}/favorite`, { method: 'POST' });
  },
  async removeFavorite(animeId: number): Promise<void> {
    await request(`/anime/${animeId}/favorite`, { method: 'DELETE' });
  },
  async isFavorite(animeId: number): Promise<boolean> {
    try {
      const r: any = await request(`/anime/${animeId}/is-favorite`);
      return !!r?.favorite;
    } catch {
      return false;
    }
  },

  // HISTORY
  async addHistory(episodeId: number): Promise<void> {
    await request(`/episodes/${episodeId}/history`, { method: 'POST' });
  },
  async getHistory(): Promise<HistoryItem[]> {
    return request(`/history`);
  },

  // VIEWS
  async recordView(episodeId: number): Promise<void> {
    await request(`/episodes/${episodeId}/view`, { method: 'POST' });
  },

  // ADMIN
  async adminListUsers(search?: string): Promise<User[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return request(`/admin/users${qs}`);
  },
  async adminUpdateRole(id: number, data: { is_admin?: boolean; can_upload?: boolean }): Promise<void> {
    await request(`/admin/users/${id}/role`, { method: 'POST', body: JSON.stringify(data) });
  },
  async adminListAnime(): Promise<any[]> {
    return request(`/admin/anime`);
  },
  async adminDeleteAnime(id: number): Promise<void> {
    await request(`/admin/anime/${id}`, { method: 'DELETE' });
  },
  async adminDeleteSeason(id: number): Promise<void> {
    await request(`/admin/seasons/${id}`, { method: 'DELETE' });
  },
  async adminDeleteEpisode(id: number): Promise<void> {
    await request(`/admin/episodes/${id}`, { method: 'DELETE' });
  },
  async adminDeleteComment(id: number): Promise<void> {
    await request(`/admin/comments/${id}`, { method: 'DELETE' });
  },

  // UPLOAD
  async uploadAnime(data: any): Promise<{ ok: boolean; anime_id: number }> {
    return request(`/upload/anime`, { method: 'POST', body: JSON.stringify(data) });
  },
  async uploadSeason(data: any): Promise<{ ok: boolean; season_id: number }> {
    return request(`/upload/season`, { method: 'POST', body: JSON.stringify(data) });
  },
  async uploadEpisode(data: any): Promise<{ ok: boolean; episode_id: number; anime_id: number }> {
    return request(`/upload/episode`, { method: 'POST', body: JSON.stringify(data) });
  },
};

// Хелпер для URL видео с указанием качества
export function videoUrl(episodeId: number, quality?: string): string {
  return quality ? `/api/episodes/${episodeId}/stream?quality=${quality}` : `/api/episodes/${episodeId}/stream`;
}

// Хелпер для URL постера/баннера (data URI в БД)
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}