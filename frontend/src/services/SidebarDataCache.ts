'use client';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize: number;
  maxEntries: number;
  ttl: number; // Time to live in milliseconds
  maxMemoryUsage: number; // Maximum memory usage in bytes
}

interface SidebarData {
  panelDetails: any;
  asbuiltData: any;
  rightNeighborPeek?: any;
  metadata: {
    panelId: string;
    projectId: string;
    lastUpdated: number;
    dataSize: number;
  };
}

class SidebarDataCache {
  private cache = new Map<string, CacheEntry<SidebarData>>();
  private config: CacheConfig;
  private memoryUsage = 0;
  private accessOrder: string[] = [];

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 50,
      maxEntries: 100,
      ttl: 15 * 60 * 1000, // 15 minutes
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      ...config,
    };
  }

  private getCacheKey(panelId: string, projectId: string): string {
    return `${projectId}:${panelId}`;
  }

  private isExpired(entry: CacheEntry<SidebarData>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private calculateDataSize(data: SidebarData): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate (2 bytes per char)
    } catch {
      return 0;
    }
  }

  private updateAccessOrder(key: string): void {
    // Remove from current position
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    // Add to end (most recently accessed)
    this.accessOrder.push(key);
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const keyToEvict = this.accessOrder[0];
    const entry = this.cache.get(keyToEvict);
    
    if (entry) {
      this.memoryUsage -= entry.data.metadata.dataSize;
      this.cache.delete(keyToEvict);
      this.accessOrder.shift();
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      const entry = this.cache.get(key);
      if (entry) {
        this.memoryUsage -= entry.data.metadata.dataSize;
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
          this.accessOrder.splice(index, 1);
        }
      }
    });
  }

  private ensureMemoryLimit(): void {
    // Clean up expired entries first
    this.cleanupExpired();

    // If still over limit, evict LRU entries
    while (
      (this.cache.size > this.config.maxEntries || this.memoryUsage > this.config.maxMemoryUsage) &&
      this.accessOrder.length > 0
    ) {
      this.evictLRU();
    }
  }

  set(panelId: string, projectId: string, data: SidebarData): void {
    const key = this.getCacheKey(panelId, projectId);
    const dataSize = this.calculateDataSize(data);
    
    // Update metadata
    data.metadata = {
      ...data.metadata,
      panelId,
      projectId,
      lastUpdated: Date.now(),
      dataSize,
    };

    const entry: CacheEntry<SidebarData> = {
      data,
      timestamp: Date.now(),
      ttl: this.config.ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    // Remove existing entry if it exists
    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.memoryUsage -= existingEntry.data.metadata.dataSize;
    }

    this.cache.set(key, entry);
    this.memoryUsage += dataSize;
    this.updateAccessOrder(key);

    this.ensureMemoryLimit();
  }

  get(panelId: string, projectId: string): SidebarData | null {
    const key = this.getCacheKey(panelId, projectId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.memoryUsage -= entry.data.metadata.dataSize;
      return null;
    }

    // Update access statistics
    entry.accessCount += 1;
    entry.lastAccessed = Date.now();
    this.updateAccessOrder(key);

    return entry.data;
  }

  has(panelId: string, projectId: string): boolean {
    const key = this.getCacheKey(panelId, projectId);
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  delete(panelId: string, projectId: string): boolean {
    const key = this.getCacheKey(panelId, projectId);
    const entry = this.cache.get(key);
    
    if (entry) {
      this.memoryUsage -= entry.data.metadata.dataSize;
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      return true;
    }
    
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.memoryUsage = 0;
  }

  getStats(): {
    size: number;
    memoryUsage: number;
    hitRate: number;
    averageAccessCount: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.cache.values());
    const totalAccessCount = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const timestamps = entries.map(entry => entry.timestamp);
    
    return {
      size: this.cache.size,
      memoryUsage: this.memoryUsage,
      hitRate: entries.length > 0 ? totalAccessCount / entries.length : 0,
      averageAccessCount: entries.length > 0 ? totalAccessCount / entries.length : 0,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }

  // Batch operations for efficiency
  setBatch(entries: Array<{ panelId: string; projectId: string; data: SidebarData }>): void {
    entries.forEach(({ panelId, projectId, data }) => {
      this.set(panelId, projectId, data);
    });
  }

  getBatch(requests: Array<{ panelId: string; projectId: string }>): Map<string, SidebarData | null> {
    const results = new Map<string, SidebarData | null>();
    
    requests.forEach(({ panelId, projectId }) => {
      const key = this.getCacheKey(panelId, projectId);
      const data = this.get(panelId, projectId);
      results.set(key, data);
    });
    
    return results;
  }

  // Preload data for better performance
  preload(panelIds: string[], projectId: string, dataFetcher: (panelId: string) => Promise<SidebarData>): Promise<void> {
    const promises = panelIds.map(async (panelId) => {
      if (!this.has(panelId, projectId)) {
        try {
          const data = await dataFetcher(panelId);
          this.set(panelId, projectId, data);
        } catch (error) {
          console.warn(`Failed to preload data for panel ${panelId}:`, error);
        }
      }
    });

    return Promise.all(promises).then(() => {});
  }

  // Cleanup old entries
  cleanup(): void {
    this.cleanupExpired();
  }

  // Get cache configuration
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  // Update cache configuration
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.ensureMemoryLimit();
  }
}

// Singleton instance
const sidebarDataCache = new SidebarDataCache();

// Production configuration
if (process.env.NODE_ENV === 'production') {
  sidebarDataCache.updateConfig({
    maxSize: 200,
    maxEntries: 500,
    ttl: 15 * 60 * 1000, // 15 minutes
    maxMemoryUsage: 200 * 1024 * 1024, // 200MB
  });
}

export default sidebarDataCache;
export { SidebarDataCache, type SidebarData, type CacheConfig };
