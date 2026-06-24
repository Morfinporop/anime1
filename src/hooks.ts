// Утилиты для работы с изображениями

// Fallback баннер если нет своего
export const FALLBACK_BANNER = '/images/logov.png';

// Получение URL для баннера аниме
export function getAnimeBannerUrl(animeId: number): string {
  return `/api/files/anime/${animeId}/banner`;
}

// Получение URL для постера аниме
export function getAnimePosterUrl(animeId: number): string {
  return `/api/files/anime/${animeId}/poster`;
}

// Получение URL для постера сезона
export function getSeasonPosterUrl(seasonId: number): string {
  return `/api/files/season/${seasonId}/poster`;
}

// Получение URL для видео эпизода
export function getEpisodeVideoUrl(episodeId: number): string {
  return `/api/files/episode/${episodeId}/video`;
}

// Синхронная функция для получения URL баннера (для использования в рендере)
export function bannerUrl(animeId: number): string {
  return getAnimeBannerUrl(animeId);
}

// Асинхронная функция для получения URL баннера
export async function getBannerUrl(animeId: number): Promise<string> {
  // Просто возвращаем URL, проверка доступности будет происходить при загрузке изображения
  return getAnimeBannerUrl(animeId);
}