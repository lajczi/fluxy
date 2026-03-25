describe('ghostPing - mention extraction', () => {
  let ghostPing: any;

  beforeEach(() => {
    jest.resetModules();
    ghostPing = require('../../src/automod/modules/ghostPing').default;
  });

  describe('extractUserMentions', () => {
    test('extracts a single user mention', () => {
      const mentions = ghostPing.extractUserMentions('hello <@123456789012345678>');
      expect(mentions).toEqual(['123456789012345678']);
    });

    test('extracts nickname-style mention <@!id>', () => {
      const mentions = ghostPing.extractUserMentions('hey <@!123456789012345678>');
      expect(mentions).toEqual(['123456789012345678']);
    });

    test('extracts multiple unique mentions', () => {
      const mentions = ghostPing.extractUserMentions('<@111111111111111111> <@222222222222222222>');
      expect(mentions).toContain('111111111111111111');
      expect(mentions).toContain('222222222222222222');
      expect(mentions).toHaveLength(2);
    });

    test('deduplicates repeated mentions', () => {
      const mentions = ghostPing.extractUserMentions('<@111111111111111111> <@111111111111111111>');
      expect(mentions).toEqual(['111111111111111111']);
    });

    test('detects @everyone', () => {
      const mentions = ghostPing.extractUserMentions('@everyone hello');
      expect(mentions).toContain('everyone');
    });

    test('detects @here', () => {
      const mentions = ghostPing.extractUserMentions('@here check this');
      expect(mentions).toContain('here');
    });

    test('returns empty array when no mentions', () => {
      const mentions = ghostPing.extractUserMentions('no mentions here');
      expect(mentions).toEqual([]);
    });

    test('returns empty array for empty string', () => {
      const mentions = ghostPing.extractUserMentions('');
      expect(mentions).toEqual([]);
    });
  });

  describe('extractRoleMentions', () => {
    test('extracts a role mention', () => {
      const mentions = ghostPing.extractRoleMentions('hello <@&999999999999999999>');
      expect(mentions).toEqual(['999999999999999999']);
    });

    test('extracts multiple unique role mentions', () => {
      const mentions = ghostPing.extractRoleMentions('<@&111111111111111111> <@&222222222222222222>');
      expect(mentions).toHaveLength(2);
    });

    test('deduplicates repeated role mentions', () => {
      const mentions = ghostPing.extractRoleMentions('<@&111111111111111111> <@&111111111111111111>');
      expect(mentions).toEqual(['111111111111111111']);
    });

    test('returns empty array when no role mentions', () => {
      const mentions = ghostPing.extractRoleMentions('no roles <@123456789012345678>');
      expect(mentions).toEqual([]);
    });
  });
});

describe('ghostPing - message caching', () => {
  let ghostPing: any;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    ghostPing = require('../../src/automod/modules/ghostPing').default;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('stores messages with mentions', () => {
    const msg = {
      id: 'msg1',
      content: 'hello <@123456789012345678>',
      author: { id: 'u1', bot: false },
      channelId: 'ch1',
      guildId: 'g1',
      channel: { id: 'ch1' },
      guild: { id: 'g1' },
    };

    ghostPing.storeMessage(msg);
    const cached = ghostPing.getCachedMessage('msg1');
    expect(cached).not.toBeNull();
    expect(cached.authorId).toBe('u1');
    expect(cached.userMentions).toContain('123456789012345678');
  });

  test('does not store messages without mentions', () => {
    const msg = {
      id: 'msg2',
      content: 'no mentions',
      author: { id: 'u1', bot: false },
      channelId: 'ch1',
      guildId: 'g1',
    };

    ghostPing.storeMessage(msg);
    expect(ghostPing.getCachedMessage('msg2')).toBeNull();
  });

  test('does not store messages from bots', () => {
    const msg = {
      id: 'msg3',
      content: '<@123456789012345678>',
      author: { id: 'bot1', bot: true },
      channelId: 'ch1',
      guildId: 'g1',
    };

    ghostPing.storeMessage(msg);
    expect(ghostPing.getCachedMessage('msg3')).toBeNull();
  });

  test('does not store messages with no content', () => {
    const msg = {
      id: 'msg4',
      content: null,
      author: { id: 'u1', bot: false },
    };

    ghostPing.storeMessage(msg);
    expect(ghostPing.getCachedMessage('msg4')).toBeNull();
  });

  test('expires cached messages after 30 seconds', () => {
    const msg = {
      id: 'msg5',
      content: '<@123456789012345678>',
      author: { id: 'u1', bot: false },
      channelId: 'ch1',
      guildId: 'g1',
    };

    ghostPing.storeMessage(msg);
    expect(ghostPing.getCachedMessage('msg5')).not.toBeNull();

    jest.advanceTimersByTime(31000);
    expect(ghostPing.getCachedMessage('msg5')).toBeNull();
  });

  test('clearCachedMessage removes an entry', () => {
    const msg = {
      id: 'msg6',
      content: '<@123456789012345678>',
      author: { id: 'u1', bot: false },
      channelId: 'ch1',
      guildId: 'g1',
    };

    ghostPing.storeMessage(msg);
    ghostPing.clearCachedMessage('msg6');
    expect(ghostPing.getCachedMessage('msg6')).toBeNull();
  });

  test('stores role mentions', () => {
    const msg = {
      id: 'msg7',
      content: '<@&999999999999999999>',
      author: { id: 'u1', bot: false },
      channelId: 'ch1',
      guildId: 'g1',
    };

    ghostPing.storeMessage(msg);
    const cached = ghostPing.getCachedMessage('msg7');
    expect(cached).not.toBeNull();
    expect(cached.roleMentions).toContain('999999999999999999');
  });
});
