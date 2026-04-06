import { EmbedBuilder } from '@erinjs/core';
import type { Command } from '../../types';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'rolelist',
  description: 'Show all roles in this server sorted by position',
  usage: '',
  category: 'info',
  cooldown: 5,

  async execute(message, _args, client) {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply('This command can only be used in a server.');

    try {
      let roles: any;
      try {
        roles = await guild.fetchRoles();
      } catch {
        roles = guild.roles;
      }

      const roleArr: any[] = roles instanceof Map
        ? [...roles.values()]
        : Array.isArray(roles) ? roles : [];

      const sorted = roleArr
        .filter((r: any) => r.name !== '@everyone')
        .sort((a: any, b: any) => (b.position ?? 0) - (a.position ?? 0));

      if (sorted.length === 0) {
        return void await message.reply('This server has no roles.');
      }

      const MAX_DISPLAY = 40;
      const displayed = sorted.slice(0, MAX_DISPLAY);
      const overflow = sorted.length - displayed.length;

      const lines = displayed.map((r: any) => {
        const color = r.color && r.color !== 0
          ? `\`#${r.color.toString(16).padStart(6, '0').toUpperCase()}\``
          : '`default`';
        return `<@&${r.id}> ${color}`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`Roles \u2014 ${guild.name}`)
        .setColor(0x5865F2)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${sorted.length} role(s) total${overflow > 0 ? ` \u00b7 ${overflow} not shown \u2014 use !roleinfo for details` : ''}` })
        .setTimestamp(new Date());

      return void await message.reply({ embeds: [embed] });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !rolelist (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !rolelist: ${error.message || error}`);
        message.reply('An error occurred while fetching roles.').catch(() => {});
      }
    }
  }
};

export default command;
