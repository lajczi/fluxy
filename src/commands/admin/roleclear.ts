import type { Command } from '../../types';
import { canManageRole } from '../../utils/permissions';
import isNetworkError from '../../utils/isNetworkError';

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
    if (!guild) return void await message.reply('This command can only be used in a server.');

    const roleArg = args[0];
    if (!roleArg) return void await message.reply(`Usage: \`${prefix}roleclear <@role>\``);

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

    await message.reply(`Removing **${role.name}** from all members who have it... this may take a moment.`);

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
      return void await message.reply('Failed to fetch server members.');
    }

    const hasRole = members.filter((m: any) => {
      if (typeof m.roles?.has === 'function') return m.roles.has(roleId);
      const ids = m.roles?.roleIds ?? (Array.isArray(m.roles) ? m.roles : []);
      return ids.includes(roleId);
    });

    if (hasRole.length === 0) {
      return void await message.reply(`No members currently have **${role.name}**.`);
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

    let result = `Done! Removed **${role.name}** from **${removed}** member(s).`;
    if (failed > 0) result += ` ${failed} failed (missing permissions or unknown error).`;
    return void await message.reply(result);
  }
};

export default command;
