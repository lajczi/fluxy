import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'commandperms',
  description: 'Manage which roles are allowed to use bot commands. When roles are set, only members with those roles (plus staff/admins) can use non-admin commands.',
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
        '**Command Permissions**\n' +
        'Restrict bot command usage to specific roles. When set, only members with an allowed role (or staff/admins) can use non-admin commands.\n\n' +
        `\`${prefix}commandperms add <@role>\` - allow a role to use commands\n` +
        `\`${prefix}commandperms remove <@role>\` - remove a role from the allowlist\n` +
        `\`${prefix}commandperms list\` - show allowed roles\n` +
        `\`${prefix}commandperms clear\` - clear all (everyone can use commands)`
      );
    }

    try {
      const settings = await (GuildSettings as any).getOrCreate(guild.id);

      switch (subcommand) {
        case 'add': {
          const roleArg = args[1];
          if (!roleArg) {
            return void await message.reply(`Please specify a role. Usage: \`${prefix}commandperms add <@role>\``);
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

          if (settings.commandAllowedRoles?.includes(roleId)) {
            return void await message.reply(`**${role.name}** is already in the command allowlist.`);
          }

          if (!settings.commandAllowedRoles) {
            settings.commandAllowedRoles = [];
          }
          settings.commandAllowedRoles.push(roleId);
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void await message.reply(`Added **${role.name}** to the command allowlist. Members with this role can use bot commands.`);
        }

        case 'remove': {
          const roleArg = args[1];
          if (!roleArg) {
            return void await message.reply(`Please specify a role. Usage: \`${prefix}commandperms remove <@role>\``);
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

          if (!settings.commandAllowedRoles?.includes(roleId)) {
            return void await message.reply('That role is not in the command allowlist.');
          }

          settings.commandAllowedRoles = settings.commandAllowedRoles.filter((id: string) => id !== roleId);
          await settings.save();
          settingsCache.invalidate(guild.id);

          const note = settings.commandAllowedRoles.length === 0
            ? ' The allowlist is now empty - everyone can use commands again.'
            : '';
          return void await message.reply(`Removed <@&${roleId}> from the command allowlist.${note}`);
        }

        case 'list': {
          const roles: string[] = settings.commandAllowedRoles || [];

          if (roles.length === 0) {
            return void await message.reply('No command role restrictions are set. Everyone can use bot commands.');
          }

          const roleList = roles.map((id: string) => `<@&${id}>`).join('\n');
          return void await message.reply(`**Allowed Command Roles:**\n${roleList}\n\nOnly members with one of these roles (plus staff/admins) can use non-admin commands.`);
        }

        case 'clear': {
          if (!settings.commandAllowedRoles || settings.commandAllowedRoles.length === 0) {
            return void await message.reply('No command role restrictions to clear.');
          }

          settings.commandAllowedRoles = [];
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void await message.reply('Cleared all command role restrictions. Everyone can use bot commands again.');
        }
      }

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !commandperms (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !commandperms: ${error.message || error}`);
        message.reply('An error occurred while managing command permissions.').catch(() => {});
      }
    }
  }
};

export default command;
