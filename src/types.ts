export interface User {
  id: number;
  username: string;
  role: 'user' | 'admin';
  can_upload: boolean;
  created_at: string;
}

export interface Anime {
  id: number;
  title: string;
  description: string;
  banner: string;
  type: 'season' | 'movie' | 'single';
  genres: string[];
  year: number;
  age_rating: string;
  created_at: string;
  views: number;
  likes: number;
  dislikes: number;
}

export interface QualitySource {
  quality: string;
  url: string;
}

export interface Episode {
  id: number;
  anime_id: number;
  season: number;
  episode_number: number;
  title: string;
  description: string;
  video_url: string;
  /** Разные качества одного и того же видео */
  quality_sources: Record<string, string>;
  audio_tracks: { id: string; label: string; url: string; lang: string }[];
  audio_label: string;
  duration: number;
  views: number;
  created_at: string;
}

export interface Comment {
  id: number;
  user_id: number;
  episode_id: number;
  content: string;
  username: string;
  avatar_color: string;
  likes: number;
  liked_by_me: boolean;
  created_at: string;
}

export interface Rating {
  id: number;
  user_id: number;
  episode_id: number;
  value: number;
}

export type SortType = 'popular' | 'newest' | 'rating' | 'title';

export const QUALITY_LEVELS = ['144p', '240p', '360p', '480p', '720p', '1080p'] as const;
export type Quality = typeof QUALITY_LEVELS[number];