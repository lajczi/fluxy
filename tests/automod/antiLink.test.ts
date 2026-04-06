export {};

jest.mock('@erinjs/types', () => ({
  Routes: {
    channelMessage: (channelId: string, msgId: string) => `/channels/${channelId}/messages/${msgId}`,
  },
}));

let antiLink: any;
beforeEach(() => {
  jest.resetModules();
  antiLink = require('../../src/automod/modules/antiLink').default;
});

function makeMessage(content: string | null) {
  return {
    content,
    id: 'msg1',
    author: { id: 'u1' },
    channelId: 'ch1',
    channel: {
      id: 'ch1',
      send: jest.fn().mockResolvedValue({ delete: jest.fn().mockResolvedValue(undefined) }),
    },
    guild: {
      id: 'g1',
      channels: { get: jest.fn().mockReturnValue(null) },
    },
    guildId: 'g1',
  };
}

function makeClient() {
  return {
    rest: { delete: jest.fn().mockResolvedValue(undefined) },
    guilds: { fetch: jest.fn().mockResolvedValue(null) },
  };
}

describe('antiLink - check (detection)', () => {
  test('returns false for messages without links', async () => {
    const msg = makeMessage('hello world no links here');
    const result = await antiLink.check(msg, makeClient(), {}, {});
    expect(result).toBe(false);
  });

  test('returns false for empty content', async () => {
    const msg = makeMessage('');
    const result = await antiLink.check(msg, makeClient(), {}, {});
    expect(result).toBe(false);
  });

  test('returns false for null content', async () => {
    const msg = makeMessage(null);
    const result = await antiLink.check(msg, makeClient(), {}, {});
    expect(result).toBe(false);
  });

  test('returns true for messages with external links', async () => {
    const msg = makeMessage('check out https://evil-site.com/malware');
    const result = await antiLink.check(msg, makeClient(), {}, {});
    expect(result).toBe(true);
  });

  test('allows default whitelisted domains (fluxer.app)', async () => {
    const msg = makeMessage('join us at https://fluxer.app/invite/abc');
    const result = await antiLink.check(msg, makeClient(), {}, {});
    expect(result).toBe(false);
  });

  test('allows default whitelisted domains (discord.gg)', async () => {
    const msg = makeMessage('https://discord.gg/invite');
    const result = await antiLink.check(msg, makeClient(), {}, {});
    expect(result).toBe(false);
  });

  test('allows default whitelisted domains (discord.com)', async () => {
    const msg = makeMessage('https://discord.com/channels/123');
    const result = await antiLink.check(msg, makeClient(), {}, {});
    expect(result).toBe(false);
  });

  test('allows custom guild-configured domains', async () => {
    const settings = { automod: { allowedDomains: ['mysite.com'] } };
    const msg = makeMessage('https://mysite.com/page');
    const result = await antiLink.check(msg, makeClient(), settings, {});
    expect(result).toBe(false);
  });

  test('blocks external links even when guild domains are configured', async () => {
    const settings = { automod: { allowedDomains: ['mysite.com'] } };
    const msg = makeMessage('https://badsite.org/phish');
    const result = await antiLink.check(msg, makeClient(), settings, {});
    expect(result).toBe(true);
  });

  test('detects multiple links (some allowed, some blocked)', async () => {
    const msg = makeMessage('https://fluxer.app/ok https://badsite.org/nope');
    const result = await antiLink.check(msg, makeClient(), {}, {});
    expect(result).toBe(true);
  });

  test('returns false when all links are from allowed domains', async () => {
    const msg = makeMessage('https://fluxer.app/a https://fluxer.gg/b https://discord.com/c');
    const result = await antiLink.check(msg, makeClient(), {}, {});
    expect(result).toBe(false);
  });

  test('domain matching is case-insensitive', async () => {
    const msg = makeMessage('https://FLUXER.APP/page');
    const result = await antiLink.check(msg, makeClient(), {}, {});
    expect(result).toBe(false);
  });
});

describe('antiLink - execute (actions)', () => {
  test('deletes the offending message', async () => {
    const msg = makeMessage('https://evil.com');
    const client = makeClient();
    await antiLink.check(msg, client, {}, {});
    expect(client.rest.delete).toHaveBeenCalledWith('/channels/ch1/messages/msg1');
  });

  test('sends a warning to the channel', async () => {
    const msg = makeMessage('https://evil.com');
    await antiLink.check(msg, makeClient(), {}, {});
    expect(msg.channel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('No external links'),
      }),
    );
  });
});
