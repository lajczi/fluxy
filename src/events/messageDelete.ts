import type { BotEvent } from '../types';
import automod from '../automod';
import { logServerEvent } from '../utils/logger';
import * as messageCache from '../utils/messageCache';
import StarboardMessage from '../models/StarboardMessage';
import settingsCache from '../utils/settingsCache';
import { Routes } from '@erinjs/types';
import { getStarboards } from '../utils/starboardBoards';

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
      ? rawContent.length > 1024
        ? rawContent.substring(0, 1021) + '...'
        : rawContent
      : '*(content not cached)*';

    if (message.id) messageCache.remove(message.id);

    const fields = [
      { name: 'Author', value: message.authorId ? `<@${message.authorId}>` : '*(unknown)*', inline: true },
      { name: 'Channel', value: channelId ? `<#${channelId}>` : '*(unknown)*', inline: true },
      { name: 'Content', value: content },
    ];

    await logServerEvent(
      guild,
      'Message Deleted',
      0x99aab5,
      fields,
      client,
      message.id
        ? { footer: `Message ID: ${message.id}`, eventType: 'message_delete' }
        : { eventType: 'message_delete' },
    );

    // ─── Starboard cleanup ───
    if (message.id) {
      try {
        const settings = await settingsCache.get(guildId);
        const boards = getStarboards(settings);
        if (boards.length > 0) {
          const originals = await StarboardMessage.find({ guildId, messageId: message.id });
          if (originals.length > 0) {
            for (const entry of originals) {
              const channelId = entry.starboardChannelId || boards.find((b) => b.channelId)?.channelId;
              if (entry.starboardMessageId && channelId) {
                try {
                  await client.rest.delete(Routes.channelMessage(channelId, entry.starboardMessageId));
                } catch {}
              }
              await StarboardMessage.deleteOne({ _id: entry._id });
            }
          } else {
            const asStarboard = await StarboardMessage.find({ guildId, starboardMessageId: message.id });
            for (const entry of asStarboard) {
              entry.starboardMessageId = null;
              await entry.save();
            }
          }
        }
      } catch (sbErr: any) {
        console.error(`[starboard] Error in message delete cleanup: ${sbErr.message}`);
      }
    }
  },
};

export default event;
