// Хранилище данных AnimeWorld
// В production — PostgreSQL через бэкенд (server/)
// Здесь — in-memory эмулятор. LocalStorage НЕ используется для критических данных.

import type { Anime, Comment, Episode, Rating, User, SortType } from './types';

interface ViewHistoryItem {
  user_id: number;
  episode_id: number;
  watched_at: string;
}

interface LikeRecord {
  id: number;
  user_id: number;
  episode_id: number;
  type: 'like' | 'dislike';
}

class Store {
  users: User[] = [];
  anime: Anime[] = [];
  episodes: Episode[] = [];
  comments: Comment[] = [];
  ratings: Rating[] = [];
  history: ViewHistoryItem[] = [];
  likes: LikeRecord[] = [];
  favorites: { user_id: number; anime_id: number }[] = [];

  private seq(col: { id: number }[]): number {
    return col.length === 0 ? 1 : Math.max(...col.map(c => c.id)) + 1;
  }

  // ========== USERS ==========
  register(username: string, passwordHash: string): User {
    if (this.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('Пользователь с таким именем уже существует');
    }
    const user: User = {
      id: this.users.length === 0 ? 1 : Math.max(...this.users.map(u => u.id)) + 1,
      username,
      role: username === 'Morfin' ? 'admin' : 'user',
      can_upload: false,
      created_at: new Date().toISOString(),
    };
    (user as any).password_hash = passwordHash;
    this.users.push(user as any);
    return user;
  }

  login(username: string, passwordHash: string): User {
    const u: any = this.users.find(x => x.username.toLowerCase() === username.toLowerCase());
    if (!u) throw new Error('Пользователь не найден');
    if (u.password_hash !== passwordHash) throw new Error('Неверный пароль');
    const { password_hash, ...rest } = u;
    return rest as User;
  }

  getUser(id: number): User | undefined {
    const u: any = this.users.find(x => x.id === id);
    if (!u) return undefined;
    const { password_hash, ...rest } = u;
    return rest as User;
  }

  setCanUpload(userId: number, value: boolean): void {
    const u: any = this.users.find(x => x.id === userId);
    if (u) u.can_upload = value;
  }

  // ========== ANIME ==========
  createAnime(data: Omit<Anime, 'id' | 'created_at' | 'views' | 'likes' | 'dislikes'>): Anime {
    const a: Anime = {
      ...data,
      id: this.seq(this.anime),
      views: 0,
      likes: 0,
      dislikes: 0,
      created_at: new Date().toISOString(),
    };
    this.anime.push(a);
    return a;
  }

  getAnime(id: number): Anime | undefined {
    return this.anime.find(a => a.id === id);
  }

  listAnime(sort: SortType, genre: string | null): Anime[] {
    let arr = [...this.anime];
    if (genre && genre !== 'all') {
      arr = arr.filter(a => a.genres.includes(genre));
    }
    switch (sort) {
      case 'popular':
        arr.sort((a, b) => b.views - a.views);
        break;
      case 'newest':
        arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'rating':
        arr.sort((a, b) => this.avgRating(b.id) - this.avgRating(a.id));
        break;
      case 'title':
        arr.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
        break;
    }
    return arr;
  }

  search(q: string): Anime[] {
    const norm = q.toLowerCase().trim();
    if (!norm) return [];
    return this.anime.filter(a => a.title.toLowerCase().includes(norm));
  }

  // ========== EPISODES ==========
  createEpisode(data: Omit<Episode, 'id' | 'created_at' | 'views'>): Episode {
    const e: Episode = {
      ...data,
      id: this.seq(this.episodes),
      views: 0,
      created_at: new Date().toISOString(),
    };
    this.episodes.push(e);
    return e;
  }

  getEpisode(id: number): Episode | undefined {
    return this.episodes.find(e => e.id === id);
  }

  listEpisodes(animeId: number): Episode[] {
    return this.episodes
      .filter(e => e.anime_id === animeId)
      .sort((a, b) => a.season - b.season || a.episode_number - b.episode_number);
  }

  listSeasons(animeId: number): number[] {
    return Array.from(new Set(this.listEpisodes(animeId).map(e => e.season))).sort((a, b) => a - b);
  }

  getSeasonEpisodes(animeId: number, season: number): Episode[] {
    return this.listEpisodes(animeId).filter(e => e.season === season);
  }

  recordView(episodeId: number): void {
    const ep = this.episodes.find(e => e.id === episodeId);
    if (ep) ep.views += 1;
    const anime = ep ? this.anime.find(a => a.id === ep.anime_id) : undefined;
    if (anime) anime.views += 1;
  }

  // ========== COMMENTS ==========
  createComment(userId: number, episodeId: number, content: string): Comment {
    const user = this.getUser(userId);
    const c: Comment = {
      id: this.seq(this.comments as any),
      user_id: userId,
      episode_id: episodeId,
      content,
      username: user?.username ?? 'Удалён',
      avatar_color: pickColor(userId),
      likes: 0,
      liked_by_me: false,
      created_at: new Date().toISOString(),
    };
    this.comments.push(c);
    return c;
  }

  listComments(episodeId: number): Comment[] {
    return this.comments
      .filter(c => c.episode_id === episodeId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  toggleCommentLike(commentId: number, userId: number): { likes: number; liked: boolean } {
    const c = this.comments.find(x => x.id === commentId);
    if (!c) return { likes: 0, liked: false };
    const wasLiked = (c as any).likers?.includes(userId);
    if (!wasLiked) {
      (c as any).likers = [...((c as any).likers ?? []), userId];
      c.likes += 1;
    } else {
      (c as any).likers = ((c as any).likers ?? []).filter((x: number) => x !== userId);
      c.likes = Math.max(0, c.likes - 1);
    }
    c.liked_by_me = !wasLiked;
    return { likes: c.likes, liked: !wasLiked };
  }

  deleteComment(commentId: number, userId: number): boolean {
    const c = this.comments.find(x => x.id === commentId);
    if (!c || c.user_id !== userId) return false;
    this.comments = this.comments.filter(x => x.id !== commentId);
    return true;
  }

  // ========== RATINGS ==========
  setRating(userId: number, episodeId: number, value: number): void {
    const existing = this.ratings.find(r => r.user_id === userId && r.episode_id === episodeId);
    if (existing) existing.value = value;
    else this.ratings.push({ id: this.seq(this.ratings), user_id: userId, episode_id: episodeId, value });
  }

  getRating(userId: number, episodeId: number): number | undefined {
    return this.ratings.find(r => r.user_id === userId && r.episode_id === episodeId)?.value;
  }

  ratingStats(episodeId: number): { avg: number; count: number } {
    const ratings = this.ratings.filter(r => r.episode_id === episodeId);
    if (ratings.length === 0) return { avg: 0, count: 0 };
    return {
      avg: ratings.reduce((a, r) => a + r.value, 0) / ratings.length,
      count: ratings.length,
    };
  }

  avgRating(animeId: number): number {
    const eps = this.listEpisodes(animeId);
    if (eps.length === 0) return 0;
    let total = 0, count = 0;
    for (const e of eps) {
      const s = this.ratingStats(e.id);
      if (s.count > 0) { total += s.avg * s.count; count += s.count; }
    }
    return count > 0 ? total / count : 0;
  }

  // ========== LIKES (anime) ==========
  voteAnime(userId: number, animeId: number, vote: 1 | -1 | 0): { likes: number; dislikes: number; userVote: 1 | -1 | 0 } {
    const existing = this.likes.find(l => l.user_id === userId && this.episodes.find(e => e.id === l.episode_id)?.anime_id === animeId);
    if (existing) {
      if (vote === 0 || existing.type === (vote === 1 ? 'like' : 'dislike')) {
        this.likes = this.likes.filter(l => l !== existing);
      } else {
        existing.type = vote === 1 ? 'like' : 'dislike';
      }
    } else if (vote !== 0) {
      const ep = this.listEpisodes(animeId)[0];
      if (!ep) return { likes: 0, dislikes: 0, userVote: 0 };
      this.likes.push({ id: this.seq(this.likes), user_id: userId, episode_id: ep.id, type: vote === 1 ? 'like' : 'dislike' });
    }
    return this.animeVoteStats(animeId, userId);
  }

  animeVoteStats(animeId: number, userId?: number): { likes: number; dislikes: number; userVote: 1 | -1 | 0 } {
    const epIds = this.listEpisodes(animeId).map(e => e.id);
    const votes = this.likes.filter(l => epIds.includes(l.episode_id));
    const likes = votes.filter(v => v.type === 'like').length;
    const dislikes = votes.filter(v => v.type === 'dislike').length;
    let userVote: 1 | -1 | 0 = 0;
    if (userId) {
      const u = votes.find(v => v.user_id === userId);
      if (u) userVote = u.type === 'like' ? 1 : -1;
    }
    return { likes, dislikes, userVote };
  }

  // ========== FAVORITES ==========
  toggleFavorite(userId: number, animeId: number): boolean {
    const exists = this.favorites.find(f => f.user_id === userId && f.anime_id === animeId);
    if (exists) {
      this.favorites = this.favorites.filter(f => !(f.user_id === userId && f.anime_id === animeId));
      return false;
    }
    this.favorites.push({ user_id: userId, anime_id: animeId });
    return true;
  }

  isFavorite(userId: number, animeId: number): boolean {
    return !!this.favorites.find(f => f.user_id === userId && f.anime_id === animeId);
  }

  listFavorites(userId: number): Anime[] {
    return this.favorites
      .filter(f => f.user_id === userId)
      .map(f => this.anime.find(a => a.id === f.anime_id))
      .filter((a): a is Anime => !!a);
  }

  // ========== HISTORY ==========
  addHistory(userId: number, episodeId: number): void {
    this.history = this.history.filter(h => !(h.user_id === userId && h.episode_id === episodeId));
    this.history.push({ user_id: userId, episode_id: episodeId, watched_at: new Date().toISOString() });
  }

  getHistory(userId: number): { episode: Episode; anime: Anime; watched_at: string }[] {
    return this.history
      .filter(h => h.user_id === userId)
      .sort((a, b) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime())
      .slice(0, 30)
      .map(h => {
        const ep = this.getEpisode(h.episode_id);
        const an = ep ? this.getAnime(ep.anime_id) : undefined;
        if (!ep || !an) return null;
        return { episode: ep, anime: an, watched_at: h.watched_at };
      })
      .filter((x): x is { episode: Episode; anime: Anime; watched_at: string } => x !== null);
  }

  // ========== ADMIN ==========
  allUsers(): User[] {
    return this.users.map((u: any) => {
      const { password_hash, ...rest } = u;
      return rest as User;
    });
  }
}

function pickColor(seed: number): string {
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];
  return colors[seed % colors.length];
}

export const store = new Store();

// ============== HASH ==============
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + ':animeworld_salt_v1');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============== FILE -> DATA URL ==============
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}