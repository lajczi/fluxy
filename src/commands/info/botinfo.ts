import { EmbedBuilder } from '@fluxerjs/core';
import { Routes } from '@fluxerjs/types';
import type { Command } from '../../types';
import isNetworkError from '../../utils/isNetworkError';

const packageJson = require('../../../package.json');

const startTime = Date.now();

async function fetchAccurateGuildCount(client: any): Promise<number> {
  if (typeof client.fetchTotalGuildCount === 'function') {
    try {
      const count = await client.fetchTotalGuildCount();
      if (typeof count === 'number' && count >= 0) return count;
    } catch {}
  }

  if (typeof client.fetchAllStats === 'function') {
    try {
      const stats = await client.fetchAllStats();
      if (typeof stats?.guilds === 'number' && stats.guilds >= 0) return stats.guilds;
    } catch {}
  }

  try {
    let total = 0;
    let after: string | undefined;
    while (true) {
      const route = `${Routes.currentUserGuilds()}?limit=200${after ? `&after=${after}` : ''}`;
      const response = await client.rest.get(route) as any;
      const page = Array.isArray(response) ? response : (response?.guilds ?? []);
      total += page.length;
      if (page.length < 200) break;
      after = page[page.length - 1]?.id;
      if (!after) break;
    }
    return total;
  } catch {}

  return client.guilds?.size ?? 0;
}

const command: Command = {
  name: 'botinfo',
  description: 'Show bot stats - version, uptime, memory usage, and how many servers it is in',
  usage: '',
  category: 'info',
  cooldown: 5,

  async execute(message, args, client) {
    try {
      const uptime = Date.now() - startTime;
      const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
      const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((uptime % (60 * 1000)) / 1000);

      const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

      const memoryUsage = process.memoryUsage();
      const usedMemory = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const totalMemory = Math.round(memoryUsage.heapTotal / 1024 / 1024);

      const guildCount = await fetchAccurateGuildCount(client);

      const embed = new EmbedBuilder()
        .setTitle('Bot Information')
        .setColor(0x3498db)
        .setThumbnail((client as any).user?.avatarURL?.() || null)
        .setDescription(
          [
            `\`Name    \` ${(client as any).user?.username || 'Unknown'}`,
            `\`ID      \` ${(client as any).user?.id || 'Unknown'}`,
            `\`Version \` ${packageJson.version || '1.0.0'}`,
            `\`Uptime  \` ${uptimeString}`,
            `\`Memory  \` ${usedMemory}MB / ${totalMemory}MB`,
            `\`Servers \` ${guildCount}`,
            `\`Node.js \` ${process.version}`,
            `\`Library \` Fluxer.js`,
          ].join('\n')
        )
        .addFields(
          { name: 'Quick Stats', value: `${guildCount} servers • ${usedMemory}MB heap used`, inline: false }
        )
        .setTimestamp(new Date())
        .setFooter({ text: `Requested by ${(message as any).author.username}` });

      await message.reply({ embeds: [embed] });

    } catch (error: any) {
      const guildName = (message as any).guild?.name || 'Unknown';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !botinfo (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !botinfo: ${error.message || error}`);
        message.reply('An error occurred while fetching bot information.').catch(() => {});
      }
    }
  }
};

export default command;
