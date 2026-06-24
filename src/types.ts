export interface User {
  id: number;
  username: string;
  avatarColor: string;
  isAdmin: boolean;
  canUpload: boolean;
  createdAt: string;
}

export interface Anime {
  id: number;
  title: string;
  description: string;
  poster: string;
  banner: string;
  genres: string[];
  year: number;
  ageRating: string;
  viewsCount: number;
  episodesCount: number;
  likesCount: number;
  dislikesCount: number;
  rating: number;
  ratingCount: number;
  createdAt: string;
}

export interface Episode {
  id: number;
  seasonId: number;
  episodeNumber: number;
  title: string;
  videoUrl: string;
  poster: string;
  viewsCount: number;
  createdAt: string;
}

export interface Comment {
  id: number;
  animeId: number;
  userId: number;
  episodeId: number | null;
  username: string;
  avatarColor: string;
  text: string;
  likes: number;
  likedByMe: boolean;
  createdAt: string;
}

export interface Season {
  id: number;
  animeId: number;
  seasonNumber: number;
  description: string;
  poster: string;
  createdAt: string;
}

export interface Favorite {
  id: number;
  title: string;
  poster: string;
  year: number;
  likesCount: number;
  rating: number;
}

export interface HistoryItem {
  id: number;
  episodeId: number;
  episodeTitle: string;
  animeTitle: string;
  animePoster: string;
  lastWatched: string;
  watchedSeconds: number;
}