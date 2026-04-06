jest.mock('../../src/models/GuildSettings', () => ({
  findOne: jest.fn(),
  getOrCreate: jest.fn(),
}));

const GuildSettings = require('../../src/models/GuildSettings');
import { SettingsCache } from '../../src/utils/settingsCache';

function mockFindOneResolve(value: any) {
  GuildSettings.findOne.mockReturnValueOnce({
    lean: jest.fn().mockResolvedValueOnce(value),
  });
}

function mockFindOneReject(err: Error) {
  GuildSettings.findOne.mockReturnValueOnce({
    lean: jest.fn().mockRejectedValueOnce(err),
  });
}

let cache: SettingsCache;

beforeEach(() => {
  jest.clearAllMocks();
  cache = new SettingsCache();
});

afterEach(() => {
  cache.destroy();
});

describe('SettingsCache.get', () => {
  test('fetches from DB on first access (cache miss)', async () => {
    const settings = { guildId: 'g1', logChannelId: 'c1' };
    mockFindOneResolve(settings);

    const result = await cache.get('g1');

    expect(GuildSettings.findOne).toHaveBeenCalledTimes(1);
    expect(GuildSettings.findOne).toHaveBeenCalledWith({ guildId: 'g1' });
    expect(result).toEqual(settings);
  });

  test('returns cached value on second access (cache hit)', async () => {
    const settings = { guildId: 'g1', logChannelId: 'c1' };
    mockFindOneResolve(settings);

    await cache.get('g1');
    await cache.get('g1');

    expect(GuildSettings.findOne).toHaveBeenCalledTimes(1);
  });

  test('returns null when DB returns null', async () => {
    mockFindOneResolve(null);

    const result = await cache.get('g_nonexistent');

    expect(result).toBeNull();
  });

  test('returns null when DB throws', async () => {
    mockFindOneReject(new Error('DB down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await cache.get('g_error');

    expect(result).toBeNull();
    spy.mockRestore();
  });

  test('bypasses cache when cache is disabled', async () => {
    const settings = { guildId: 'g1' };
    GuildSettings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(settings),
    });

    cache.disable();
    await cache.get('g1');
    await cache.get('g1');

    expect(GuildSettings.findOne).toHaveBeenCalledTimes(2);
  });
});

describe('SettingsCache.invalidate', () => {
  test('forces re-fetch from DB after invalidation', async () => {
    const settings = { guildId: 'g1' };
    GuildSettings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(settings),
    });

    await cache.get('g1');
    cache.invalidate('g1');
    await cache.get('g1');

    expect(GuildSettings.findOne).toHaveBeenCalledTimes(2);
  });
});

describe('SettingsCache.invalidateAll', () => {
  test('clears all entries', async () => {
    const settings = { guildId: 'gX' };
    GuildSettings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(settings),
    });

    await cache.get('gA');
    await cache.get('gB');
    cache.invalidateAll();
    await cache.get('gA');

    expect(GuildSettings.findOne).toHaveBeenCalledTimes(3);
  });
});

describe('SettingsCache.set', () => {
  test('manually setting populates the cache', async () => {
    const settings = { guildId: 'g_manual', foo: 'bar' } as any;
    cache.set('g_manual', settings);

    const result = await cache.get('g_manual');

    expect(GuildSettings.findOne).not.toHaveBeenCalled();
    expect(result).toEqual(settings);
  });
});

describe('SettingsCache.getStats', () => {
  test('reports correct total entries and enabled status', async () => {
    mockFindOneResolve({ guildId: 'g1' });
    await cache.get('g1');

    const stats = cache.getStats();
    expect(stats.enabled).toBe(true);
    expect(stats.totalEntries).toBe(1);
    expect(stats.validEntries).toBe(1);
    expect(stats.expiredEntries).toBe(0);
  });
});

describe('SettingsCache.enable / disable', () => {
  test('disabling clears the cache', async () => {
    mockFindOneResolve({ guildId: 'g1' });
    await cache.get('g1');

    cache.disable();
    expect(cache.getStats().totalEntries).toBe(0);
    expect(cache.getStats().enabled).toBe(false);
  });

  test('re-enabling allows caching again', async () => {
    GuildSettings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ guildId: 'g1' }),
    });

    cache.disable();
    cache.enable();
    await cache.get('g1');
    await cache.get('g1');

    expect(GuildSettings.findOne).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsCache.update', () => {
  test('invalidates entry and re-fetches from DB, returning updated settings', async () => {
    const original = { guildId: 'g1', logChannelId: 'old' };
    const updated = { guildId: 'g1', logChannelId: 'newChannel' };

    mockFindOneResolve(original);
    await cache.get('g1');

    mockFindOneResolve(updated);
    const result = await cache.update('g1');

    expect(result).toEqual(updated);
    expect(GuildSettings.findOne).toHaveBeenCalledTimes(2);
  });

  test('caches the updated value so the next get does not hit DB again', async () => {
    const updated = { guildId: 'g_upd', foo: 'bar' };
    mockFindOneResolve(updated);
    await cache.update('g_upd');

    const result = await cache.get('g_upd');
    expect(result).toEqual(updated);
    expect(GuildSettings.findOne).toHaveBeenCalledTimes(1);
  });

  test('returns null when DB returns null during update', async () => {
    mockFindOneResolve(null);
    const result = await cache.update('g_none');
    expect(result).toBeNull();
  });
});

describe('SettingsCache.getOrCreate', () => {
  test('returns cached settings without calling GuildSettings.getOrCreate', async () => {
    const settings = { guildId: 'g_cached' };
    mockFindOneResolve(settings);
    await cache.get('g_cached');

    const result = await cache.getOrCreate('g_cached');
    expect(result).toEqual(settings);
    expect(GuildSettings.getOrCreate).not.toHaveBeenCalled();
  });

  test('calls GuildSettings.getOrCreate when there is no cached entry', async () => {
    const created = { guildId: 'g_new', toObject: () => ({ guildId: 'g_new' }) };
    mockFindOneResolve(null);
    GuildSettings.getOrCreate.mockResolvedValueOnce(created);

    const result = await cache.getOrCreate('g_new');

    expect(GuildSettings.getOrCreate).toHaveBeenCalledWith('g_new');
    expect(result).toEqual({ guildId: 'g_new' });
  });

  test('caches created settings so subsequent get does not hit DB', async () => {
    const created = { guildId: 'g_c2', toObject: () => ({ guildId: 'g_c2' }) };
    mockFindOneResolve(null);
    GuildSettings.getOrCreate.mockResolvedValueOnce(created);
    await cache.getOrCreate('g_c2');

    const result = await cache.get('g_c2');
    expect(result).toEqual({ guildId: 'g_c2' });
    expect(GuildSettings.findOne).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsCache.evictOldest', () => {
  test('removes entries when called (evicts oldest-timestamped first)', () => {
    for (let i = 0; i < 10; i++) {
      cache.set(`guild_${i}`, { guildId: `guild_${i}` } as any);
    }
    expect(cache.getStats().totalEntries).toBe(10);

    (cache as any).evictOldest();

    expect(cache.getStats().totalEntries).toBe(0);
  });
});

describe('SettingsCache.set - evicts at MAX_CACHE_SIZE (1000)', () => {
  test('calls evictOldest when the cache is full', () => {
    const spy = jest.spyOn(cache as any, 'evictOldest');

    for (let i = 0; i < 1000; i++) {
      (cache as any).cache.set(`g${i}`, {
        data: {},
        timestamp: Date.now() - i,
        isExpired: () => false,
      });
    }

    cache.set('g_trigger', { guildId: 'g_trigger' } as any);

    expect(spy).toHaveBeenCalledTimes(1);
    (spy as any).mockRestore();
  });
});

describe('SettingsCache.cleanup', () => {
  test('removes expired entries', async () => {
    mockFindOneResolve({ guildId: 'g_exp' });
    await cache.get('g_exp');
    expect(cache.getStats().totalEntries).toBe(1);

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 20 * 60 * 1000);

    (cache as any).cleanup();

    expect(cache.getStats().totalEntries).toBe(0);
    jest.spyOn(Date, 'now').mockRestore();
  });

  test('leaves non-expired entries untouched', async () => {
    mockFindOneResolve({ guildId: 'g_live' });
    await cache.get('g_live');

    (cache as any).cleanup();

    expect(cache.getStats().totalEntries).toBe(1);
  });
});

describe('SettingsCache.getStats - expired entry branch', () => {
  test('counts expired entries in expiredEntries stat', async () => {
    mockFindOneResolve({ guildId: 'g_stat' });
    await cache.get('g_stat');

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 20 * 60 * 1000);

    const stats = cache.getStats();
    expect(stats.totalEntries).toBe(1);
    expect(stats.expiredEntries).toBe(1);
    expect(stats.validEntries).toBe(0);
    jest.spyOn(Date, 'now').mockRestore();
  });
});

describe('SettingsCache.get - expired cache entry', () => {
  test('re-fetches from DB when a cached entry has expired', async () => {
    const original = { guildId: 'g_refetch', v: 1 };
    const refreshed = { guildId: 'g_refetch', v: 2 };

    mockFindOneResolve(original);
    await cache.get('g_refetch');

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 20 * 60 * 1000);

    mockFindOneResolve(refreshed);
    const result = await cache.get('g_refetch');

    expect(result).toEqual(refreshed);
    expect(GuildSettings.findOne).toHaveBeenCalledTimes(2);
    jest.spyOn(Date, 'now').mockRestore();
  });
});

describe('SettingsCache - cleanup interval callback', () => {
  test('cleanup is called when the 60-second setInterval fires', () => {
    jest.useFakeTimers();
    const localCache = new SettingsCache();
    const spy = jest.spyOn(localCache as any, 'cleanup');

    jest.advanceTimersByTime(60_000);

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    localCache.destroy();
    jest.useRealTimers();
  });
});
