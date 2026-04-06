import type { BotEvent } from '../types';
import { logServerEvent } from '../utils/logger';

// good ENOUGH for now, will optimize later if needed
const voiceCache = new Map<string, string>();

const event: BotEvent = {
  name: 'voiceStateUpdate',

  async execute(data: any, client: any) {
    try {
      if (!data.guild_id) return;

      if (data.member?.user?.bot) return;

      const guild = client.guilds.get(data.guild_id);
      if (!guild) return;

      const userId = data.user_id;
      if (!userId) return;

      const prevChannelId = voiceCache.get(userId) ?? null;
      const currChannelId = data.channel_id ?? null;

      if (currChannelId) {
        voiceCache.set(userId, currChannelId);
      } else {
        voiceCache.delete(userId);
      }

      if (!prevChannelId && currChannelId) {
        await logServerEvent(
          guild,
          'Joined Voice',
          0x2ecc71,
          [{ name: 'Channel', value: `<#${currChannelId}>`, inline: true }],
          client,
          { description: `<@${userId}> joined a voice channel`, footer: `User ID: ${userId}`, eventType: 'voice_join' },
        );
      } else if (prevChannelId && !currChannelId) {
        await logServerEvent(
          guild,
          'Left Voice',
          0xe67e22,
          [{ name: 'Channel', value: `<#${prevChannelId}>`, inline: true }],
          client,
          { description: `<@${userId}> left a voice channel`, footer: `User ID: ${userId}`, eventType: 'voice_leave' },
        );
      } else if (prevChannelId && currChannelId && prevChannelId !== currChannelId) {
        await logServerEvent(
          guild,
          'Moved Voice Channel',
          0x3498db,
          [
            { name: 'From', value: `<#${prevChannelId}>`, inline: true },
            { name: 'To', value: `<#${currChannelId}>`, inline: true },
          ],
          client,
          { description: `<@${userId}> moved voice channels`, footer: `User ID: ${userId}`, eventType: 'voice_move' },
        );
      }
    } catch (error) {
      console.error('Error in voiceStateUpdate event:', error);
    }
  },
};

export default event;
