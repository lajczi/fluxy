export {};

function makeMessage(overrides: Record<string, any> = {}) {
  return {
    author: { id: 'u1', bot: false },
    guildId: 'g1',
    channelId: 'ch1',
    content: 'test',
    guild: {
      id: 'g1',
      members: {
        get: jest.fn().mockReturnValue({
          id: 'u1',
          permissions: { has: jest.fn().mockReturnValue(false) },
          roles: { roleIds: [] },
        }),
      },
    },
    channel: { id: 'ch1' },
    ...overrides,
  };
}

function makeClient() {
  return {
    guilds: {
      get: jest.fn().mockReturnValue(null),
      fetch: jest.fn().mockResolvedValue(null),
    },
  };
}

let automod: any, settingsCache: any, hasAnyPermission: any,
    antiLink: any, antiSpam: any, keywordWarning: any, ghostPing: any;

beforeEach(() => {
  jest.resetModules();

  jest.doMock('../../src/utils/settingsCache', () => ({
    __esModule: true,
    default: {
      get: jest.fn().mockResolvedValue({
        automod: {
          level: 'medium',
          antiSpam: true,
          antiLink: true,
          exemptChannels: [],
          exemptRoles: [],
        },
      }),
    },
  }));

  jest.doMock('../../src/utils/permissions', () => ({
    __esModule: true,
    hasAnyPermission: jest.fn().mockReturnValue(false),
  }));

  jest.doMock('../../src/automod/modules/antiLink', () => ({
    __esModule: true,
    default: {
      check: jest.fn().mockResolvedValue(false),
    },
  }));

  jest.doMock('../../src/automod/modules/antiSpam', () => ({
    __esModule: true,
    default: {
      check: jest.fn().mockResolvedValue(false),
    },
  }));

  jest.doMock('../../src/automod/modules/ghostPing', () => ({
    __esModule: true,
    default: {
      check: jest.fn().mockResolvedValue(false),
      storeMessage: jest.fn(),
    },
  }));

  jest.doMock('../../src/automod/modules/keywordWarning', () => ({
    __esModule: true,
    default: {
      check: jest.fn().mockResolvedValue(false),
    },
  }));

  automod = require('../../src/automod/index').default;
  settingsCache = require('../../src/utils/settingsCache').default;
  const perms = require('../../src/utils/permissions');
  hasAnyPermission = perms.hasAnyPermission;
  antiLink = require('../../src/automod/modules/antiLink').default;
  antiSpam = require('../../src/automod/modules/antiSpam').default;
  keywordWarning = require('../../src/automod/modules/keywordWarning').default;
  ghostPing = require('../../src/automod/modules/ghostPing').default;
});

describe('automod - check', () => {
  test('returns false for bot messages', async () => {
    const msg = makeMessage({ author: { id: 'bot1', bot: true } });
    const result = await automod.check(msg, makeClient());
    expect(result).toBe(false);
  });

  test('returns false for messages without a guildId', async () => {
    const msg = makeMessage({ guildId: null, guild: null });
    const result = await automod.check(msg, makeClient());
    expect(result).toBe(false);
  });

  test('returns false when no settings found', async () => {
    settingsCache.get.mockResolvedValue(null);
    const msg = makeMessage();
    const result = await automod.check(msg, makeClient());
    expect(result).toBe(false);
  });

  test('returns false for exempt channels', async () => {
    settingsCache.get.mockResolvedValue({
      automod: {
        level: 'medium',
        antiSpam: true,
        antiLink: true,
        exemptChannels: ['ch1'],
        exemptRoles: [],
      },
    });
    const msg = makeMessage();
    const result = await automod.check(msg, makeClient());
    expect(result).toBe(false);
    expect(antiSpam.check).not.toHaveBeenCalled();
    expect(antiLink.check).not.toHaveBeenCalled();
  });

  test('returns false for users with ManageMessages permission', async () => {
    hasAnyPermission.mockReturnValue(true);
    const msg = makeMessage();
    const result = await automod.check(msg, makeClient());
    expect(result).toBe(false);
  });

  test('returns false for users with exempt roles', async () => {
    settingsCache.get.mockResolvedValue({
      automod: {
        level: 'medium',
        antiSpam: true,
        antiLink: true,
        exemptChannels: [],
        exemptRoles: ['role123'],
      },
    });

    const msg = makeMessage();
    msg.guild.members.get.mockReturnValue({
      id: 'u1',
      permissions: { has: jest.fn().mockReturnValue(false) },
      roles: { roleIds: ['role123'] },
    });

    const result = await automod.check(msg, makeClient());
    expect(result).toBe(false);
  });

  test('runs antiSpam and antiLink when automod is enabled', async () => {
    const msg = makeMessage();
    await automod.check(msg, makeClient());
    expect(antiSpam.check).toHaveBeenCalled();
    expect(antiLink.check).toHaveBeenCalled();
  });

  test('returns true when antiSpam detects a violation', async () => {
    antiSpam.check.mockResolvedValue(true);
    const msg = makeMessage();
    const result = await automod.check(msg, makeClient());
    expect(result).toBe(true);
  });

  test('returns true when antiLink detects a violation', async () => {
    antiLink.check.mockResolvedValue(true);
    const msg = makeMessage();
    const result = await automod.check(msg, makeClient());
    expect(result).toBe(true);
  });

  test('returns true when keyword warning detects a violation', async () => {
    keywordWarning.check.mockResolvedValue(true);
    const msg = makeMessage();
    const result = await automod.check(msg, makeClient());
    expect(result).toBe(true);
  });

  test('does not run antiSpam/antiLink when automod level is off', async () => {
    settingsCache.get.mockResolvedValue({
      automod: {
        level: 'off',
        antiSpam: false,
        antiLink: false,
        exemptChannels: [],
        exemptRoles: [],
      },
    });

    const msg = makeMessage();
    await automod.check(msg, makeClient());
    expect(antiSpam.check).not.toHaveBeenCalled();
    expect(antiLink.check).not.toHaveBeenCalled();
  });

  test('still runs keyword warning even when automod level is off', async () => {
    settingsCache.get.mockResolvedValue({
      automod: {
        level: 'off',
        exemptChannels: [],
        exemptRoles: [],
      },
    });

    const msg = makeMessage();
    await automod.check(msg, makeClient());
    expect(keywordWarning.check).toHaveBeenCalled();
  });

  test('handles errors gracefully and returns false', async () => {
    settingsCache.get.mockRejectedValue(new Error('DB down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const msg = makeMessage();
    const result = await automod.check(msg, makeClient());
    expect(result).toBe(false);
    spy.mockRestore();
  });
});

describe('automod - handleGhostPing', () => {
  test('skips bot messages', async () => {
    const msg = makeMessage({ author: { id: 'bot1', bot: true } });
    await automod.handleGhostPing(msg, makeClient());
    expect(ghostPing.check).not.toHaveBeenCalled();
  });

  test('skips messages without guild', async () => {
    const msg = makeMessage({ guildId: null, guild: null });
    await automod.handleGhostPing(msg, makeClient());
    expect(ghostPing.check).not.toHaveBeenCalled();
  });

  test('calls ghostPing.check for valid guild messages', async () => {
    const msg = makeMessage();
    await automod.handleGhostPing(msg, makeClient());
    expect(ghostPing.check).toHaveBeenCalled();
  });

  test('skips exempt channels', async () => {
    settingsCache.get.mockResolvedValue({
      automod: { exemptChannels: ['ch1'] },
    });
    const msg = makeMessage();
    await automod.handleGhostPing(msg, makeClient());
    expect(ghostPing.check).not.toHaveBeenCalled();
  });
});
