import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { t, normalizeLocale } from '../../i18n';

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
      return void await message.reply(t('en', 'commands.admin.slowmodeperms.serverOnly'));
    }

    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || !['add', 'remove', 'list', 'clear'].includes(subcommand)) {
      return void await message.reply(t('en', 'commands.admin.slowmodeperms.usage', { prefix }));
    }

    try {
      const settings = await (GuildSettings as any).getOrCreate(guild.id);
      const lang = normalizeLocale(settings?.language);

      switch (subcommand) {
        case 'add': {
          const roleArg = args[1];
          if (!roleArg) {
            return void await message.reply(t(lang, 'commands.admin.slowmodeperms.roleRequiredUsageAdd', { prefix }));
          }

          const roleMention = roleArg.match(/^<@&(\d{17,19})>$/);
          let roleId: string;
          if (roleMention) {
            roleId = roleMention[1];
          } else if (/^\d{17,19}$/.test(roleArg)) {
            roleId = roleArg;
          } else {
            return void await message.reply(t(lang, 'commands.admin.slowmodeperms.invalidRole'));
          }

          let role = guild.roles?.get(roleId);
          if (!role) {
            try { role = await guild.fetchRole(roleId); } catch {}
          }
          if (!role) {
            return void await message.reply(t(lang, 'commands.admin.slowmodeperms.roleDoesNotExist'));
          }

          if (settings.slowmodeAllowedRoles?.includes(roleId)) {
            return void await message.reply(t(lang, 'commands.admin.slowmodeperms.alreadyAllowed', { roleName: role.name }));
          }

          if (!settings.slowmodeAllowedRoles) {
            settings.slowmodeAllowedRoles = [];
          }
          settings.slowmodeAllowedRoles.push(roleId);
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void await message.reply(t(lang, 'commands.admin.slowmodeperms.added', { roleName: role.name, prefix }));
        }

        case 'remove': {
          const roleArg = args[1];
          if (!roleArg) {
            return void await message.reply(t(lang, 'commands.admin.slowmodeperms.roleRequiredUsageRemove', { prefix }));
          }

          const roleMention = roleArg.match(/^<@&(\d{17,19})>$/);
          let roleId: string;
          if (roleMention) {
            roleId = roleMention[1];
          } else if (/^\d{17,19}$/.test(roleArg)) {
            roleId = roleArg;
          } else {
            return void await message.reply(t(lang, 'commands.admin.slowmodeperms.invalidRole'));
          }

          if (!settings.slowmodeAllowedRoles?.includes(roleId)) {
            return void await message.reply(t(lang, 'commands.admin.slowmodeperms.notInAllowlist'));
          }

          settings.slowmodeAllowedRoles = settings.slowmodeAllowedRoles.filter((id: string) => id !== roleId);
          await settings.save();
          settingsCache.invalidate(guild.id);

          const note = settings.slowmodeAllowedRoles.length === 0
            ? t(lang, 'commands.admin.slowmodeperms.noteAllowlistEmpty')
            : '';
          return void await message.reply(t(lang, 'commands.admin.slowmodeperms.removed', { roleId }) + note);
        }

        case 'list': {
          const roles: string[] = settings.slowmodeAllowedRoles || [];

          if (roles.length === 0) {
            return void await message.reply(t(lang, 'commands.admin.slowmodeperms.noAllowOverrides', { prefix }));
          }

          const roleList = roles.map((id: string) => `<@&${id}>`).join('\n');
          return void await message.reply(t(lang, 'commands.admin.slowmodeperms.list', { roleList, prefix }));
        }

        case 'clear': {
          if (!settings.slowmodeAllowedRoles || settings.slowmodeAllowedRoles.length === 0) {
            return void await message.reply(t(lang, 'commands.admin.slowmodeperms.noOverridesToClear'));
          }

          settings.slowmodeAllowedRoles = [];
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void await message.reply(t(lang, 'commands.admin.slowmodeperms.clearedAll', { prefix }));
        }
      }

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !slowmodeperms (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !slowmodeperms: ${error.message || error}`);
        const cached: any = await settingsCache.get(guild.id).catch(() => null);
        const lang = normalizeLocale(cached?.language);
        message.reply(t(lang, 'commands.admin.slowmodeperms.errors.generic')).catch(() => {});
      }
    }
  }
};

export default command;
