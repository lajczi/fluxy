import type { Command } from '../../types';
import { canManageRole } from '../../utils/permissions';
import isNetworkError from '../../utils/isNetworkError';
import settingsCache from '../../utils/settingsCache';
import { t, normalizeLocale } from '../../i18n';

const command: Command = {
  name: 'roleclear',
  description: 'Remove a role from every member who currently has it',
  usage: '<@role or role ID>',
  category: 'admin',
  permissions: ['ManageRoles'],
  cooldown: 30,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply(t('en', 'commands.admin.roleclear.serverOnly'));

    const cached: any = await settingsCache.get(guild.id).catch(() => null);
    const lang = normalizeLocale(cached?.language);

    const roleArg = args[0];
    if (!roleArg) return void await message.reply(t(lang, 'commands.admin.roleclear.usage', { prefix }));

    const roleMention = roleArg.match(/^<@&(\d{17,19})>$/);
    let roleId: string;
    if (roleMention) roleId = roleMention[1];
    else if (/^\d{17,19}$/.test(roleArg)) roleId = roleArg;
    else return void await message.reply(t(lang, 'commands.admin.roleclear.invalidRole'));

    let role = guild.roles?.get(roleId);
    if (!role) {
      try { role = await guild.fetchRole(roleId); } catch {}
    }
    if (!role) return void await message.reply(t(lang, 'commands.admin.roleclear.roleDoesNotExist'));

    let moderator = guild.members?.get(message.author.id);
    if (!moderator) {
      try { moderator = await guild.fetchMember(message.author.id); } catch {}
    }
    if (moderator) {
      const check = canManageRole(moderator, role, guild);
      if (!check.allowed) return void await message.reply(check.reason || 'You cannot manage that role.');
    }

    await message.reply(t(lang, 'commands.admin.roleclear.removing', { roleName: role.name }));

    let members: any[];
    try {
      members = [];
      let lastId: string | undefined;
      while (true) {
        const batch = await guild.members.fetch({ limit: 1000, ...(lastId && { after: lastId }) });
        const arr = Array.isArray(batch) ? batch : [...batch.values()];
        members.push(...arr);
        if (arr.length < 1000) break;
        lastId = arr[arr.length - 1].id;
      }
    } catch (err: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(err)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !roleclear (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !roleclear: ${err.message || err}`);
      }
      return void await message.reply(t(lang, 'commands.admin.roleclear.failedFetchMembers'));
    }

    const hasRole = members.filter((m: any) => {
      if (typeof m.roles?.has === 'function') return m.roles.has(roleId);
      const ids = m.roles?.roleIds ?? (Array.isArray(m.roles) ? m.roles : []);
      return ids.includes(roleId);
    });

    if (hasRole.length === 0) {
      return void await message.reply(t(lang, 'commands.admin.roleclear.noMembersHaveRole', { roleName: role.name }));
    }

    let removed = 0, failed = 0;

    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 1000;

    for (let i = 0; i < hasRole.length; i += BATCH_SIZE) {
      const batch = hasRole.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (m: any) => {
        try {
          await m.removeRole(roleId);
          removed++;
        } catch {
          failed++;
        }
      }));
      if (i + BATCH_SIZE < hasRole.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    let result = t(lang, 'commands.admin.roleclear.donePrefix', { roleName: role.name, removed });
    if (failed > 0) result += t(lang, 'commands.admin.roleclear.doneFailedSuffix', { failed });
    return void await message.reply(result);
  }
};

export default command;
