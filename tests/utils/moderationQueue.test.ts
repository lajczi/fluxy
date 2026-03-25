export {};

jest.mock('fs');

const mockIsNetworkError = jest.fn().mockReturnValue(false);
jest.mock('../../src/utils/isNetworkError', () => ({ __esModule: true, default: mockIsNetworkError }));

const fs = require('fs');

fs.existsSync.mockReturnValue(false);
fs.mkdirSync.mockReturnValue(undefined);
fs.writeFileSync.mockReturnValue(undefined);

let moderationQueue: any;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  mockIsNetworkError.mockReturnValue(false);
  jest.doMock('fs');
  jest.doMock('../../src/utils/isNetworkError', () => ({ __esModule: true, default: mockIsNetworkError }));
  const freshFs = require('fs');
  freshFs.existsSync.mockReturnValue(false);
  freshFs.mkdirSync.mockReturnValue(undefined);
  freshFs.writeFileSync.mockReturnValue(undefined);
  moderationQueue = require('../../src/utils/moderationQueue');
});

describe('enqueue', () => {
  test('adds an entry and persists to disk', () => {
    const freshFs = require('fs');
    moderationQueue.enqueue('g1', 'u1', 'ban', { reason: 'test' });
    expect(freshFs.writeFileSync).toHaveBeenCalledTimes(1);
  });

  test('does not add duplicate entries (same guild + target + action)', () => {
    const freshFs = require('fs');
    moderationQueue.enqueue('g1', 'u1', 'ban', { reason: 'test' });
    moderationQueue.enqueue('g1', 'u1', 'ban', { reason: 'test2' });
    expect(freshFs.writeFileSync).toHaveBeenCalledTimes(1);
  });

  test('allows different actions for same user', () => {
    const freshFs = require('fs');
    moderationQueue.enqueue('g1', 'u1', 'ban', { reason: 'test' });
    moderationQueue.enqueue('g1', 'u1', 'timeout', { durationMs: 600000 });
    expect(freshFs.writeFileSync).toHaveBeenCalledTimes(2);
  });

  test('allows same action for different users', () => {
    const freshFs = require('fs');
    moderationQueue.enqueue('g1', 'u1', 'ban');
    moderationQueue.enqueue('g1', 'u2', 'ban');
    expect(freshFs.writeFileSync).toHaveBeenCalledTimes(2);
  });

  test('drops oldest when queue is full (200)', () => {
    const freshFs = require('fs');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 200; i++) {
      moderationQueue.enqueue('g1', `u${i}`, 'ban');
    }
    moderationQueue.enqueue('g1', 'u999', 'ban');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Queue full'));
    warnSpy.mockRestore();
  });
});

describe('start + processQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('loads queue from disk on start', () => {
    const freshFs = require('fs');
    freshFs.existsSync.mockReturnValue(true);
    freshFs.readFileSync.mockReturnValue(JSON.stringify([
      { guildId: 'g1', targetId: 'u1', action: 'ban', params: {}, addedAt: Date.now() }
    ]));

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockClient = { guilds: { get: jest.fn().mockReturnValue(null) } };

    moderationQueue.start(mockClient);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded 1 pending'));
    logSpy.mockRestore();
  });

  test('processes ban by calling guild.ban', async () => {
    const mockGuild = {
      name: 'Test',
      ban: jest.fn().mockResolvedValue(undefined),
      kick: jest.fn().mockResolvedValue(undefined),
    };
    const mockClient = { guilds: { get: jest.fn().mockReturnValue(mockGuild) } };

    moderationQueue.start(mockClient);
    moderationQueue.enqueue('g1', 'u1', 'ban', { reason: 'Honeypot', deleteDays: 1 });

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockGuild.ban).toHaveBeenCalledWith('u1', {
      reason: 'Honeypot',
      delete_message_days: 1
    });
  });

  test('processes kick by calling guild.kick', async () => {
    const mockGuild = {
      name: 'Test',
      ban: jest.fn().mockResolvedValue(undefined),
      kick: jest.fn().mockResolvedValue(undefined),
    };
    const mockClient = { guilds: { get: jest.fn().mockReturnValue(mockGuild) } };

    moderationQueue.start(mockClient);
    moderationQueue.enqueue('g1', 'u1', 'kick', { reason: 'Test kick' });

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockGuild.kick).toHaveBeenCalledWith('u1', 'Test kick');
  });

  test('processes timeout by calling member.edit', async () => {
    const mockMember = { edit: jest.fn().mockResolvedValue(undefined) };
    const mockGuild = {
      name: 'Test',
      members: { get: jest.fn().mockReturnValue(mockMember) },
      fetchMember: jest.fn().mockResolvedValue(mockMember),
    };
    const mockClient = { guilds: { get: jest.fn().mockReturnValue(mockGuild) } };

    moderationQueue.start(mockClient);
    moderationQueue.enqueue('g1', 'u1', 'timeout', { durationMs: 600000, reason: 'Spam' });

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockMember.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout_reason: 'Spam'
      })
    );
  });

  test('keeps entry on network error and retries', async () => {
    jest.resetModules();
    jest.doMock('fs');
    jest.doMock('../../src/utils/isNetworkError', () => ({ __esModule: true, default: () => true }));
    const freshFs = require('fs');
    freshFs.existsSync.mockReturnValue(false);
    freshFs.mkdirSync.mockReturnValue(undefined);
    freshFs.writeFileSync.mockReturnValue(undefined);
    const mq = require('../../src/utils/moderationQueue');

    const networkErr = new Error('ECONNRESET');
    const mockGuild = {
      name: 'Test',
      ban: jest.fn().mockRejectedValue(networkErr),
    };
    const mockClient = { guilds: { get: jest.fn().mockReturnValue(mockGuild) } };

    mq.start(mockClient);
    mq.enqueue('g1', 'u1', 'ban');

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockGuild.ban).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockGuild.ban).toHaveBeenCalledTimes(2);
  });

  test('drops entry on permanent error', async () => {
    jest.resetModules();
    jest.doMock('fs');
    jest.doMock('../../src/utils/isNetworkError', () => ({ __esModule: true, default: () => false }));
    const freshFs = require('fs');
    freshFs.existsSync.mockReturnValue(false);
    freshFs.mkdirSync.mockReturnValue(undefined);
    freshFs.writeFileSync.mockReturnValue(undefined);
    const mq = require('../../src/utils/moderationQueue');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const mockGuild = {
      name: 'Test',
      ban: jest.fn().mockRejectedValue(new Error('Missing Permissions')),
    };
    const mockClient = { guilds: { get: jest.fn().mockReturnValue(mockGuild) } };

    mq.start(mockClient);
    mq.enqueue('g1', 'u1', 'ban');

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockGuild.ban).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockGuild.ban).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  test('drops stale entries older than 24h', async () => {
    jest.resetModules();
    jest.mock('fs');
    const fs2 = require('fs');
    fs2.existsSync.mockReturnValue(true);
    fs2.readFileSync.mockReturnValue(JSON.stringify([
      { guildId: 'g1', targetId: 'u1', action: 'ban', params: {}, addedAt: Date.now() - 25 * 60 * 60 * 1000 }
    ]));
    fs2.mkdirSync.mockReturnValue(undefined);
    fs2.writeFileSync.mockReturnValue(undefined);
    const mq = require('../../src/utils/moderationQueue');

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockClient = { guilds: { get: jest.fn().mockReturnValue({ name: 'Test', ban: jest.fn() }) } };

    mq.start(mockClient);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Dropping stale'));
    logSpy.mockRestore();
  });
});
