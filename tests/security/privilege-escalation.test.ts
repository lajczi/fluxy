const IDS = {
  guild:      '10000000000000001',
  attacker:   '10000000000000002',
  owner:      '10000000000000003',
  bot:        '10000000000000004',
  admin:      '10000000000000005',
  lowUser:    '10000000000000006',
  adminRole:  '20000000000000001',
  modRole:    '20000000000000002',
  memberRole: '20000000000000003',
  botRole:    '20000000000000004',
  channel:    '30000000000000001',
  message:    '40000000000000001',
};

jest.mock('@fluxerjs/core', () => ({
  PermissionFlags: {
    Administrator: 0x8n,
    BanMembers: 0x4n,
    KickMembers: 0x2n,
    ManageGuild: 0x20n,
    ManageMessages: 0x2000n,
    ManageRoles: 0x10000000n,
    ModerateMembers: 0x10000000000n,
    SendMessages: 0x800n,
    AddReactions: 0x40n,
  },
  EmbedBuilder: class {
    setTitle() { return this; }
    setColor() { return this; }
    setDescription() { return this; }
    addFields() { return this; }
    setTimestamp() { return this; }
    setThumbnail() { return this; }
    setFooter() { return this; }
  },
}));

jest.mock('../../src/utils/isNetworkError', () => ({
  __esModule: true,
  default: () => false,
}));
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  logModAction: jest.fn().mockResolvedValue(undefined),
  logAutomodAction: jest.fn().mockResolvedValue(undefined),
  logToChannel: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/utils/settingsCache', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({}),
    invalidate: jest.fn(),
  },
}));
jest.mock('../../src/models/ModerationLog', () => ({
  __esModule: true,
  default: {
    logAction: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/models/Warning', () => ({
  __esModule: true,
  default: {
    addWarning: jest.fn().mockResolvedValue({ warnings: [{}] }),
    getUserWarnings: jest.fn().mockResolvedValue({ warnings: [] }),
    clearWarnings: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/models/GuildSettings', () => ({
  __esModule: true,
  default: {
    getOrCreate: jest.fn().mockResolvedValue({
      honeypotChannels: [],
      reactionRoles: [],
      autoroleId: null,
      save: jest.fn().mockResolvedValue(undefined),
      markModified: jest.fn(),
    }),
    findOne: jest.fn().mockResolvedValue(null),
    updateSetting: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/models/LockdownState', () => ({
  __esModule: true,
  default: {
    getOrCreate: jest.fn().mockResolvedValue({
      active: false,
      save: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));
jest.mock('../../src/config', () => ({
  __esModule: true,
  default: {
    prefix: '!',
    ownerId: '10000000000000003',
    cooldown: { default: 0 },
  },
}));

function makeRole(id: string, name: string, position: number) {
  return { id, name, position };
}

function makeGuild(ownerId: string, roleMap: Record<string, { name?: string; position?: number }> = {}) {
  const rolesMap = new Map<string, any>();
  for (const [id, info] of Object.entries(roleMap)) {
    rolesMap.set(id, makeRole(id, info.name || id, info.position || 0));
  }

  return {
    id: IDS.guild,
    name: 'Test Guild',
    ownerId,
    roles: {
      get: (id: string) => rolesMap.get(id),
      values: () => rolesMap.values(),
    },
    members: {
      get: jest.fn(),
      fetch: jest.fn().mockResolvedValue([]),
    },
    channels: {
      get: jest.fn().mockReturnValue(null),
      values: () => ([] as any[]).values(),
    },
    fetchRole: jest.fn((id: string) => {
      const r = rolesMap.get(id);
      if (r) return Promise.resolve(r);
      return Promise.reject(new Error('Unknown Role'));
    }),
    fetchMember: jest.fn(),
    fetchChannels: jest.fn().mockResolvedValue([]),
    ban: jest.fn().mockResolvedValue(undefined),
    kick: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMember(id: string, permBigInt: bigint, roleIds: string[], guild: any) {
  return {
    id,
    user: { id, username: `User${id}` },
    permissions: { has: (flag: bigint) => (permBigInt & flag) === flag },
    roles: { roleIds },
    guild,
    edit: jest.fn().mockResolvedValue(undefined),
    addRole: jest.fn().mockResolvedValue(undefined),
    removeRole: jest.fn().mockResolvedValue(undefined),
    communicationDisabledUntil: null,
  };
}

function makeMessage({ authorId, guild, guildId, channelId }: { authorId: string; guild: any; guildId?: string; channelId?: string }) {
  const replies: string[] = [];
  return {
    author: { id: authorId, username: `User${authorId}`, send: jest.fn().mockResolvedValue(undefined) },
    guild,
    guildId: guildId || guild?.id || IDS.guild,
    channelId: channelId || IDS.channel,
    channel: {
      id: channelId || IDS.channel,
      send: jest.fn().mockResolvedValue({ delete: jest.fn() }),
    },
    reply: jest.fn((content: any) => {
      replies.push(typeof content === 'string' ? content : JSON.stringify(content));
      return Promise.resolve({ edit: jest.fn(), delete: jest.fn() });
    }),
    delete: jest.fn().mockResolvedValue(undefined),
    content: '',
    _replies: replies,
  };
}

function makeClient() {
  return {
    user: { id: IDS.bot },
    guilds: {
      get: jest.fn().mockReturnValue(null),
      fetch: jest.fn().mockResolvedValue(null),
    },
    users: {
      fetch: jest.fn().mockResolvedValue({ id: '10000000000000099', username: 'SomeUser' }),
      createDM: jest.fn().mockResolvedValue({ send: jest.fn() }),
    },
    channels: {
      fetch: jest.fn().mockResolvedValue(null),
    },
    resolveEmoji: jest.fn().mockResolvedValue('✅'),
  };
}

const ROLE_MAP = {
  [IDS.adminRole]:  { name: 'Admin',  position: 10 },
  [IDS.modRole]:    { name: 'Mod',    position: 5 },
  [IDS.memberRole]: { name: 'Member', position: 1 },
  [IDS.botRole]:    { name: 'Bot',    position: 15 },
};

function setupScenario() {
  const guild = makeGuild(IDS.owner, ROLE_MAP);

  const attacker = makeMember(IDS.attacker, 0x10000000n, [IDS.modRole], guild);
  const owner    = makeMember(IDS.owner, 0x8n, [IDS.adminRole], guild);
  const admin    = makeMember(IDS.admin, 0x8n, [IDS.adminRole], guild);
  const lowUser  = makeMember(IDS.lowUser, 0x0n, [IDS.memberRole], guild);
  const botUser  = makeMember(IDS.bot, 0x8n, [IDS.botRole], guild);

  guild.members.get.mockImplementation((id: string) => {
    if (id === IDS.attacker) return attacker;
    if (id === IDS.owner) return owner;
    if (id === IDS.admin) return admin;
    if (id === IDS.lowUser) return lowUser;
    if (id === IDS.bot) return botUser;
    return null;
  });
  guild.fetchMember.mockImplementation((id: string) => {
    const m = guild.members.get(id);
    return m ? Promise.resolve(m) : Promise.reject(new Error('Unknown Member'));
  });

  return { guild, attacker, owner, admin, lowUser };
}

describe('PRIVILEGE ESCALATION - !roleall', () => {
  const roleall = require('../../src/commands/admin/roleall').default;

  test('BLOCKS: mod (pos 5) tries to roleall Admin (pos 10)', async () => {
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await roleall.execute(msg, [IDS.adminRole], makeClient());
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('cannot manage the **Admin** role')
    );
  });

  test('BLOCKS: mod tries to roleall a role at equal position', async () => {
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await roleall.execute(msg, [IDS.modRole], makeClient());
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('cannot manage the **Mod** role')
    );
  });

  test('ALLOWS: mod assigns a role below their position', async () => {
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await roleall.execute(msg, [IDS.memberRole], makeClient());
    const blocked = msg._replies.some(r => r.includes('cannot manage'));
    expect(blocked).toBe(false);
  });

  test('ALLOWS: guild owner bypasses hierarchy for any role', async () => {
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.owner, guild });
    await roleall.execute(msg, [IDS.adminRole], makeClient());
    const blocked = msg._replies.some(r => r.includes('cannot manage'));
    expect(blocked).toBe(false);
  });
});

describe('PRIVILEGE ESCALATION - !roleclear', () => {
  const roleclear = require('../../src/commands/admin/roleclear').default;

  test('BLOCKS: mod (pos 5) tries to roleclear Admin (pos 10)', async () => {
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await roleclear.execute(msg, [IDS.adminRole], makeClient());
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('cannot manage the **Admin** role')
    );
  });

  test('ALLOWS: mod removes a role below their position', async () => {
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await roleclear.execute(msg, [IDS.memberRole], makeClient());
    const blocked = msg._replies.some(r => r.includes('cannot manage'));
    expect(blocked).toBe(false);
  });

  test('ALLOWS: guild owner bypasses hierarchy', async () => {
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.owner, guild });
    await roleclear.execute(msg, [IDS.adminRole], makeClient());
    const blocked = msg._replies.some(r => r.includes('cannot manage'));
    expect(blocked).toBe(false);
  });
});

describe('PRIVILEGE ESCALATION - !reactionrole add', () => {
  const reactionrole = require('../../src/commands/admin/reactionrole').default;

  function rrArgs(roleId: string) {
    return ['add', `<#${IDS.channel}>`, IDS.message, '✅', roleId];
  }

  function makeRRClient(guild: any) {
    const client = makeClient();
    client.resolveEmoji = jest.fn().mockResolvedValue('✅');
    const channel = {
      id: IDS.channel,
      name: 'test',
      messages: { fetch: jest.fn().mockResolvedValue({ id: IDS.message, react: jest.fn().mockResolvedValue(undefined) }) },
    };
    guild.channels.get.mockImplementation((id: string) => {
      if (id === IDS.channel) return channel;
      return null;
    });
    (client as any).channels = { resolve: jest.fn().mockResolvedValue(channel), fetch: jest.fn().mockResolvedValue(channel) };
    return client;
  }

  test('BLOCKS: mod (pos 5) maps Admin role (pos 10) to reaction', async () => {
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    const client = makeRRClient(guild);
    await reactionrole.execute(msg, rrArgs(IDS.adminRole), client);
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('cannot manage the **Admin** role')
    );
  });

  test('ALLOWS: mod maps Member role (pos 1) to reaction', async () => {
    const GuildSettings = require('../../src/models/GuildSettings').default;
    GuildSettings.getOrCreate.mockResolvedValue({
      reactionRoles: [],
      save: jest.fn().mockResolvedValue(undefined),
      markModified: jest.fn(),
    });

    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    const client = makeRRClient(guild);
    await reactionrole.execute(msg, rrArgs(IDS.memberRole), client);
    const blocked = msg._replies.some(r => r.includes('cannot manage'));
    expect(blocked).toBe(false);
  });

  test('ALLOWS: guild owner maps Admin role to reaction', async () => {
    const GuildSettings = require('../../src/models/GuildSettings').default;
    GuildSettings.getOrCreate.mockResolvedValue({
      reactionRoles: [],
      save: jest.fn().mockResolvedValue(undefined),
      markModified: jest.fn(),
    });

    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.owner, guild });
    const client = makeRRClient(guild);
    await reactionrole.execute(msg, rrArgs(IDS.adminRole), client);
    const blocked = msg._replies.some(r => r.includes('cannot manage'));
    expect(blocked).toBe(false);
  });
});

describe('PRIVILEGE ESCALATION - !autorole set', () => {
  const autorole = require('../../src/commands/admin/autorole').default;

  test('BLOCKS: mod (pos 5) sets Admin (pos 10) as autorole', async () => {
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await autorole.execute(msg, ['set', IDS.adminRole], makeClient());
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('cannot manage the **Admin** role')
    );
  });

  test('ALLOWS: mod sets Member (pos 1) as autorole', async () => {
    const GuildSettings = require('../../src/models/GuildSettings').default;
    GuildSettings.getOrCreate.mockResolvedValue({
      autoroleId: null,
      save: jest.fn().mockResolvedValue(undefined),
    });

    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await autorole.execute(msg, ['set', IDS.memberRole], makeClient());
    const blocked = msg._replies.some(r => r.includes('cannot manage'));
    expect(blocked).toBe(false);
  });

  test('ALLOWS: guild owner sets Admin as autorole', async () => {
    const GuildSettings = require('../../src/models/GuildSettings').default;
    GuildSettings.getOrCreate.mockResolvedValue({
      autoroleId: null,
      save: jest.fn().mockResolvedValue(undefined),
    });

    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.owner, guild });
    await autorole.execute(msg, ['set', IDS.adminRole], makeClient());
    const blocked = msg._replies.some(r => r.includes('cannot manage'));
    expect(blocked).toBe(false);
  });
});

describe('PRIVILEGE ESCALATION - !honeypot role', () => {
  const honeypot = require('../../src/commands/admin/honeypot').default;

  function hpArgs(roleId: string) {
    return ['add', `<#${IDS.channel}>`, 'role', roleId];
  }

  function makeHPGuild() {
    const { guild } = setupScenario();
    const channel = { id: IDS.channel, name: 'trap' };
    guild.channels.get.mockImplementation((id: string) => {
      if (id === IDS.channel) return channel;
      return null;
    });
    guild.channels.values = () => [channel].values();
    return guild;
  }

  test('BLOCKS: mod (pos 5) sets honeypot role to Admin (pos 10)', async () => {
    const GuildSettings = require('../../src/models/GuildSettings').default;
    GuildSettings.getOrCreate.mockResolvedValue({
      honeypotChannels: [],
      save: jest.fn().mockResolvedValue(undefined),
      markModified: jest.fn(),
    });

    const guild = makeHPGuild();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    const client = makeClient();
    (client as any).channels = { resolve: jest.fn().mockResolvedValue({ id: IDS.channel }) };
    await honeypot.execute(msg, hpArgs(IDS.adminRole), client);
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('cannot manage the **Admin** role')
    );
  });

  test('ALLOWS: mod sets honeypot role to Member (pos 1)', async () => {
    const GuildSettings = require('../../src/models/GuildSettings').default;
    GuildSettings.getOrCreate.mockResolvedValue({
      honeypotChannels: [],
      save: jest.fn().mockResolvedValue(undefined),
      markModified: jest.fn(),
    });

    const guild = makeHPGuild();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    const client = makeClient();
    (client as any).channels = { resolve: jest.fn().mockResolvedValue({ id: IDS.channel }) };
    await honeypot.execute(msg, hpArgs(IDS.memberRole), client);
    const blocked = msg._replies.some(r => r.includes('cannot manage'));
    expect(blocked).toBe(false);
  });
});

describe('PRIVILEGE ESCALATION - moderation commands vs higher-role targets', () => {

  test('!ban BLOCKS: mod banning admin', async () => {
    const ban = require('../../src/commands/moderation/ban').default;
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await ban.execute(msg, [IDS.admin, 'test'], makeClient());
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('equal or higher role')
    );
  });

  test('!ban ALLOWS: mod banning lower user', async () => {
    const ban = require('../../src/commands/moderation/ban').default;
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await ban.execute(msg, [IDS.lowUser, 'test'], makeClient());
    const blocked = msg._replies.some(r => r.includes('equal or higher'));
    expect(blocked).toBe(false);
  });

  test('!kick BLOCKS: mod kicking admin', async () => {
    const kick = require('../../src/commands/moderation/kick').default;
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await kick.execute(msg, [IDS.admin, 'test'], makeClient());
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('equal or higher role')
    );
  });

  test('!timeout BLOCKS: mod timing out admin', async () => {
    const timeout = require('../../src/commands/moderation/timeout').default;
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await timeout.execute(msg, [IDS.admin, '10m', 'test'], makeClient());
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('equal or higher role')
    );
  });

  test('!mute BLOCKS: mod muting admin', async () => {
    const mute = require('../../src/commands/moderation/mute').default;
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await mute.execute(msg, [IDS.admin, 'test'], makeClient());
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('equal or higher role')
    );
  });

  test('!warn BLOCKS: mod warning admin', async () => {
    const warn = require('../../src/commands/moderation/warn').default;
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.attacker, guild });
    await warn.execute(msg, [IDS.admin, 'test reason'], makeClient());
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('equal or higher role')
    );
  });
});

describe('PRIVILEGE ESCALATION - !lockdown requires Administrator', () => {
  const lockdown = require('../../src/commands/admin/lockdown').default;

  test('BLOCKS: non-admin user', async () => {
    const { guild } = setupScenario();
    const msg = makeMessage({ authorId: IDS.lowUser, guild });
    await lockdown.execute(msg, [], makeClient());
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('Administrator')
    );
  });
});

describe('PRIVILEGE ESCALATION - owner commands reject non-owners', () => {
  test('!reload BLOCKS non-owner', async () => {
    const reload = require('../../src/commands/owner/reload').default;
    const msg = makeMessage({ authorId: IDS.attacker, guild: null, guildId: undefined });
    await reload.execute(msg, ['ban'], makeClient());
    expect(msg.reply).toHaveBeenCalledWith(
      expect.stringContaining('restricted to the bot owner')
    );
  });

});
