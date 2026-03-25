import type { Command } from '../../types';
import parseUserId from '../../utils/parseUserId';
import { canModerate } from '../../utils/permissions';
import { logModAction } from '../../utils/logger';
import ModerationLog from '../../models/ModerationLog';
import isNetworkError from '../../utils/isNetworkError';
import { isPermDenied, PERM_MESSAGES } from '../../utils/permError';

const command: Command = {
  name: 'kick',
  description: 'Remove a member from the server \u2014 they can rejoin with an invite. Reason is logged to the mod log channel',
  usage: '<@user or user ID> [reason]',
  category: 'moderation',
  permissions: ['KickMembers'],
  cooldown: 3,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) {
      guild = await client.guilds.fetch((message as any).guildId);
    }

    if (!guild) {
      return void await message.reply('This command can only be used in a server.');
    }

    if (!args[0]) {
      return void await message.reply(`Usage: \`${prefix}kick <user> [reason]\``);
    }

    const userId = parseUserId(args[0]);
    if (!userId) {
      return void await message.reply('Please provide a valid user mention or ID.');
    }

    const reason = args.slice(1).join(' ').trim() || 'No reason provided';

    let moderator: any = guild.members?.get((message as any).author.id);
    if (!moderator) {
      moderator = await guild.fetchMember((message as any).author.id);
    }

    let targetMember: any = guild.members?.get(userId);
    if (!targetMember) {
      try {
        targetMember = await guild.fetchMember(userId);
      } catch {
        return void await message.reply('That user is not in this server.');
      }
    }

    if (!targetMember) {
      return void await message.reply('That user is not in this server.');
    }

    const modCheck = canModerate(moderator, targetMember);
    if (!modCheck.canModerate) {
      return void await message.reply(`${modCheck.reason}`);
    }

    const botUserId = client.user?.id;
    let botMember: any = null;
    if (botUserId) {
      try {
        await guild.fetchRoles?.();
        botMember = await guild.fetchMember(botUserId);
      } catch {}
      if (!botMember) botMember = guild.members?.get?.(botUserId) ?? guild.members?.me;
    }
    if (botMember) {
      const botCheck = canModerate(botMember as any, targetMember);
      if (!botCheck.canModerate) {
        return void await message.reply("I cannot kick this user because their highest role is equal to or above mine. Ask a server admin to move my role higher in the role list.");
      }
    }

    try {
      await guild.kick(targetMember.id);

      await message.reply(`Successfully kicked **${targetMember.user?.username || targetMember.id}** (<@${targetMember.id}>).\n**Reason:** ${reason}`);

      await logModAction(guild, (message as any).author, targetMember.user || targetMember, 'kick', reason, { client });

      await ModerationLog.logAction({
        guildId: guild.id,
        targetId: targetMember.id,
        userId: (message as any).author.id,
        action: 'kick',
        reason
      });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !kick (ECONNRESET)`);
      } else if (isPermDenied(error)) {
        message.reply(PERM_MESSAGES.kick).catch(() => {});
      } else {
        console.error(`[${guildName}] Error in !kick: ${error.message || error}`);
        message.reply('An error occurred while trying to kick that member.').catch(() => {});
      }
    }
  }
};

export default command;
