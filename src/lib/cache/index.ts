// Multi-level caching system for improved performance
import { createClient } from '@supabase/supabase-js';

export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  tags?: string[];
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  tags?: string[]; // Cache tags for invalidation
  maxSize?: number; // Maximum number of entries
}

export class CacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private supabaseCache: SupabaseCache;
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes
  private readonly maxMemorySize = 1000;
  private readonly tagIndex = new Map<string, Set<string>>(); // tag -> cache keys

  constructor() {
    this.supabaseCache = new SupabaseCache();
  }

  /**
   * Get a value from cache, checking memory first, then Supabase
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Check memory cache first
      const memoryResult = this.memoryCache.get(key);
      if (memoryResult && !this.isExpired(memoryResult)) {
        this.log('info', `Cache hit in memory: ${key}`);
        return memoryResult.value;
      }

      // Remove expired entry from memory
      if (memoryResult && this.isExpired(memoryResult)) {
        this.memoryCache.delete(key);
        this.removeFromTagIndex(key, memoryResult.tags);
      }

      // Check Supabase cache
      const supabaseResult = await this.supabaseCache.get(key);
      if (supabaseResult && !this.isExpired(supabaseResult)) {
        // Store in memory cache for faster access
        this.setInMemory(key, supabaseResult.value, supabaseResult.ttl, supabaseResult.tags || []);
        this.log('info', `Cache hit in Supabase: ${key}`);
        return supabaseResult.value;
      }

      this.log('info', `Cache miss: ${key}`);
      return null;
    } catch (error) {
      this.log('error', `Error getting from cache: ${key}`, error);
      return null;
    }
  }

  /**
   * Set a value in cache, storing in both memory and Supabase
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.defaultTTL;
      const tags = options.tags || [];

      // Store in memory cache
      this.setInMemory(key, value, ttl, tags);

      // Store in Supabase cache (async, don't wait)
      this.supabaseCache.set(key, value, ttl, tags).catch(error => {
        this.log('error', `Failed to store in Supabase cache: ${key}`, error);
      });

      this.log('info', `Cached: ${key}`, { ttl, tags });
    } catch (error) {
      this.log('error', `Error setting cache: ${key}`, error);
    }
  }

  /**
   * Delete a specific key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      // Remove from memory cache
      const entry = this.memoryCache.get(key);
      if (entry) {
        this.memoryCache.delete(key);
        this.removeFromTagIndex(key, entry.tags);
      }

      // Remove from Supabase cache
      await this.supabaseCache.delete(key);

      this.log('info', `Deleted from cache: ${key}`);
    } catch (error) {
      this.log('error', `Error deleting from cache: ${key}`, error);
    }
  }

  /**
   * Invalidate all cache entries with specific tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      const keysToDelete = new Set<string>();

      // Find all keys that match any of the tags
      tags.forEach(tag => {
        const keys = this.tagIndex.get(tag);
        if (keys) {
          keys.forEach(key => keysToDelete.add(key));
        }
      });

      // Delete all matching keys
      for (const key of keysToDelete) {
        await this.delete(key);
      }

      this.log('info', `Invalidated cache by tags: ${tags.join(', ')}`, { count: keysToDelete.size });
    } catch (error) {
      this.log('error', `Error invalidating cache by tags: ${tags.join(', ')}`, error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      this.tagIndex.clear();
      await this.supabaseCache.clear();

      this.log('info', 'Cache cleared');
    } catch (error) {
      this.log('error', 'Error clearing cache', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    memoryHits: number;
    supabaseHits: number;
    totalHits: number;
  } {
    return {
      memorySize: this.memoryCache.size,
      memoryHits: this.supabaseCache.stats.memoryHits,
      supabaseHits: this.supabaseCache.stats.supabaseHits,
      totalHits: this.supabaseCache.stats.memoryHits + this.supabaseCache.stats.supabaseHits
    };
  }

  /**
   * Clean up expired entries and enforce size limits
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Find expired entries
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    expiredKeys.forEach(key => {
      const entry = this.memoryCache.get(key);
      if (entry) {
        this.memoryCache.delete(key);
        this.removeFromTagIndex(key, entry.tags);
      }
    });

    // Enforce size limit if needed
    if (this.memoryCache.size > this.maxMemorySize) {
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.memoryCache.size - this.maxMemorySize);
      toRemove.forEach(([key, entry]) => {
        this.memoryCache.delete(key);
        this.removeFromTagIndex(key, entry.tags);
      });
    }

    if (expiredKeys.length > 0) {
      this.log('info', `Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  private setInMemory<T>(key: string, value: T, ttl: number, tags: string[]): void {
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl,
      tags
    };

    this.memoryCache.set(key, entry);
    this.addToTagIndex(key, tags);

    // Schedule cleanup if cache is getting large
    if (this.memoryCache.size > this.maxMemorySize * 0.8) {
      setTimeout(() => this.cleanup(), 1000);
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private addToTagIndex(key: string, tags: string[]): void {
    tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    });
  }

  private removeFromTagIndex(key: string, tags?: string[]): void {
    if (!tags) return;
    
    tags.forEach(tag => {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    });
  }

  private log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logData = { timestamp, level, message, ...(data && { data }) };
    
    switch (level) {
      case 'info':
        console.log(`[${timestamp}] CACHE INFO: ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`[${timestamp}] CACHE WARN: ${message}`, data || '');
        break;
      case 'error':
        console.error(`[${timestamp}] CACHE ERROR: ${message}`, data || '');
        break;
    }
  }
}

/**
 * Supabase-based cache for persistent storage
 */
class SupabaseCache {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  public stats = {
    memoryHits: 0,
    supabaseHits: 0
  };

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const { data, error } = await this.supabase
        .from('cache_entries')
        .select('*')
        .eq('cache_key', key)
        .single();

      if (error || !data) {
        return null;
      }

      this.stats.supabaseHits++;
      return {
        value: data.cache_value,
        timestamp: new Date(data.created_at).getTime(),
        ttl: data.ttl,
        tags: data.tags || []
      };
    } catch (error) {
      console.warn('Supabase cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number, tags: string[]): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('cache_entries')
        .upsert({
          cache_key: key,
          cache_value: value,
          ttl,
          tags,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.warn('Supabase cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.supabase
        .from('cache_entries')
        .delete()
        .eq('cache_key', key);
    } catch (error) {
      console.warn('Supabase cache delete error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.supabase
        .from('cache_entries')
        .delete()
        .neq('cache_key', ''); // Delete all entries
    } catch (error) {
      console.warn('Supabase cache clear error:', error);
    }
  }
}

// Create singleton instance
export const cacheManager = new CacheManager();

// Cache decorator for methods
export function Cached(ttl: number = 5 * 60 * 1000, tags: string[] = []) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Execute method and cache result
      const result = await method.apply(this, args);
      await cacheManager.set(cacheKey, result, { ttl, tags });
      
      return result;
    };
  };
}
