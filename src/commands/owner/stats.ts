import { EmbedBuilder } from '@fluxerjs/core';
import type { Command } from '../../types';
import { getWorkerStats } from '../../utils/workerStats';

const command: Command = {
  name: 'stats',
  description: 'Shows bot statistics (owner only)',
  category: 'owner',
  ownerOnly: true,

  async execute(message, _args, client) {
    try {

      const loadingMsg = await (message as any).channel.send({ content: '\ud83d\udcca Fetching bot statistics\u2026' });

      let guildCount: number;
      let memberCount: number;
      let uptimeSeconds: number;
      let memMB: string;

      if (typeof (client as any).fetchAllStats === 'function') {
        const stats = await (client as any).fetchAllStats();
        guildCount = stats.guilds;
        memberCount = stats.members;
        uptimeSeconds = stats.uptime;
        memMB = stats.memory.toFixed(1);
      } else {
        const stats = await getWorkerStats(client);
        guildCount = stats.guilds;
        memberCount = stats.members;
        uptimeSeconds = stats.uptime;
        memMB = stats.memory.toFixed(1);
      }

      const days = Math.floor(uptimeSeconds / 86400);
      const hours = Math.floor((uptimeSeconds % 86400) / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const uptimeStr = days > 0 ? `${days}d ${hours}h ${minutes}m` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      const embed = new EmbedBuilder()
        .setTitle('Bot Statistics')
        .addFields(
          { name: 'Servers', value: guildCount.toString(), inline: true },
          { name: 'Members', value: memberCount.toLocaleString(), inline: true },
          { name: 'Uptime', value: uptimeStr, inline: true },
          { name: 'Memory', value: `${memMB} MB`, inline: true }
        )
        .setColor(0x5865F2)
        .setTimestamp(new Date());

      await loadingMsg.edit({ content: null, embeds: [embed] });
    } catch (err: any) {
      console.error('[STATS] !stats command error:', err);
      try { await message.reply('An error occurred while running !stats.'); } catch {}
    }
  },
};

export default command;
