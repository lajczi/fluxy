import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import { canManageRole } from '../../utils/permissions';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'autorole',
  description: 'Automatically assign a role to every new member who joins the server',
  usage: 'set <@role> | disable | status>',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) {
      guild = await client.guilds.fetch((message as any).guildId);
    }
    if (!guild) return void await message.reply('This command can only be used in a server.');

    const sub = args[0]?.toLowerCase();

    if (!sub || !['set', 'disable', 'status'].includes(sub)) {
      return void await message.reply(
        '**Usage:**\n' +
        `\`${prefix}autorole set <@role>\` - set the role given to every new member\n` +
        `\`${prefix}autorole disable\` - remove the auto-role\n` +
        `\`${prefix}autorole status\` - show the current auto-role`
      );
    }

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);

      if (sub === 'set') {
        const roleArg = args[1];
        if (!roleArg) return void await message.reply(`Please provide a role. Usage: \`${prefix}autorole set <@role>\``);

        const roleMention = roleArg.match(/^<@&(\d{17,19})>$/);
        let roleId: string;
        if (roleMention) {
          roleId = roleMention[1];
        } else if (/^\d{17,19}$/.test(roleArg)) {
          roleId = roleArg;
        } else {
          return void await message.reply('Please provide a valid role mention or role ID.');
        }

        let role = guild.roles?.get(roleId);
        if (!role) {
          try {
            role = await guild.fetchRole(roleId);
          } catch {
          }
        }
        if (!role) return void await message.reply('That role does not exist in this server.');

        let commandMember = guild.members?.get(message.author.id);
        if (!commandMember) {
          try { commandMember = await guild.fetchMember(message.author.id); } catch {}
        }
        if (commandMember) {
          const check = canManageRole(commandMember, role, guild);
          if (!check.allowed) return void await message.reply(check.reason || 'You cannot manage that role.');
        }

        let hierarchyWarning = '';
        const botUserId = client.user?.id;
        let botMember = botUserId ? guild.members?.get(botUserId) : null;
        if (!botMember && botUserId) {
          try { botMember = await guild.fetchMember(botUserId); } catch {}
        }
        if (botMember) {
          const botRoleIds = botMember.roles?.roleIds ?? [];
          const botHighestPos = botRoleIds.length > 0
            ? Math.max(0, ...botRoleIds.map((id: string) => guild.roles?.get(id)?.position || 0))
            : 0;
          if (role.position >= botHighestPos) {
            hierarchyWarning = `\n\nMy role is currently below **${role.name}** - new members won't receive this role until you move my role above it in **Server Settings > Roles**.`;
          }
        }

        settings.autoroleId = roleId;
        await settings.save();
        settingsCache.invalidate(guild.id);

        return void await message.reply(`Auto-role set to **${role.name}**. New members will automatically receive this role when they join.${hierarchyWarning}`);
      }

      if (sub === 'disable') {
        if (!settings.autoroleId) return void await message.reply('Auto-role is not currently enabled.');

        settings.autoroleId = null;
        await settings.save();
        settingsCache.invalidate(guild.id);

        return void await message.reply('Auto-role has been disabled. New members will no longer receive a role automatically.');
      }

      if (sub === 'status') {
        if (!settings.autoroleId) {
          return void await message.reply(`Auto-role is currently **disabled**. Use \`${prefix}autorole set <@role>\` to enable it.`);
        }

        let roleName = settings.autoroleId;
        const role = guild.roles?.get(settings.autoroleId);
        if (role) roleName = role.name;

        return void await message.reply(`Auto-role is currently set to **${roleName}** (<@&${settings.autoroleId}>).`);
      }

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !autorole (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !autorole: ${error.message || error}`);
        message.reply('An error occurred while updating the auto-role setting.').catch(() => {});
      }
    }
  }
};

export default command;
