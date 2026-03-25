import type { BotEvent } from '../types';
import { logServerEvent } from '../utils/logger';

const event: BotEvent = {
  name: 'guildEmojisUpdate',

  async execute(data: any, client: any) {
    try {
      const guildId = data.guild_id;
      if (!guildId) return;

      const guild = client.guilds.get(guildId);
      if (!guild) return;

      const emojis = data.emojis ?? [];
      const emojiList = emojis
        .slice(0, 10)
        .map((e: any) => `${e.animated ? '<a' : '<'}:${e.name}:${e.id}> \`${e.name}\``)
        .join('\n');

      const total = emojis.length;
      const summary = total > 10 ? `${emojiList}\n... and ${total - 10} more` : emojiList;

      await logServerEvent(
        guild,
        'Emojis Updated',
        0xf1c40f,
        [
          { name: 'Total Emojis', value: String(total), inline: true },
          { name: 'Current Emojis', value: summary || 'None', inline: false },
        ],
        client,
        {
          description: 'Server emojis were created, updated, or deleted.',
          footer: `Guild ID: ${guildId}`,
          eventType: 'guild_emojis_update',
        }
      );
    } catch (error) {
      console.error('Error in guildEmojisUpdate event:', error);
    }
  }
};

export default event;
