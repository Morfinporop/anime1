interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class Cache<T> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTL;
  }

  set(key: string, data: T, ttl?: number): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
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

  read(id?: number): T | null {
    const key = id !== undefined ? String(id) : '__default__';
    return this.get(key);
  }

  write(dataOrId: T | number, data?: T): void {
    if (data !== undefined) {
      this.set(String(dataOrId as number), data);
    } else {
      this.set('__default__', dataOrId as T);
    }
  }

  isFresh(id?: number): boolean {
    const key = id !== undefined ? String(id) : '__default__';
    const entry = this.store.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp < entry.ttl;
  }
}

export const catalogCache     = new Cache<any[]>(10 * 60 * 1000);
export const animeDetailCache = new Cache<any>(30 * 60 * 1000);
export const episodesCache    = new Cache<any[]>(10 * 60 * 1000);
export const commentsCache    = new Cache<any[]>(5  * 60 * 1000);
export const statsCache       = new Cache<any>(10 * 60 * 1000);
export const userCache        = new Cache<any>(5  * 60 * 1000);
export const favoritesCache   = new Cache<number[]>(5 * 60 * 1000);
