import type { BotEvent } from '../types';
import { logServerEvent } from '../utils/logger';

const event: BotEvent = {
  name: 'channelPinsUpdate',

  async execute(data: any, client: any) {
    try {
      const guildId = data.guild_id;
      if (!guildId) return;

      const guild = client.guilds.get(guildId);
      if (!guild) return;

      const channelId = data.channel_id;
      const lastPin = data.last_pin_timestamp;

      await logServerEvent(
        guild,
        'Message Pinned',
        0x3498db,
        [
          { name: 'Channel', value: `<#${channelId}>`, inline: true },
          {
            name: 'Pinned At',
            value: lastPin ? `<t:${Math.floor(new Date(lastPin).getTime() / 1000)}:R>` : 'Unknown',
            inline: true,
          },
        ],
        client,
        { footer: `Channel ID: ${channelId}`, eventType: 'channel_pins_update' },
      );
    } catch (error) {
      console.error('Error in channelPinsUpdate event:', error);
    }
  },
};

export default event;
