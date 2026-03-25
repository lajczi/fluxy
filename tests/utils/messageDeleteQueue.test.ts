export {};

jest.mock('@fluxerjs/types', () => ({
  Routes: {
    channelMessage: (channelId: string, messageId: string) => `/channels/${channelId}/messages/${messageId}`,
  },
}));

const mockIsNetworkError = jest.fn().mockReturnValue(false);
jest.mock('../../src/utils/isNetworkError', () => ({ __esModule: true, default: mockIsNetworkError }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  mockIsNetworkError.mockReturnValue(false);
  jest.mock('../../src/utils/isNetworkError', () => ({ __esModule: true, default: mockIsNetworkError }));
});

describe('enqueue', () => {
  test('adds an entry', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mdq = require('../../src/utils/messageDeleteQueue');
    mdq.enqueue('c1', 'm1');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Queued delete'));
    logSpy.mockRestore();
  });

  test('does not add duplicate entries', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mdq = require('../../src/utils/messageDeleteQueue');
    mdq.enqueue('c1', 'm1');
    mdq.enqueue('c1', 'm1');
    expect(logSpy).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });

  test('allows different messages in same channel', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mdq = require('../../src/utils/messageDeleteQueue');
    mdq.enqueue('c1', 'm1');
    mdq.enqueue('c1', 'm2');
    expect(logSpy).toHaveBeenCalledTimes(2);
    logSpy.mockRestore();
  });

  test('drops oldest when queue is full (200)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const mdq = require('../../src/utils/messageDeleteQueue');
    for (let i = 0; i < 200; i++) {
      mdq.enqueue('c1', `m${i}`);
    }
    mdq.enqueue('c1', 'm999');
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

  test('processes entries by calling client.rest.delete', async () => {
    const mdq = require('../../src/utils/messageDeleteQueue');
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const mockClient = {
      rest: { delete: jest.fn().mockResolvedValue(undefined) },
    };

    mdq.start(mockClient);
    mdq.enqueue('c1', 'm1');

    await jest.advanceTimersByTimeAsync(15_000);
    expect(mockClient.rest.delete).toHaveBeenCalledWith('/channels/c1/messages/m1');
  });

  test('keeps entry on network error and retries', async () => {
    mockIsNetworkError.mockReturnValue(true);
    const mdq = require('../../src/utils/messageDeleteQueue');
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const networkErr = new Error('ECONNRESET');
    const mockClient = {
      rest: { delete: jest.fn().mockRejectedValue(networkErr) },
    };

    mdq.start(mockClient);
    mdq.enqueue('c1', 'm1');

    await jest.advanceTimersByTimeAsync(15_000);
    expect(mockClient.rest.delete).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(15_000);
    expect(mockClient.rest.delete).toHaveBeenCalledTimes(2);
  });

  test('drops entry on permanent (non-network) error', async () => {
    mockIsNetworkError.mockReturnValue(false);
    const mdq = require('../../src/utils/messageDeleteQueue');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const permErr: any = new Error('Missing Permissions');
    permErr.status = 403;
    const mockClient = {
      rest: { delete: jest.fn().mockRejectedValue(permErr) },
    };

    mdq.start(mockClient);
    mdq.enqueue('c1', 'm1');

    await jest.advanceTimersByTimeAsync(15_000);
    expect(mockClient.rest.delete).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Permanent error'));

    await jest.advanceTimersByTimeAsync(15_000);
    expect(mockClient.rest.delete).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  test('silently drops 404 errors (already deleted)', async () => {
    mockIsNetworkError.mockReturnValue(false);
    const mdq = require('../../src/utils/messageDeleteQueue');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const notFoundErr: any = new Error('Unknown Message');
    notFoundErr.status = 404;
    const mockClient = {
      rest: { delete: jest.fn().mockRejectedValue(notFoundErr) },
    };

    mdq.start(mockClient);
    mdq.enqueue('c1', 'm1');

    await jest.advanceTimersByTimeAsync(15_000);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('drops stale entries older than 10 minutes', async () => {
    const mdq = require('../../src/utils/messageDeleteQueue');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const mockClient = {
      rest: { delete: jest.fn().mockResolvedValue(undefined) },
    };

    mdq.start(mockClient);
    mdq.enqueue('c1', 'm1');

    jest.advanceTimersByTime(11 * 60_000);

    await jest.advanceTimersByTimeAsync(15_000);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Dropping stale'));
    logSpy.mockRestore();
  });
});
