/**
 * LRU In-Memory Cache with Strict Size & Memory Caps
 * Prevents Out-Of-Memory (OOM) exploits by limiting max entries and enforcing TTL eviction.
 */

export interface CacheEntry<T> {
  data: T;
  createdAt: number;
}

export class LRUCache<T> {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private cache: Map<string, CacheEntry<T>>;

  constructor(maxEntries: number = 1000, ttlMs: number = 60 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.cache = new Map<string, CacheEntry<T>>();
  }

  public get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order (delete & re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  public set(key: string, data: T): void {
    // If exists, delete first to refresh position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (first item in map iteration)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { data, createdAt: Date.now() });
  }

  public size(): number {
    return this.cache.size;
  }

  public clear(): void {
    this.cache.clear();
  }
}
