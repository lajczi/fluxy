'use strict';

jest.mock('@erinjs/core', () => ({
  PermissionFlags: {
    Administrator: 0x8n,
    ManageGuild: 0x20n,
    ManageChannels: 0x10n,
  },
}));

jest.mock('../../src/utils/settingsCache', () => ({
  get: jest.fn(),
}));

import settingsCache from '../../src/utils/settingsCache';
import slowmodeCmd from '../../src/commands/moderation/slowmode';

const slowmode = slowmodeCmd as any;
const settingsCacheMock = settingsCache as any;

function makeMember(id: string, permBigInt: bigint, roleIds: string[] = []) {
  return {
    id,
    permissions: {
      has: (flag: bigint) => (permBigInt & flag) === flag,
    },
    roles: { roleIds },
  };
}

function makeMessage(member: any, guild: any, channelRateLimit = 0) {
  const replies: any[] = [];
  return {
    author: { id: member.id },
    guild,
    channel: {
      rateLimitPerUser: channelRateLimit,
      edit: jest.fn().mockResolvedValue({}),
    },
    reply: jest.fn((text: any) => {
      replies.push(text);
      return Promise.resolve();
    }),
    _replies: replies,
  };
}

function makeGuild(members: Record<string, any> = {}) {
  return {
    id: '1234567890123456789',
    name: 'Test Server',
    members: {
      get: (id: string) => members[id] || null,
    },
    fetchMember: jest.fn((id: string) => Promise.resolve(members[id] || null)),
  };
}

describe('slowmode command permission checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settingsCacheMock.get.mockResolvedValue({ slowmodeAllowedRoles: [] });
  });

  test('user with ManageChannels can use slowmode', async () => {
    const member = makeMember('user1', 0x10n);
    const guild = makeGuild({ user1: member });
    const msg = makeMessage(member, guild);

    await slowmode.execute(msg, [], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('disabled'));
  });

  test('user with Administrator can use slowmode', async () => {
    const member = makeMember('user1', 0x8n);
    const guild = makeGuild({ user1: member });
    const msg = makeMessage(member, guild);

    await slowmode.execute(msg, [], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('disabled'));
  });

  test('user with ManageGuild can use slowmode', async () => {
    const member = makeMember('user1', 0x20n);
    const guild = makeGuild({ user1: member });
    const msg = makeMessage(member, guild);

    await slowmode.execute(msg, [], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('disabled'));
  });

  test('user with allowed role can use slowmode', async () => {
    const member = makeMember('user1', 0x0n, ['mod-role-id']);
    const guild = makeGuild({ user1: member });
    const msg = makeMessage(member, guild);

    settingsCacheMock.get.mockResolvedValue({
      slowmodeAllowedRoles: ['mod-role-id'],
    });

    await slowmode.execute(msg, [], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('disabled'));
  });

  test('user without ManageChannels and no allowed role is denied', async () => {
    const member = makeMember('user1', 0x0n, ['regular-role']);
    const guild = makeGuild({ user1: member });
    const msg = makeMessage(member, guild);

    settingsCacheMock.get.mockResolvedValue({
      slowmodeAllowedRoles: ['mod-role-id'],
    });

    await slowmode.execute(msg, [], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Manage Channels'));
  });

  test('user without perms and empty allowlist is denied', async () => {
    const member = makeMember('user1', 0x0n);
    const guild = makeGuild({ user1: member });
    const msg = makeMessage(member, guild);

    settingsCacheMock.get.mockResolvedValue({
      slowmodeAllowedRoles: [],
    });

    await slowmode.execute(msg, [], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Manage Channels'));
  });
});

describe('slowmode command functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settingsCacheMock.get.mockResolvedValue({ slowmodeAllowedRoles: [] });
  });

  test('no args shows current slowmode when enabled', async () => {
    const member = makeMember('user1', 0x10n);
    const guild = makeGuild({ user1: member });
    const msg = makeMessage(member, guild, 30);

    await slowmode.execute(msg, [], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('30'));
  });

  test('"off" disables slowmode', async () => {
    const member = makeMember('user1', 0x10n);
    const guild = makeGuild({ user1: member });
    const msg = makeMessage(member, guild);

    await slowmode.execute(msg, ['off'], null);

    expect(msg.channel.edit).toHaveBeenCalledWith({ rate_limit_per_user: 0 });
    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('disabled'));
  });

  test('invalid duration returns error', async () => {
    const member = makeMember('user1', 0x10n);
    const guild = makeGuild({ user1: member });
    const msg = makeMessage(member, guild);

    await slowmode.execute(msg, ['abc'], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid duration'));
  });
});
