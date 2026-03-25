import type { Command } from '../../types';
import { canManageRole } from '../../utils/permissions';
import isNetworkError from '../../utils/isNetworkError';
import {
  beginBulkRoleUpdateSuppression,
  endBulkRoleUpdateSuppression,
  logServerEvent,
} from '../../utils/logger';

const command: Command = {
  name: 'roleall',
  description: 'Assign a role to every non-bot member in the server - members who already have it are skipped',
  usage: '<@role or role ID>',
  category: 'admin',
  permissions: ['ManageRoles'],
  cooldown: 30,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply('This command can only be used in a server.');

    const roleArg = args[0];
    if (!roleArg) return void await message.reply(`Usage: \`${prefix}roleall <@role>\``);

    const roleMention = roleArg.match(/^<@&(\d{17,19})>$/);
    let roleId: string;
    if (roleMention) roleId = roleMention[1];
    else if (/^\d{17,19}$/.test(roleArg)) roleId = roleArg;
    else return void await message.reply('Please provide a valid role mention or role ID.');

    let role = guild.roles?.get(roleId);
    if (!role) {
      try { role = await guild.fetchRole(roleId); } catch {}
    }
    if (!role) return void await message.reply('That role does not exist in this server.');

    let moderator = guild.members?.get(message.author.id);
    if (!moderator) {
      try { moderator = await guild.fetchMember(message.author.id); } catch {}
    }
    if (moderator) {
      const check = canManageRole(moderator, role, guild);
      if (!check.allowed) return void await message.reply(check.reason || 'You cannot manage that role.');
    }

    await message.reply(`Assigning **${role.name}** to all members... this may take a moment.`);

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
        console.warn(`[${guildName}] Fluxer API unreachable during !roleall (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !roleall: ${err.message || err}`);
      }
      return void await message.reply('Failed to fetch server members.');
    }

    if (members.length === 0) {
      return void await message.reply('No members found.');
    }

    const needsRole = members.filter((m: any) => {
      if (m.user?.bot) return false;
      if (typeof m.roles?.has === 'function') return !m.roles.has(roleId);
      const ids = m.roles?.roleIds ?? (Array.isArray(m.roles) ? m.roles : []);
      return !ids.includes(roleId);
    });

    const skipped = members.filter((m: any) => !m.user?.bot).length - needsRole.length;
    let assigned = 0, failed = 0;

    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 1000;

    beginBulkRoleUpdateSuppression(guild.id, 15 * 60 * 1000);
    try {
      for (let i = 0; i < needsRole.length; i += BATCH_SIZE) {
        const batch = needsRole.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (m: any) => {
          try {
            await m.addRole(roleId);
            assigned++;
          } catch {
            failed++;
          }
        }));
        if (i + BATCH_SIZE < needsRole.length) {
          await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
      }
    } finally {
      endBulkRoleUpdateSuppression(guild.id);
    }

    let result = `Done! Assigned **${role.name}** to **${assigned}** member(s).`;
    if (skipped > 0) result += ` ${skipped} already had it.`;
    if (failed > 0) result += ` ${failed} failed (missing permissions or unknown error).`;

    await logServerEvent(
      guild,
      'Bulk Role Assignment',
      failed > 0 ? 0xf39c12 : 0x2ecc71,
      [
        { name: 'Role', value: `<@&${roleId}>`, inline: true },
        { name: 'Assigned', value: String(assigned), inline: true },
        { name: 'Already Had Role', value: String(skipped), inline: true },
        { name: 'Failed', value: String(failed), inline: true },
        { name: 'Executed By', value: `<@${message.author.id}>`, inline: true },
      ],
      client,
      {
        description: `Bulk role assignment completed for **${role.name}**.`,
        footer: `Role ID: ${roleId}`,
        eventType: 'member_role_update',
      }
    ).catch(() => {});

    return void await message.reply(result);
  }
};

export default command;
