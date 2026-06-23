// Хелперы для URL-ов картинок (постеры/баннеры хранятся как BYTEA в БД)
// Через cache, чтобы не загружать байты каждый раз

const imageCache = new Map<string, string>();

export function getCachedImage(key: string): string | undefined {
  return imageCache.get(key);
}

export function setCachedImage(key: string, url: string) {
  imageCache.set(key, url);
}

export function clearImageCache() {
  imageCache.clear();
}

// Если у аниме есть poster_mime/banner_mime, нужно загрузить байты отдельным эндпоинтом
// Здесь мы предполагаем, что бэкенд отдаёт картинки через /api/anime/:id/poster
export function posterUrl(animeId: number): string {
  return `/api/anime/${animeId}/poster`;
}

export function bannerUrl(animeId: number): string {
  return `/api/anime/${animeId}/banner`;
}

export function seasonPosterUrl(seasonId: number): string {
  return `/api/seasons/${seasonId}/poster`;
}

// Fallback если нет постера — градиент
export const FALLBACK_BANNER = 'https://img.magnific.com/free-photo/anime-style-cozy-home-interior-with-furnishings_23-2151176465.jpg?semt=ais_hybrid&w=1400&q=80';