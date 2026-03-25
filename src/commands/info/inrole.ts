import { EmbedBuilder } from '@fluxerjs/core';
import type { Command } from '../../types';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'inrole',
  description: 'List every member who has a specific role',
  usage: '<@role or role ID> [page]',
  category: 'info',
  cooldown: 10,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply('This command can only be used in a server.');

    const roleArg = args[0];
    if (!roleArg) return void await message.reply(`Usage: \`${prefix}inrole <@role> [page]\``);

    const roleMention = roleArg.match(/^<@&(\d{17,19})>$/);
    let roleId: string;
    if (roleMention) roleId = roleMention[1];
    else if (/^\d{17,19}$/.test(roleArg)) roleId = roleArg;
    else return void await message.reply('Please provide a valid role mention or role ID.');

    try {
      let role: any = guild.roles?.get(roleId);
      if (!role) {
        try { role = await guild.fetchRole(roleId); } catch {}
      }
      if (!role) return void await message.reply('That role does not exist in this server.');

      let members: any[];
      try {
        members = [];
        let lastId: string | undefined;
        while (true) {
          const batch: any = await guild.members.fetch({ limit: 1000, ...(lastId && { after: lastId }) });
          const arr = Array.isArray(batch) ? batch : [...batch.values()];
          members.push(...arr);
          if (arr.length < 1000) break;
          lastId = arr[arr.length - 1].id;
        }
      } catch (err: any) {
        const guildName = guild?.name || 'Unknown Server';
        if (isNetworkError(err)) {
          console.warn(`[${guildName}] Fluxer API unreachable during !inrole (ECONNRESET)`);
        } else {
          console.error(`[${guildName}] Error in !inrole: ${err.message || err}`);
        }
        return void await message.reply('Failed to fetch server members.');
      }

      const withRole = members.filter((m: any) => {
        if (typeof m.roles?.has === 'function') return m.roles.has(roleId);
        const ids = m.roles?.roleIds ?? (Array.isArray(m.roles) ? m.roles : []);
        return ids.includes(roleId);
      });

      if (withRole.length === 0) {
        return void await message.reply(`No members currently have the **${role.name}** role.`);
      }

      const PAGE_SIZE = 50;
      const totalPages = Math.max(1, Math.ceil(withRole.length / PAGE_SIZE));

      let page = 1;
      if (args[1]) {
        const parsed = parseInt(args[1], 10);
        if (isNaN(parsed) || parsed < 1) return void await message.reply('Page must be a number starting from 1.');
        if (parsed > totalPages) return void await message.reply(`Only ${totalPages} page(s) available for this role.`);
        page = parsed;
      }

      const start = (page - 1) * PAGE_SIZE;
      const displayed = withRole.slice(start, start + PAGE_SIZE);

      const list = displayed
        .map((m: any) => m.user ? `<@${m.id}> (${m.user.username})` : `<@${m.id}>`)
        .join('\n');

      const footerParts = [`${withRole.length} member(s) total`];
      if (totalPages > 1) footerParts.push(`page ${page}/${totalPages} \u2014 run !inrole <role> <page> to see other pages`);

      const embed = new EmbedBuilder()
        .setTitle(`Members with ${role.name}`)
        .setColor(role.color || 0x5865F2)
        .setDescription(list)
        .setFooter({ text: footerParts.join(' \u00b7 ') })
        .setTimestamp(new Date());

      return void await message.reply({ embeds: [embed] });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !inrole (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !inrole: ${error.message || error}`);
        message.reply('An error occurred while fetching members.').catch(() => {});
      }
    }
  }
};

export default command;
