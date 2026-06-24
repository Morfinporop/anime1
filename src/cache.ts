// Простой in-memory кэш для данных API

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in ms
}

export class Cache<T> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) { // 5 минут по умолчанию
    this.defaultTTL = defaultTTL;
  }

  set(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };
    this.store.set(key, entry);
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  has(key: string): boolean {
    return !!this.get(key);
  }
}

// Экспортируем конкретные кэши
export const catalogCache = new Cache<any[]>(10 * 60 * 1000); // 10 минут
export const animeDetailCache = new Cache<any>(30 * 60 * 1000); // 30 минут
export const episodesCache = new Cache<any[]>(10 * 60 * 1000); // 10 минут
export const commentsCache = new Cache<any[]>(5 * 60 * 1000); // 5 минут
export const statsCache = new Cache<any>(10 * 60 * 1000); // 10 минут
export const userCache = new Cache<any>(5 * 60 * 1000); // 5 минут
export const favoritesCache = new Cache<number[]>(5 * 60 * 1000); // 5 минут