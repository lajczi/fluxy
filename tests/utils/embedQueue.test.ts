export {};

const mockIsNetworkError = jest.fn();
jest.mock('../../src/utils/isNetworkError', () => ({ __esModule: true, default: mockIsNetworkError }));

let embedQueue: any;

beforeEach(() => {
  mockIsNetworkError.mockReset();
  mockIsNetworkError.mockReturnValue(false);
  jest.resetModules();
  jest.useFakeTimers();
  jest.mock('../../src/utils/isNetworkError', () => ({ __esModule: true, default: mockIsNetworkError }));
  embedQueue = require('../../src/utils/embedQueue');
});

afterEach(() => {
  jest.useRealTimers();
});

function makeMockChannel(sendImpl = jest.fn().mockResolvedValue({})) {
  return { send: sendImpl };
}

function makeMockClient({ channel = null, guild = null }: any = {}) {
  return {
    guilds: { get: jest.fn().mockReturnValue(guild) },
    channels: { fetch: jest.fn().mockResolvedValue(channel) },
  };
}

function makeMockGuild(channel: any) {
  return {
    channels: { get: jest.fn().mockReturnValue(channel) },
  };
}

const silenceLogs = () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  return () => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  };
};

describe('embedQueue.enqueue', () => {
  test('logs a message when an embed is queued', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    embedQueue.enqueue('g1', 'c1', { title: 'test' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Queued embed'));
    logSpy.mockRestore();
  });

  test('drops oldest entry and warns when queue reaches MAX_SIZE (500)', () => {
    const restore = silenceLogs();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    for (let i = 0; i < 500; i++) {
      embedQueue.enqueue(`g${i}`, `c${i}`, {});
    }
    embedQueue.enqueue('g_overflow', 'c_overflow', {});

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Queue full'));
    warnSpy.mockRestore();
    restore();
  });
});

describe('embedQueue.start + processQueue - success', () => {
  test('sends queued embed to the channel when processed', async () => {
    const restore = silenceLogs();
    const mockChannel = makeMockChannel();
    const mockGuild = makeMockGuild(mockChannel);
    const mockClient = makeMockClient({ guild: mockGuild });

    embedQueue.start(mockClient);
    embedQueue.enqueue('g1', 'c1', { title: 'hello' });

    await jest.advanceTimersByTimeAsync(30_000);

    expect(mockChannel.send).toHaveBeenCalledTimes(1);
    expect(mockChannel.send).toHaveBeenCalledWith({
      embeds: [{ title: 'hello' }],
    });
    restore();
  });

  test('successfully sent entry is removed from queue (not retried)', async () => {
    const restore = silenceLogs();
    const mockChannel = makeMockChannel();
    const mockGuild = makeMockGuild(mockChannel);
    const mockClient = makeMockClient({ guild: mockGuild });

    embedQueue.start(mockClient);
    embedQueue.enqueue('g1', 'c1', { title: 'once' });

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockChannel.send).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockChannel.send).toHaveBeenCalledTimes(1);
    restore();
  });

  test('fetches channel via client.channels.fetch when not in guild cache', async () => {
    const restore = silenceLogs();
    const mockChannel = makeMockChannel();
    const mockGuild = makeMockGuild(null);
    const mockClient = makeMockClient({ guild: mockGuild, channel: mockChannel });

    embedQueue.start(mockClient);
    embedQueue.enqueue('g1', 'c1', { title: 'fetched' });

    await jest.advanceTimersByTimeAsync(30_000);

    expect(mockClient.channels.fetch).toHaveBeenCalledWith('c1');
    expect(mockChannel.send).toHaveBeenCalledTimes(1);
    restore();
  });

  test('does nothing when client is not set (before start)', async () => {
    embedQueue.enqueue('g1', 'c1', {});
    await jest.advanceTimersByTimeAsync(30_000);
  });
});

describe('embedQueue.start + processQueue - guild/channel not found', () => {
  test('keeps entry in queue when guild is not found in client', async () => {
    const restore = silenceLogs();
    const mockClient = makeMockClient({ guild: null });

    embedQueue.start(mockClient);
    embedQueue.enqueue('g_missing', 'c1', { title: 'retry' });

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockClient.guilds.get).toHaveBeenCalledWith('g_missing');

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockClient.guilds.get).toHaveBeenCalledTimes(2);
    restore();
  });

  test('keeps entry when both guild cache and client.channels.fetch fail', async () => {
    const restore = silenceLogs();
    const mockGuild = makeMockGuild(null);
    const mockClient = {
      guilds: { get: jest.fn().mockReturnValue(mockGuild) },
      channels: { fetch: jest.fn().mockRejectedValue(new Error('not found')) },
    };

    embedQueue.start(mockClient);
    embedQueue.enqueue('g1', 'c_missing', { title: 'retry' });

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockClient.channels.fetch).toHaveBeenCalledWith('c_missing');

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockClient.channels.fetch).toHaveBeenCalledTimes(2);
    restore();
  });
});

describe('embedQueue.start + processQueue - send errors', () => {
  test('keeps entry in queue when send throws a network error', async () => {
    const restore = silenceLogs();
    const networkErr = new Error('ECONNRESET');
    const mockChannel = makeMockChannel(jest.fn().mockRejectedValue(networkErr));
    const mockGuild = makeMockGuild(mockChannel);
    const mockClient = makeMockClient({ guild: mockGuild });

    mockIsNetworkError.mockReturnValue(true);

    embedQueue.start(mockClient);
    embedQueue.enqueue('g1', 'c1', { title: 'net-error' });

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockChannel.send).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockChannel.send).toHaveBeenCalledTimes(2);
    restore();
  });

  test('drops entry when send throws a permanent (non-network) error', async () => {
    const restore = silenceLogs();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const permErr = new Error('Missing Permissions');
    const mockChannel = makeMockChannel(jest.fn().mockRejectedValue(permErr));
    const mockGuild = makeMockGuild(mockChannel);
    const mockClient = makeMockClient({ guild: mockGuild });

    mockIsNetworkError.mockReturnValue(false);

    embedQueue.start(mockClient);
    embedQueue.enqueue('g1', 'c1', { title: 'perm-error' });

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockChannel.send).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Permanent error'));

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockChannel.send).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
    restore();
  });
});

describe('embedQueue.start + processQueue - stale entry eviction', () => {
  test('drops embed that is older than MAX_AGE without ever fetching guild', async () => {
    const restore = silenceLogs();

    const t0 = Date.now();

    const mockClient = {
      guilds: { get: jest.fn() },
      channels: { fetch: jest.fn() },
    };

    embedQueue.start(mockClient);
    embedQueue.enqueue('g1', 'c1', { title: 'stale' });

    jest.setSystemTime(t0 + 61 * 60_000);

    await jest.advanceTimersByTimeAsync(30_000);

    expect(mockClient.guilds.get).not.toHaveBeenCalled();
    restore();
  });
});
