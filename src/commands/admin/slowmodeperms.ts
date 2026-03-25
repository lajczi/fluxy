import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'slowmodeperms',
  description: 'Manage which roles can use the slowmode command without needing Manage Channels permission.',
  usage: 'add <@role> | remove <@role> | list | clear',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) {
      guild = await client.guilds.fetch((message as any).guildId);
    }

    if (!guild) {
      return void await message.reply('This command can only be used in a server.');
    }

    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || !['add', 'remove', 'list', 'clear'].includes(subcommand)) {
      return void await message.reply(
        '**Slowmode Permissions**\n' +
        `Allow specific roles to use \`${prefix}slowmode\` without needing Manage Channels permission.\n\n` +
        `\`${prefix}slowmodeperms add <@role>\` - allow a role to use slowmode\n` +
        `\`${prefix}slowmodeperms remove <@role>\` - remove a role from the allowlist\n` +
        `\`${prefix}slowmodeperms list\` - show allowed roles\n` +
        `\`${prefix}slowmodeperms clear\` - clear all (only Manage Channels users can use slowmode)`
      );
    }

    try {
      const settings = await (GuildSettings as any).getOrCreate(guild.id);

      switch (subcommand) {
        case 'add': {
          const roleArg = args[1];
          if (!roleArg) {
            return void await message.reply(`Please specify a role. Usage: \`${prefix}slowmodeperms add <@role>\``);
          }

          const roleMention = roleArg.match(/^<@&(\d{17,19})>$/);
          let roleId: string;
          if (roleMention) {
            roleId = roleMention[1];
          } else if (/^\d{17,19}$/.test(roleArg)) {
            roleId = roleArg;
          } else {
            return void await message.reply('Invalid role. Please use a role mention or role ID.');
          }

          let role = guild.roles?.get(roleId);
          if (!role) {
            try { role = await guild.fetchRole(roleId); } catch {}
          }
          if (!role) {
            return void await message.reply('That role doesn\'t exist in this server.');
          }

          if (settings.slowmodeAllowedRoles?.includes(roleId)) {
            return void await message.reply(`**${role.name}** is already in the slowmode allowlist.`);
          }

          if (!settings.slowmodeAllowedRoles) {
            settings.slowmodeAllowedRoles = [];
          }
          settings.slowmodeAllowedRoles.push(roleId);
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void await message.reply(`Added **${role.name}** to the slowmode allowlist. Members with this role can use \`${prefix}slowmode\` without Manage Channels permission.`);
        }

        case 'remove': {
          const roleArg = args[1];
          if (!roleArg) {
            return void await message.reply(`Please specify a role. Usage: \`${prefix}slowmodeperms remove <@role>\``);
          }

          const roleMention = roleArg.match(/^<@&(\d{17,19})>$/);
          let roleId: string;
          if (roleMention) {
            roleId = roleMention[1];
          } else if (/^\d{17,19}$/.test(roleArg)) {
            roleId = roleArg;
          } else {
            return void await message.reply('Invalid role. Please use a role mention or role ID.');
          }

          if (!settings.slowmodeAllowedRoles?.includes(roleId)) {
            return void await message.reply('That role is not in the slowmode allowlist.');
          }

          settings.slowmodeAllowedRoles = settings.slowmodeAllowedRoles.filter((id: string) => id !== roleId);
          await settings.save();
          settingsCache.invalidate(guild.id);

          const note = settings.slowmodeAllowedRoles.length === 0
            ? ' The allowlist is now empty - only users with Manage Channels can use slowmode.'
            : '';
          return void await message.reply(`Removed <@&${roleId}> from the slowmode allowlist.${note}`);
        }

        case 'list': {
          const roles: string[] = settings.slowmodeAllowedRoles || [];

          if (roles.length === 0) {
            return void await message.reply(`No slowmode role overrides are set. Only users with Manage Channels permission can use \`${prefix}slowmode\`.`);
          }

          const roleList = roles.map((id: string) => `<@&${id}>`).join('\n');
          return void await message.reply(`**Slowmode Allowed Roles:**\n${roleList}\n\nMembers with one of these roles can use \`${prefix}slowmode\` without Manage Channels permission.`);
        }

        case 'clear': {
          if (!settings.slowmodeAllowedRoles || settings.slowmodeAllowedRoles.length === 0) {
            return void await message.reply('No slowmode role overrides to clear.');
          }

          settings.slowmodeAllowedRoles = [];
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void await message.reply(`Cleared all slowmode role overrides. Only users with Manage Channels permission can use \`${prefix}slowmode\`.`);
        }
      }

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !slowmodeperms (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !slowmodeperms: ${error.message || error}`);
        message.reply('An error occurred while managing slowmode permissions.').catch(() => {});
      }
    }
  }
};

export default command;
