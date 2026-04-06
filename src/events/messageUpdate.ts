import type { BotEvent } from '../types';
import { logServerEvent } from '../utils/logger';
import * as messageCache from '../utils/messageCache';

const event: BotEvent = {
  name: 'messageUpdate',

  async execute(_oldMessage: any, newMessage: any, client: any) {
    if (!newMessage || !newMessage.content) return;

    if (newMessage.author?.bot) return;

    if (!newMessage.guildId) return;

    try {
      const beforeContent = messageCache.get(newMessage.id);

      messageCache.store(newMessage.id, newMessage.content);

      if (beforeContent && beforeContent === newMessage.content) return;
      if (!beforeContent) return;

      const guild = client.guilds.get(newMessage.guildId);
      if (!guild) return;

      const channelId = newMessage.channelId || newMessage.channel?.id;

      const truncate = (content: string | null, max = 1000): string => {
        if (!content) return '*(not cached)*';
        return content.length > max ? content.substring(0, max) + '...' : content;
      };

      const fields = [
        { name: 'Author', value: `<@${newMessage.author.id}> (${newMessage.author.id})`, inline: true },
        { name: 'Channel', value: `<#${channelId}>`, inline: true },
        { name: 'Before', value: truncate(beforeContent) },
        { name: 'After', value: truncate(newMessage.content) },
      ];

      await logServerEvent(guild, 'Message Edited', 0x3498db, fields, client, {
        footer: `Message ID: ${newMessage.id}`,
        eventType: 'message_edit',
      });
    } catch (error) {
      console.error('Error logging message update:', error);
    }
  },
};

export default event;
