import { EmbedBuilder } from '@fluxerjs/core';
import type { Command } from '../../types';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'roleinfo',
  description: 'Show details about a role \u2014 ID, color, position, whether it is hoisted, mentionable, or managed by an integration',
  usage: '<@role or role ID>',
  category: 'info',
  cooldown: 3,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply('This command can only be used in a server.');

    const roleArg = args[0];
    if (!roleArg) return void await message.reply(`Usage: \`${prefix}roleinfo <@role>\``);

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

      const createdAt = new Date(Number(BigInt(role.id) / 4194304n + 1420070400000n));
      const createdStr = createdAt.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });

      const colorHex = role.color && role.color !== 0
        ? `#${role.color.toString(16).padStart(6, '0').toUpperCase()}`
        : 'Default (no color)';

      const embed = new EmbedBuilder()
        .setTitle(`Role: ${role.name}`)
        .setColor(role.color || 0x5865F2)
        .addFields(
          { name: 'ID', value: role.id, inline: true },
          { name: 'Color', value: colorHex, inline: true },
          { name: 'Position', value: `${role.position ?? 'Unknown'}`, inline: true },
          { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
          { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
          { name: 'Managed', value: role.managed ? 'Yes (bot/integration)' : 'No', inline: true },
          { name: 'Created', value: createdStr, inline: false },
        )
        .setTimestamp(new Date())
        .setFooter({ text: `Requested by ${(message as any).author.username}` });

      return void await message.reply({ embeds: [embed] });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !roleinfo (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !roleinfo: ${error.message || error}`);
        message.reply('An error occurred while fetching role information.').catch(() => {});
      }
    }
  }
};

export default command;
