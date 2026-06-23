export interface User {
  id: number;
  username: string;
  avatar_color: string;
  is_admin?: boolean;
  can_upload?: boolean;
  isAdmin?: boolean;
  canUpload?: boolean;
  created_at: string;
}

export interface Anime {
  id: number;
  title: string;
  description: string;
  poster_mime?: string | null;
  banner_mime?: string | null;
  genres: string[];
  year: number;
  age_rating: string;
  type: 'season' | 'single' | 'movie';
  voiceovers: string[];
  subtitles: string[];
  likes_count: number;
  dislikes_count: number;
  views_count: number;
  rating?: number;
  created_by?: number;
  created_at: string;
}

export interface Season {
  id: number;
  anime_id: number;
  season_number: number;
  description: string;
  episodes_count: number;
  real_episodes_count?: number;
  poster_mime?: string | null;
}

export interface Episode {
  id: number;
  season_id: number;
  anime_id: number;
  episode_number: number;
  title: string;
  description: string;
  duration_seconds: number;
  size_bytes: number;
  voiceovers: string[];
  subtitles: string[];
  audio_tracks: { id: string; label: string; url?: string; lang?: string }[];
  quality_sources: Record<string, string>;
  views_count: number;
  video_mime?: string;
  created_at: string;
}

export interface Comment {
  id: number;
  anime_id: number;
  episode_id?: number;
  user_id: number;
  username: string;
  avatar_color: string;
  is_admin: boolean;
  text: string;
  likes: number;
  liked_by_me: boolean;
  created_at: string;
}

export interface HistoryItem {
  id: number;
  watched_at: string;
  episode_id: number;
  episode_number: number;
  episode_title: string;
  anime_id: number;
  anime_title: string;
  poster_mime?: string | null;
  type: string;
}

export type SortType = 'popular' | 'newest' | 'rating' | 'title';

export const QUALITY_LEVELS = ['144p', '240p', '360p', '480p', '720p', '1080p'] as const;
export type Quality = typeof QUALITY_LEVELS[number];