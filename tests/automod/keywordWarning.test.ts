jest.mock('../../src/models/Warning', () => ({
  __esModule: true,
  default: {
    addWarning: jest.fn().mockResolvedValue({ warnings: [{ reason: 'test' }] }),
  },
}));

jest.mock('../../src/models/ModerationLog', () => ({
  __esModule: true,
  default: {
    logAction: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  logModAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/settingsCache', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

function makeMessage(content: string | null, overrides: Record<string, any> = {}) {
  return {
    content,
    id: 'msg1',
    author: {
      id: 'u1',
      username: 'testuser',
      send: jest.fn().mockResolvedValue(undefined),
    },
    channelId: 'ch1',
    channel: { id: 'ch1' },
    guild: {
      id: 'g1',
      name: 'Test Server',
      channels: { get: jest.fn().mockReturnValue(null) },
    },
    guildId: 'g1',
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeClient() {
  return {
    user: { id: 'bot1' },
    guilds: { fetch: jest.fn().mockResolvedValue(null) },
  };
}

describe('keywordWarning - check', () => {
  let keywordWarning: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    keywordWarning = require('../../src/automod/modules/keywordWarning').default;
  });

  test('returns false when keyword warnings are disabled', async () => {
    const settings = { keywordWarnings: { enabled: false, keywords: [{ pattern: 'bad' }] } };
    const result = await keywordWarning.check(makeMessage('bad word'), makeClient(), settings);
    expect(result).toBe(false);
  });

  test('returns false when no keywords are configured', async () => {
    const settings = { keywordWarnings: { enabled: true, keywords: [] } };
    const result = await keywordWarning.check(makeMessage('anything'), makeClient(), settings);
    expect(result).toBe(false);
  });

  test('returns false when settings are null', async () => {
    const result = await keywordWarning.check(makeMessage('test'), makeClient(), null);
    expect(result).toBe(false);
  });

  test('returns false when message has no content', async () => {
    const settings = { keywordWarnings: { enabled: true, keywords: [{ pattern: 'bad' }] } };
    const result = await keywordWarning.check(makeMessage(null), makeClient(), settings);
    expect(result).toBe(false);
  });

  test('returns false when no keywords match', async () => {
    const settings = {
      keywordWarnings: {
        enabled: true,
        keywords: [{ pattern: 'badword', isRegex: false }],
      },
    };
    const result = await keywordWarning.check(makeMessage('hello world'), makeClient(), settings);
    expect(result).toBe(false);
  });

  test('detects a plain-text keyword match (case insensitive)', async () => {
    const settings = {
      keywordWarnings: {
        enabled: true,
        action: 'delete+warn',
        keywords: [{ pattern: 'badword', isRegex: false }],
      },
    };
    const msg = makeMessage('this contains BADWORD in it');
    const client = makeClient();
    client.guilds.fetch = jest.fn().mockResolvedValue(msg.guild);

    const result = await keywordWarning.check(msg, client, settings);
    expect(result).toBe(true);
  });

  test('detects a regex keyword match', async () => {
    const settings = {
      keywordWarnings: {
        enabled: true,
        action: 'delete',
        keywords: [{ pattern: 'b[a4]d\\s?w[o0]rd', isRegex: true }],
      },
    };
    const msg = makeMessage('this has b4dword');
    const client = makeClient();
    client.guilds.fetch = jest.fn().mockResolvedValue(msg.guild);

    const result = await keywordWarning.check(msg, client, settings);
    expect(result).toBe(true);
  });

  test('handles invalid regex gracefully (no crash)', async () => {
    const settings = {
      keywordWarnings: {
        enabled: true,
        action: 'delete',
        keywords: [{ pattern: '[invalid', isRegex: true }],
      },
    };
    const result = await keywordWarning.check(makeMessage('test'), makeClient(), settings);
    expect(result).toBe(false);
  });

  test('delete action calls message.delete()', async () => {
    const settings = {
      keywordWarnings: {
        enabled: true,
        action: 'delete',
        keywords: [{ pattern: 'forbidden', isRegex: false }],
      },
    };
    const msg = makeMessage('this is forbidden');
    const client = makeClient();
    client.guilds.fetch = jest.fn().mockResolvedValue(msg.guild);

    await keywordWarning.check(msg, client, settings);
    expect(msg.delete).toHaveBeenCalled();
  });

  test('warn action sends DM to the author', async () => {
    const Warning = require('../../src/models/Warning').default;
    const settings = {
      keywordWarnings: {
        enabled: true,
        action: 'warn',
        keywords: [{ pattern: 'trigger', isRegex: false }],
      },
    };
    const msg = makeMessage('trigger word');
    const client = makeClient();
    client.guilds.fetch = jest.fn().mockResolvedValue(msg.guild);

    await keywordWarning.check(msg, client, settings);
    expect(Warning.addWarning).toHaveBeenCalledWith('g1', 'u1', 'bot1', expect.stringContaining('trigger'));
    expect(msg.author.send).toHaveBeenCalled();
  });

  test('delete+warn action both deletes and warns', async () => {
    const Warning = require('../../src/models/Warning').default;
    const settings = {
      keywordWarnings: {
        enabled: true,
        action: 'delete+warn',
        keywords: [{ pattern: 'nono', isRegex: false }],
      },
    };
    const msg = makeMessage('nono word here');
    const client = makeClient();
    client.guilds.fetch = jest.fn().mockResolvedValue(msg.guild);

    await keywordWarning.check(msg, client, settings);
    expect(msg.delete).toHaveBeenCalled();
    expect(Warning.addWarning).toHaveBeenCalled();
  });

  test('matches first keyword only', async () => {
    const settings = {
      keywordWarnings: {
        enabled: true,
        action: 'delete',
        keywords: [
          { pattern: 'first', isRegex: false },
          { pattern: 'second', isRegex: false },
        ],
      },
    };
    const msg = makeMessage('first and second');
    const client = makeClient();
    client.guilds.fetch = jest.fn().mockResolvedValue(msg.guild);

    const result = await keywordWarning.check(msg, client, settings);
    expect(result).toBe(true);
    expect(msg.delete).toHaveBeenCalledTimes(1);
  });
});
