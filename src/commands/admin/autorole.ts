import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import { canManageRole } from '../../utils/permissions';
import isNetworkError from '../../utils/isNetworkError';
import { t, normalizeLocale } from '../../i18n';

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
    if (!guild) return void (await message.reply(t('en', 'commands.admin.autorole.serverOnly')));

    const sub = args[0]?.toLowerCase();

    if (!sub || !['set', 'disable', 'status'].includes(sub)) {
      return void (await message.reply(t('en', 'commands.admin.autorole.usage', { prefix })));
    }

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      const lang = normalizeLocale(settings?.language);

      if (sub === 'set') {
        const roleArg = args[1];
        if (!roleArg)
          return void (await message.reply(t(lang, 'commands.admin.autorole.roleRequiredUsage', { prefix })));

        const roleMention = roleArg.match(/^<@&(\d{17,19})>$/);
        let roleId: string;
        if (roleMention) {
          roleId = roleMention[1];
        } else if (/^\d{17,19}$/.test(roleArg)) {
          roleId = roleArg;
        } else {
          return void (await message.reply(t(lang, 'commands.admin.autorole.invalidRole')));
        }

        let role = guild.roles?.get(roleId);
        if (!role) {
          try {
            role = await guild.fetchRole(roleId);
          } catch {}
        }
        if (!role) return void (await message.reply(t(lang, 'commands.admin.autorole.roleDoesNotExist')));

        let commandMember = guild.members?.get(message.author.id);
        if (!commandMember) {
          try {
            commandMember = await guild.fetchMember(message.author.id);
          } catch {}
        }
        if (commandMember) {
          const check = canManageRole(commandMember, role, guild);
          if (!check.allowed)
            return void (await message.reply(
              check.reason || t(lang, 'commands.admin.autorole.cannotManageRoleFallback'),
            ));
        }

        let hierarchyWarning = '';
        const botUserId = client.user?.id;
        let botMember = botUserId ? guild.members?.get(botUserId) : null;
        if (!botMember && botUserId) {
          try {
            botMember = await guild.fetchMember(botUserId);
          } catch {}
        }
        if (botMember) {
          const botRoleIds = botMember.roles?.roleIds ?? [];
          const botHighestPos =
            botRoleIds.length > 0
              ? Math.max(0, ...botRoleIds.map((id: string) => guild.roles?.get(id)?.position || 0))
              : 0;
          if (role.position >= botHighestPos) {
            hierarchyWarning = t(lang, 'commands.admin.autorole.hierarchyWarning', { roleName: role.name });
          }
        }

        settings.autoroleId = roleId;
        await settings.save();
        settingsCache.invalidate(guild.id);

        return void (await message.reply(
          t(lang, 'commands.admin.autorole.setDone', { roleName: role.name }) + hierarchyWarning,
        ));
      }

      if (sub === 'disable') {
        if (!settings.autoroleId)
          return void (await message.reply(t(lang, 'commands.admin.autorole.disabledNotEnabled')));

        settings.autoroleId = null;
        await settings.save();
        settingsCache.invalidate(guild.id);

        return void (await message.reply(t(lang, 'commands.admin.autorole.disabledDone')));
      }

      if (sub === 'status') {
        if (!settings.autoroleId) {
          return void (await message.reply(t(lang, 'commands.admin.autorole.statusDisabled', { prefix })));
        }

        let roleName = settings.autoroleId;
        const role = guild.roles?.get(settings.autoroleId);
        if (role) roleName = role.name;

        return void (await message.reply(
          t(lang, 'commands.admin.autorole.statusEnabled', { roleName, roleId: settings.autoroleId }),
        ));
      }
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !autorole (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !autorole: ${error.message || error}`);
        const cached: any = await settingsCache.get(guild.id).catch(() => null);
        const lang = normalizeLocale(cached?.language);
        message.reply(t(lang, 'commands.admin.autorole.errors.generic')).catch(() => {});
      }
    }
  },
};

export default command;
