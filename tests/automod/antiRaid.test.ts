export {};

import antiRaid, {
  normalizeContent,
  trackRaidMessage,
  isActiveRaid,
  clearRaidState,
  DEFAULT_USER_THRESHOLD,
  DEFAULT_TIME_WINDOW,
  RaidEntry,
} from '../../src/automod/modules/antiRaid';


describe('normalizeContent', () => {
  test('lowercases content', () => {
    expect(normalizeContent('HELLO WORLD')).toBe('hello world');
  });

  test('strips bracket-wrapped noise tokens', () => {
    expect(normalizeContent('@everyone fuck you [1ansgj]')).toBe('@everyone fuck you');
    expect(normalizeContent('@everyone fuck you [1aikjbag5]')).toBe('@everyone fuck you');
  });

  test('strips parenthesis-wrapped noise tokens', () => {
    expect(normalizeContent('spam message (abc123)')).toBe('spam message');
  });

  test('two messages with different tokens normalize to the same string', () => {
    const a = normalizeContent('@everyone join our server [xkj19a]');
    const b = normalizeContent('@everyone join our server [zz8812b]');
    expect(a).toBe(b);
  });

  test('collapses multiple spaces', () => {
    expect(normalizeContent('hello   world')).toBe('hello world');
  });

  test('trims leading and trailing whitespace', () => {
    expect(normalizeContent('  hello  ')).toBe('hello');
  });

  test('returns empty string for content made entirely of noise', () => {
    expect(normalizeContent('[abc123]')).toBe('');
  });
});


function makeEntry(userId: string, overrides: Partial<RaidEntry> = {}): RaidEntry {
  return { userId, messageId: `msg-${userId}`, channelId: 'c1', timestamp: Date.now(), ...overrides };
}

describe('trackRaidMessage', () => {
  const guildId = 'g-track-test';
  const normalized = 'test spam content';
  const window = DEFAULT_TIME_WINDOW;
  const threshold = DEFAULT_USER_THRESHOLD;

  beforeEach(() => clearRaidState(guildId));

  test('isRaid is false when fewer than threshold users send similar content', () => {
    for (let i = 0; i < threshold - 1; i++) {
      const { isRaid } = trackRaidMessage(guildId, normalized, makeEntry(`u${i}`), window, threshold);
      expect(isRaid).toBe(false);
    }
  });

  test('isRaid is true when threshold users have sent similar content', () => {
    for (let i = 0; i < threshold - 1; i++) {
      trackRaidMessage(guildId, normalized, makeEntry(`u${i}`), window, threshold);
    }
    const { isRaid } = trackRaidMessage(guildId, normalized, makeEntry(`u-last`), window, threshold);
    expect(isRaid).toBe(true);
  });

  test('newRaid is true on first trigger, false on second trigger', () => {
    for (let i = 0; i < threshold; i++) {
      trackRaidMessage(guildId, normalized, makeEntry(`u${i}`), window, threshold);
    }
    const first = trackRaidMessage(guildId, normalized, makeEntry('u-extra-1'), window, threshold);
    expect(first.newRaid).toBe(false);

    clearRaidState(guildId);
    for (let i = 0; i < threshold - 1; i++) {
      trackRaidMessage(guildId, normalized, makeEntry(`u${i}`), window, threshold);
    }
    const { newRaid: firstTrigger } = trackRaidMessage(guildId, normalized, makeEntry('u-trigger'), window, threshold);
    expect(firstTrigger).toBe(true);
    const { newRaid: secondTrigger } = trackRaidMessage(guildId, normalized, makeEntry('u-extra'), window, threshold);
    expect(secondTrigger).toBe(false);
  });

  test('entries outside the time window are excluded', () => {
    const staleEntry = makeEntry('u-stale', { timestamp: Date.now() - window - 1000 });
    trackRaidMessage(guildId, normalized, staleEntry, window, threshold);

    for (let i = 0; i < threshold - 1; i++) {
      const { isRaid } = trackRaidMessage(guildId, normalized, makeEntry(`u${i}`), window, threshold);
      if (i < threshold - 2) expect(isRaid).toBe(false);
    }
  });

  test('same user sending multiple messages only counts as one unique user', () => {
    const sameUser = 'u-repeat';
    for (let i = 0; i < threshold + 2; i++) {
      const { isRaid } = trackRaidMessage(
        guildId, normalized, makeEntry(sameUser, { messageId: `msg-${i}` }), window, threshold
      );
      expect(isRaid).toBe(false);
    }
  });

  test('allEntries contains all valid entries', () => {
    for (let i = 0; i < threshold; i++) {
      trackRaidMessage(guildId, normalized, makeEntry(`u${i}`), window, threshold);
    }
    const { allEntries } = trackRaidMessage(guildId, normalized, makeEntry('u-extra'), window, threshold);
    expect(allEntries.length).toBe(threshold + 1);
  });
});


describe('isActiveRaid', () => {
  const guildId = 'g-active-test';
  const normalized = 'active raid content';
  const window = DEFAULT_TIME_WINDOW;
  const threshold = DEFAULT_USER_THRESHOLD;

  beforeEach(() => clearRaidState(guildId));

  test('returns false before a raid is triggered', () => {
    expect(isActiveRaid(guildId, normalized)).toBe(false);
  });

  test('returns true after a raid is triggered', () => {
    for (let i = 0; i < threshold; i++) {
      trackRaidMessage(guildId, normalized, makeEntry(`u${i}`), window, threshold);
    }
    expect(isActiveRaid(guildId, normalized)).toBe(true);
  });
});


jest.mock('../../src/utils/isNetworkError', () => ({ __esModule: true, default: jest.fn().mockReturnValue(false) }));
jest.mock('../../src/utils/embedQueue', () => ({ enqueue: jest.fn() }));

function makeMessage(userId: string, content: string, overrides: any = {}) {
  return {
    author: { id: userId },
    id: `msg-${userId}-${Math.random()}`,
    content,
    guildId: 'g-check-test',
    channelId: 'c-check',
    guild: { id: 'g-check-test', channels: { get: jest.fn().mockReturnValue(null) } },
    ...overrides,
  };
}

function makeSettings(overrides: any = {}) {
  return { automod: { raid: {} }, ...overrides };
}

function makeClient() {
  return {
    guilds: { get: jest.fn() },
    channels: { fetch: jest.fn() },
    rest: { delete: jest.fn().mockResolvedValue({}) },
  };
}

describe('antiRaid.check', () => {
  beforeEach(() => clearRaidState('g-check-test'));

  test('returns false when content is too short after normalization', async () => {
    const result = await antiRaid.check(makeMessage('u1', '[abc]'), makeClient(), makeSettings());
    expect(result).toBe(false);
  });

  test('returns false when fewer than threshold users send similar content', async () => {
    const client = makeClient();
    const settings = makeSettings();
    for (let i = 0; i < DEFAULT_USER_THRESHOLD - 1; i++) {
      const result = await antiRaid.check(
        makeMessage(`u${i}`, `@everyone free nitro [noise${i}]`),
        client,
        settings
      );
      expect(result).toBe(false);
    }
  });

  test('returns true and deletes messages when threshold is hit', async () => {
    const client = makeClient();
    const settings = makeSettings();

    for (let i = 0; i < DEFAULT_USER_THRESHOLD - 1; i++) {
      await antiRaid.check(makeMessage(`u${i}`, `@everyone free nitro [token${i}]`), client, settings);
    }
    const result = await antiRaid.check(
      makeMessage('u-trigger', '@everyone free nitro [tokenlast]'),
      client,
      settings
    );
    expect(result).toBe(true);
    expect(client.rest.delete).toHaveBeenCalled();
  });

  test('returns false when message has no content', async () => {
    const msg = makeMessage('u1', '');
    const result = await antiRaid.check(msg, makeClient(), makeSettings());
    expect(result).toBe(false);
  });

  test('returns true for subsequent messages matching an active raid pattern', async () => {
    const client = makeClient();
    const settings = makeSettings();

    for (let i = 0; i < DEFAULT_USER_THRESHOLD; i++) {
      await antiRaid.check(makeMessage(`u${i}`, `buy followers [junk${i}]`), client, settings);
    }

    const result = await antiRaid.check(
      makeMessage('u-late', 'buy followers [different_junk]'),
      client,
      settings
    );
    expect(result).toBe(true);
  });

  test('different normalized content in the same guild does not cross-trigger', async () => {
    const client = makeClient();
    const settings = makeSettings();

    for (let i = 0; i < DEFAULT_USER_THRESHOLD - 1; i++) {
      await antiRaid.check(makeMessage(`u${i}`, `message one [x${i}]`), client, settings);
    }
    const result = await antiRaid.check(
      makeMessage('u-other', 'totally different message here'),
      client,
      settings
    );
    expect(result).toBe(false);
  });
});
