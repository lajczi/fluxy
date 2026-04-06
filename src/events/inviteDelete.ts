import type { BotEvent } from '../types';
import { logServerEvent } from '../utils/logger';

const event: BotEvent = {
  name: 'inviteDelete',

  async execute(data: any, client: any) {
    try {
      const guildId = data.guild_id;
      if (!guildId) return;

      const guild = client.guilds.get(guildId);
      if (!guild) return;

      await logServerEvent(
        guild,
        'Invite Deleted',
        0xe74c3c,
        [
          { name: 'Code', value: data.code ?? 'Unknown', inline: true },
          { name: 'Channel', value: data.channel_id ? `<#${data.channel_id}>` : 'Unknown', inline: true },
        ],
        client,
        { footer: `Invite Code: ${data.code ?? 'unknown'}`, eventType: 'invite_delete' },
      );
    } catch (error) {
      console.error('Error in inviteDelete event:', error);
    }
  },
};

export default event;
