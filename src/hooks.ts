// Утилиты для работы с изображениями

// Fallback баннер если нет своего
export const FALLBACK_BANNER = '/images/logov.png';

// Простая функция для проверки наличия изображения
export function checkImageExists(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
    
    // Таймаут на случай очень медленной загрузки
    setTimeout(() => resolve(false), 2000);
  });
}

// Получение URL баннера с проверкой
export async function getBannerUrl(banner?: string, poster?: string): Promise<string> {
  if (banner && banner.startsWith('/uploads/')) {
    const exists = await checkImageExists(banner);
    if (exists) return banner;
  }
  
  if (poster && poster.startsWith('/uploads/')) {
    const exists = await checkImageExists(poster);
    if (exists) return poster;
  }
  
  return FALLBACK_BANNER;
}