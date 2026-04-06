'use strict';

jest.mock('@erinjs/core', () => ({
  PermissionFlags: {
    Administrator: 0x8n,
    SendMessages: 0x800n,
    AddReactions: 0x40n,
  },
  EmbedBuilder: jest.fn().mockImplementation(() => {
    const embed = {
      setTitle: jest.fn().mockReturnThis(),
      setColor: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      addFields: jest.fn().mockReturnThis(),
      setTimestamp: jest.fn().mockReturnThis(),
    };
    return embed;
  }),
}));

jest.mock('../../src/config', () => ({
  ownerId: 'owner123',
}));

jest.mock('../../src/models/LockdownState', () => ({
  getOrCreate: jest.fn(),
}));

jest.mock('../../src/models/GuildSettings', () => ({
  getOrCreate: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logModAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/isNetworkError', () => jest.fn(() => false));

import LockdownState from '../../src/models/LockdownState';
import GuildSettings from '../../src/models/GuildSettings';
import isNetworkError from '../../src/utils/isNetworkError';
import lockdownCmd from '../../src/commands/admin/lockdown';

const lockdown = lockdownCmd as any;
const LockdownStateMock = LockdownState as any;
const GuildSettingsMock = GuildSettings as any;
const isNetworkErrorMock = isNetworkError as jest.Mock;

function makeChannel(id: string, name: string, overwrites: any[] = []) {
  return {
    id,
    name,
    type: 0,
    permissionOverwrites: [...overwrites],
    editPermission: jest.fn().mockResolvedValue(undefined),
    deletePermission: jest.fn().mockResolvedValue(undefined),
  };
}

function makeGuild(channels: any[] = [], members: Record<string, any> = {}) {
  const channelMap = new Map();
  channels.forEach((ch) => channelMap.set(ch.id, ch));
  return {
    id: 'guild123',
    name: 'Test Server',
    ownerId: 'owner123',
    channels: {
      values: () => channels,
      get: (id: string) => channelMap.get(id),
    },
    members: {
      get: (id: string) => members[id] || null,
    },
    fetchMember: jest.fn((id: string) => Promise.resolve(members[id] || null)),
    fetchChannels: jest.fn().mockResolvedValue(channels),
  };
}

function makeMessage(authorId = 'owner123') {
  const replies: any[] = [];
  let lastReply: any = null;
  return {
    author: { id: authorId },
    reply: jest.fn((content: any) => {
      const msg = {
        content: typeof content === 'string' ? content : (content?.content ?? null),
        embeds: content?.embeds ?? [],
        edit: jest.fn().mockResolvedValue(undefined),
      };
      replies.push(msg);
      lastReply = msg;
      return Promise.resolve(msg);
    }),
    _replies: replies,
    _getLastReply: () => lastReply,
    guild: null as any,
    guildId: null as string | null,
  };
}

function makeState(active = false, snapshots: any[] = []) {
  return {
    active,
    lockedBy: null as string | null,
    lockedAt: null as Date | null,
    channelSnapshots: snapshots,
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function makeSettings(lockdownRoles: string[] = []) {
  return {
    lockdownRoles,
    lockdownAllowedRoles: [] as string[],
    lockdownAllowedUsers: [] as string[],
    lockdownAllowedChannels: [] as string[],
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

describe('lockdown command - large server support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    isNetworkErrorMock.mockReturnValue(false);
  });

  describe('lockServer batched processing', () => {
    test('locks all channels successfully with batched processing', async () => {
      const channels: any[] = [];
      for (let i = 0; i < 12; i++) {
        channels.push(makeChannel(`ch${i}`, `channel-${i}`));
      }

      const guild = makeGuild(channels);
      const state = makeState(false);
      const settings = makeSettings();
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      for (const ch of channels) {
        expect(ch.editPermission).toHaveBeenCalledWith(
          'guild123',
          expect.objectContaining({
            type: 0,
          }),
        );
      }

      expect(state.active).toBe(true);
      expect(state.channelSnapshots.length).toBe(12);
      expect(state.save).toHaveBeenCalled();
    });

    test('locks channels for multiple roles', async () => {
      const channels = [makeChannel('ch1', 'general'), makeChannel('ch2', 'chat')];

      const guild = makeGuild(channels);
      const state = makeState(false);
      const settings = makeSettings(['role456']);
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      for (const ch of channels) {
        expect(ch.editPermission).toHaveBeenCalledTimes(2);
        expect(ch.editPermission).toHaveBeenCalledWith('guild123', expect.any(Object));
        expect(ch.editPermission).toHaveBeenCalledWith('role456', expect.any(Object));
      }

      expect(state.channelSnapshots.length).toBe(4);
    });

    test('preserves existing permission overwrites in snapshots', async () => {
      const channels = [makeChannel('ch1', 'general', [{ id: 'guild123', type: 0, allow: '2048', deny: '64' }])];

      const guild = makeGuild(channels);
      const state = makeState(false);
      const settings = makeSettings();
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      const snapshot = state.channelSnapshots[0];
      expect(snapshot.hadOverwrite).toBe(true);
      expect(snapshot.previousAllow).toBe('2048');
      expect(snapshot.previousDeny).toBe('64');
    });

    test('counts failures but continues processing other channels', async () => {
      const channels = [makeChannel('ch1', 'general'), makeChannel('ch2', 'broken'), makeChannel('ch3', 'working')];
      channels[1].editPermission.mockRejectedValue(new Error('Permission denied'));

      const guild = makeGuild(channels);
      const state = makeState(false);
      const settings = makeSettings();
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      expect(channels[0].editPermission).toHaveBeenCalled();
      expect(channels[1].editPermission).toHaveBeenCalled();
      expect(channels[2].editPermission).toHaveBeenCalled();

      expect(state.channelSnapshots.length).toBe(3);
      expect(state.active).toBe(true);
    });

    test('retries on RateLimitError and succeeds', async () => {
      const channels = [makeChannel('ch1', 'general')];
      const rateLimitErr: any = new Error('Rate limited');
      rateLimitErr.name = 'RateLimitError';
      rateLimitErr.retryAfter = 0.01;

      channels[0].editPermission.mockRejectedValueOnce(rateLimitErr).mockResolvedValueOnce(undefined);

      const guild = makeGuild(channels);
      const state = makeState(false);
      const settings = makeSettings();
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      expect(channels[0].editPermission).toHaveBeenCalledTimes(2);
      expect(state.active).toBe(true);
      expect(state.channelSnapshots.length).toBe(1);
    });

    test('retries on network error and succeeds', async () => {
      const channels = [makeChannel('ch1', 'general')];
      const netErr: any = new Error('ECONNRESET');
      netErr.code = 'ECONNRESET';
      isNetworkErrorMock.mockImplementation((err: any) => err === netErr);

      channels[0].editPermission.mockRejectedValueOnce(netErr).mockResolvedValueOnce(undefined);

      const guild = makeGuild(channels);
      const state = makeState(false);
      const settings = makeSettings();
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      expect(channels[0].editPermission).toHaveBeenCalledTimes(2);
      expect(state.active).toBe(true);
    });
  });

  describe('unlockServer batched processing', () => {
    test('unlocks all channels and restores overwrites', async () => {
      const channels = [makeChannel('ch1', 'general'), makeChannel('ch2', 'chat'), makeChannel('ch3', 'memes')];

      const guild = makeGuild(channels);
      const snapshots = [
        { channelId: 'ch1', roleId: 'guild123', previousAllow: '2048', previousDeny: '0', hadOverwrite: true },
        { channelId: 'ch2', roleId: 'guild123', previousAllow: '0', previousDeny: '0', hadOverwrite: false },
        { channelId: 'ch3', roleId: 'guild123', previousAllow: '0', previousDeny: '64', hadOverwrite: true },
      ];
      const state = makeState(true, snapshots);
      const settings = makeSettings();
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      expect(channels[0].editPermission).toHaveBeenCalledWith('guild123', {
        type: 0,
        allow: '2048',
        deny: '0',
      });

      expect(channels[1].deletePermission).toHaveBeenCalledWith('guild123');

      expect(channels[2].editPermission).toHaveBeenCalledWith('guild123', {
        type: 0,
        allow: '0',
        deny: '64',
      });

      expect(state.active).toBe(false);
      expect(state.channelSnapshots).toEqual([]);
      expect(state.save).toHaveBeenCalled();
    });

    test('handles missing channels gracefully during unlock', async () => {
      const channels = [makeChannel('ch1', 'general')];
      const guild = makeGuild(channels);
      const snapshots = [
        { channelId: 'ch1', roleId: 'guild123', previousAllow: '0', previousDeny: '0', hadOverwrite: true },
        { channelId: 'ch_deleted', roleId: 'guild123', previousAllow: '0', previousDeny: '0', hadOverwrite: true },
      ];
      const state = makeState(true, snapshots);
      const settings = makeSettings();
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      expect(channels[0].editPermission).toHaveBeenCalled();

      expect(state.active).toBe(false);
      expect(state.channelSnapshots).toEqual([]);
    });

    test('retries unlock operations on RateLimitError', async () => {
      const channels = [makeChannel('ch1', 'general')];
      const rateLimitErr: any = new Error('Rate limited');
      rateLimitErr.name = 'RateLimitError';
      rateLimitErr.retryAfter = 0.01;

      channels[0].editPermission.mockRejectedValueOnce(rateLimitErr).mockResolvedValueOnce(undefined);

      const guild = makeGuild(channels);
      const snapshots = [
        { channelId: 'ch1', roleId: 'guild123', previousAllow: '0', previousDeny: '0', hadOverwrite: true },
      ];
      const state = makeState(true, snapshots);
      const settings = makeSettings();
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      expect(channels[0].editPermission).toHaveBeenCalledTimes(2);
      expect(state.active).toBe(false);
    });

    test('backward compat: snapshots without roleId default to guild.id', async () => {
      const channels = [makeChannel('ch1', 'general')];
      const guild = makeGuild(channels);
      const snapshots = [{ channelId: 'ch1', previousAllow: '0', previousDeny: '0', hadOverwrite: true }];
      const state = makeState(true, snapshots);
      const settings = makeSettings();
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      expect(channels[0].editPermission).toHaveBeenCalledWith('guild123', expect.any(Object));
    });
  });

  describe('progress updates', () => {
    test('edits status message during lock with many channels', async () => {
      const channels: any[] = [];
      for (let i = 0; i < 15; i++) {
        channels.push(makeChannel(`ch${i}`, `channel-${i}`));
      }

      const guild = makeGuild(channels);
      const state = makeState(false);
      const settings = makeSettings();
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      const statusMsg = message._replies[0];
      expect(statusMsg.edit).toHaveBeenCalled();

      const editCalls = statusMsg.edit.mock.calls;
      const hasProgressUpdate = editCalls.some((call: any) => {
        const content = typeof call[0] === 'string' ? call[0] : (call[0]?.content ?? '');
        return content.includes('Locking') || content.includes('overwrites');
      });
      expect(hasProgressUpdate).toBe(true);
    });
  });

  describe('error handling', () => {
    test('handles no text channels', async () => {
      const guild = makeGuild([]);
      const state = makeState(false);
      const settings = makeSettings();
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      expect(message.reply).toHaveBeenCalledWith(
        'No text channels found to lock down. This usually means the bot could not fetch channels from the Fluxer API.\n' +
          'Check that the bot has **View Channels** permission and try again in a moment.',
      );
    });

    test('handles channel fetch fallback to cache', async () => {
      const channels = [makeChannel('ch1', 'general')];
      const guild = makeGuild(channels);
      guild.fetchChannels.mockRejectedValue(new Error('API error'));

      const state = makeState(false);
      const settings = makeSettings();
      const message = makeMessage();
      message.guild = guild;

      LockdownStateMock.getOrCreate.mockResolvedValue(state);
      GuildSettingsMock.getOrCreate.mockResolvedValue(settings);

      await lockdown.execute(message, [], {});

      expect(channels[0].editPermission).toHaveBeenCalled();
      expect(state.active).toBe(true);
    });
  });
});
