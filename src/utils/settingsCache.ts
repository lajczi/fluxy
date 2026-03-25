/**
 * settings cacher
 */

import GuildSettings from '../models/GuildSettings';
import type { IGuildSettings } from '../types';

const CACHE_TTL = 15 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;

class CacheEntry {
  data: IGuildSettings;
  timestamp: number;
  expiresAt: number;

  constructor(data: IGuildSettings) {
    this.data = data;
    this.timestamp = Date.now();
    this.expiresAt = Date.now() + CACHE_TTL;
  }

  isExpired(): boolean {
    return Date.now() > this.expiresAt;
  }
}


export class SettingsCache {
  private cache = new Map<string, CacheEntry>();
  private enabled = true;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
    // Prevent this interval from keeping Node/Jest alive.
    // (Node timers support `.unref()`, browsers don't.)
    (this.cleanupInterval as any)?.unref?.();
  }

  async get(guildId: string): Promise<IGuildSettings | null> {
    if (!this.enabled) {
      return this.getFromDatabase(guildId);
    }

    const cached = this.cache.get(guildId);

    if (cached && !cached.isExpired()) {
      return cached.data;
    }

    const settings = await this.getFromDatabase(guildId);

    if (settings) {
      this.set(guildId, settings);
    }

    return settings;
  }

  async getFromDatabase(guildId: string): Promise<IGuildSettings | null> {
    try {
      const settings = await GuildSettings.findOne({ guildId }).lean();
      return settings as IGuildSettings | null;
    } catch (error) {
      console.error(`Error fetching settings for guild ${guildId}:`, error);
      return null;
    }
  }


  set(guildId: string, settings: IGuildSettings): void {
    if (!this.enabled) return;

    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    this.cache.set(guildId, new CacheEntry(settings));
  }

  invalidate(guildId: string): void {
    this.cache.delete(guildId);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  async update(guildId: string): Promise<IGuildSettings | null> {
    this.invalidate(guildId);

    const settings = await GuildSettings.findOne({ guildId }).lean();
    if (settings) {
      this.set(guildId, settings as IGuildSettings);
    }

    return settings as IGuildSettings | null;
  }

  async getOrCreate(guildId: string): Promise<IGuildSettings> {
    const cached = await this.get(guildId);

    if (cached) {
      return cached;
    }

    const settings = await GuildSettings.getOrCreate(guildId);
    const obj = settings.toObject() as IGuildSettings;
    this.set(guildId, obj);

    return obj;
  }

  private evictOldest(): void {
    const entriesToRemove = Math.ceil(MAX_CACHE_SIZE * 0.1);
    const entries = Array.from(this.cache.entries());

    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  private cleanup(): void {
    for (const [guildId, entry] of this.cache.entries()) {
      if (entry.isExpired()) {
        this.cache.delete(guildId);
      }
    }
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
    this.cache.clear();
  }

  getStats(): { enabled: boolean; totalEntries: number; validEntries: number; expiredEntries: number; maxSize: number; ttlMs: number } {
    let expired = 0;
    let valid = 0;

    for (const entry of this.cache.values()) {
      if (entry.isExpired()) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      enabled: this.enabled,
      totalEntries: this.cache.size,
      validEntries: valid,
      expiredEntries: expired,
      maxSize: MAX_CACHE_SIZE,
      ttlMs: CACHE_TTL,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

const settingsCache = new SettingsCache();

export default settingsCache;
