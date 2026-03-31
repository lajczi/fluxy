import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { t, normalizeLocale } from '../../i18n';

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
      return void await message.reply(t('en', 'commands.admin.commandperms.serverOnly'));
    }

    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || !['add', 'remove', 'list', 'clear'].includes(subcommand)) {
      return void await message.reply(t('en', 'commands.admin.commandperms.usage', { prefix }));
    }

    try {
      const settings = await (GuildSettings as any).getOrCreate(guild.id);
      const lang = normalizeLocale(settings?.language);

      switch (subcommand) {
        case 'add': {
          const roleArg = args[1];
          if (!roleArg) {
            return void await message.reply(t(lang, 'commands.admin.commandperms.roleRequiredUsageAdd', { prefix }));
          }

          const roleMention = roleArg.match(/^<@&(\d{17,19})>$/);
          let roleId: string;
          if (roleMention) {
            roleId = roleMention[1];
          } else if (/^\d{17,19}$/.test(roleArg)) {
            roleId = roleArg;
          } else {
            return void await message.reply(t(lang, 'commands.admin.commandperms.invalidRole'));
          }

          let role = guild.roles?.get(roleId);
          if (!role) {
            try { role = await guild.fetchRole(roleId); } catch {}
          }
          if (!role) {
            return void await message.reply(t(lang, 'commands.admin.commandperms.roleDoesNotExist'));
          }

          if (settings.commandAllowedRoles?.includes(roleId)) {
            return void await message.reply(t(lang, 'commands.admin.commandperms.alreadyAllowed', { roleName: role.name }));
          }

          if (!settings.commandAllowedRoles) {
            settings.commandAllowedRoles = [];
          }
          settings.commandAllowedRoles.push(roleId);
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void await message.reply(t(lang, 'commands.admin.commandperms.added', { roleName: role.name }));
        }

        case 'remove': {
          const roleArg = args[1];
          if (!roleArg) {
            return void await message.reply(t(lang, 'commands.admin.commandperms.roleRequiredUsageRemove', { prefix }));
          }

          const roleMention = roleArg.match(/^<@&(\d{17,19})>$/);
          let roleId: string;
          if (roleMention) {
            roleId = roleMention[1];
          } else if (/^\d{17,19}$/.test(roleArg)) {
            roleId = roleArg;
          } else {
            return void await message.reply(t(lang, 'commands.admin.commandperms.invalidRole'));
          }

          if (!settings.commandAllowedRoles?.includes(roleId)) {
            return void await message.reply(t(lang, 'commands.admin.commandperms.notInAllowlist'));
          }

          settings.commandAllowedRoles = settings.commandAllowedRoles.filter((id: string) => id !== roleId);
          await settings.save();
          settingsCache.invalidate(guild.id);

          const note = settings.commandAllowedRoles.length === 0
            ? t(lang, 'commands.admin.commandperms.noteAllowlistEmpty')
            : '';
          return void await message.reply(t(lang, 'commands.admin.commandperms.removed', { roleId }) + note);
        }

        case 'list': {
          const roles: string[] = settings.commandAllowedRoles || [];

          if (roles.length === 0) {
            return void await message.reply(t(lang, 'commands.admin.commandperms.noRestrictions'));
          }

          const roleList = roles.map((id: string) => `<@&${id}>`).join('\n');
          return void await message.reply(t(lang, 'commands.admin.commandperms.list', { roleList }));
        }

        case 'clear': {
          if (!settings.commandAllowedRoles || settings.commandAllowedRoles.length === 0) {
            return void await message.reply(t(lang, 'commands.admin.commandperms.noRestrictionsToClear'));
          }

          settings.commandAllowedRoles = [];
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void await message.reply(t(lang, 'commands.admin.commandperms.clearedAll'));
        }
      }

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !commandperms (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !commandperms: ${error.message || error}`);
        const cached: any = await settingsCache.get(guild.id).catch(() => null);
        const lang = normalizeLocale(cached?.language);
        message.reply(t(lang, 'commands.admin.commandperms.errors.generic')).catch(() => {});
      }
    }
  }
};

export default command;
