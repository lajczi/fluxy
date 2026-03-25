import type { BotEvent } from '../types';
import automod from '../automod';
import { logServerEvent } from '../utils/logger';
import * as messageCache from '../utils/messageCache';

const event: BotEvent = {
  name: 'messageDelete',

  async execute(message: any, client: any) {

    const guildId = message.channel?.guildId;
    if (!guildId) return;

    await automod.handleGhostPing(message, client);

    const guild = client.guilds.get(guildId);
    if (!guild) return;

    const channelId = message.channelId || message.channel?.id;

    const cachedContent = message.id ? messageCache.get(message.id) : null;
    const rawContent = cachedContent || message.content;
    const content = rawContent
      ? (rawContent.length > 1024 ? rawContent.substring(0, 1021) + '...' : rawContent)
      : '*(content not cached)*';

    if (message.id) messageCache.remove(message.id);

    const fields = [
      { name: 'Author',  value: message.authorId ? `<@${message.authorId}>` : '*(unknown)*', inline: true },
      { name: 'Channel', value: channelId ? `<#${channelId}>` : '*(unknown)*', inline: true },
      { name: 'Content', value: content },
    ];

    await logServerEvent(
      guild,
      'Message Deleted',
      0x99aab5,
      fields,
      client,
      message.id ? { footer: `Message ID: ${message.id}`, eventType: 'message_delete' } : { eventType: 'message_delete' }
    );
  }
};

export default event;
