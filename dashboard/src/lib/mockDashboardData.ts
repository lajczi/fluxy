import { normalizeSettings, type GuildDetail, type GuildSettings } from './api';

const MOCK_ROLE_IDS = {
  everyone: '100000000000000001',
  admin: '100000000000000002',
  moderator: '100000000000000003',
  helper: '100000000000000004',
  noEmbeds: '100000000000000005',
};

const MOCK_CHANNEL_IDS = {
  general: '200000000000000001',
  rules: '200000000000000002',
  staff: '200000000000000003',
  botCommands: '200000000000000004',
  logs: '200000000000000005',
};

export function createMockGuild(guildId: string): GuildDetail {
  return {
    id: guildId,
    name: 'Fluxy Mock Server',
    icon: null,
    ownerId: '300000000000000001',
    channels: [
      { id: MOCK_CHANNEL_IDS.general, name: 'general', type: 0, parent_id: null, position: 1 },
      { id: MOCK_CHANNEL_IDS.rules, name: 'rules', type: 0, parent_id: null, position: 2 },
      { id: MOCK_CHANNEL_IDS.staff, name: 'staff-room', type: 0, parent_id: null, position: 3 },
      { id: MOCK_CHANNEL_IDS.botCommands, name: 'bot-commands', type: 0, parent_id: null, position: 4 },
      { id: MOCK_CHANNEL_IDS.logs, name: 'server-logs', type: 0, parent_id: null, position: 5 },
    ],
    roles: [
      { id: MOCK_ROLE_IDS.everyone, name: '@everyone', color: 0, position: 0 },
      { id: MOCK_ROLE_IDS.noEmbeds, name: 'No-Embeds', color: 0x61afef, position: 1 },
      { id: MOCK_ROLE_IDS.helper, name: 'Helper', color: 0x56b6c2, position: 1 },
      { id: MOCK_ROLE_IDS.moderator, name: 'Moderator', color: 0xe5c07b, position: 2 },
      { id: MOCK_ROLE_IDS.admin, name: 'Admin', color: 0xe06c75, position: 3 },
    ],
    emojis: [
      { id: '400000000000000001', name: 'yes', animated: false, url: null },
      { id: '400000000000000002', name: 'no', animated: false, url: null },
    ],
  };
}

export function createMockSettings(guildId: string): GuildSettings {
  return normalizeSettings({
    guildId,
    prefixes: ['!'],
    staffRoleId: MOCK_ROLE_IDS.moderator,
    staffChannelId: MOCK_CHANNEL_IDS.staff,
    serverLogChannelId: MOCK_CHANNEL_IDS.logs,
    commandAllowedRoles: [MOCK_ROLE_IDS.helper],
    disabledCommands: [],
    customCommands: [
      {
        name: 'perms',
        response: '{target}: {role} was {action} by {user}.',
        embed: false,
        color: null,
        title: null,
        enabled: true,
        actionType: 'toggleRole',
        targetRoleId: MOCK_ROLE_IDS.noEmbeds,
        requiredRoleIds: [MOCK_ROLE_IDS.moderator],
        requiredPermission: 'ManageRoles',
        allowedChannelIds: [MOCK_CHANNEL_IDS.botCommands],
        cooldownSeconds: 5,
        deleteTrigger: false,
      },
    ],
  });
}
