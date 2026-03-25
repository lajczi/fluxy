import type { Command } from '../../types';
import parseUserId from '../../utils/parseUserId';
import parseDuration from '../../utils/parseDuration';
import formatDuration from '../../utils/formatDuration';
import { canModerate } from '../../utils/permissions';
import { logModAction } from '../../utils/logger';
import ModerationLog from '../../models/ModerationLog';
import isNetworkError from '../../utils/isNetworkError';
import { isPermDenied, PERM_MESSAGES } from '../../utils/permError';

const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000;

const command: Command = {
  name: 'timeout',
  description: 'Apply a custom-length timeout to a member. Duration format: 1m, 30m, 2h, 7d \u2014 max 28 days',
  usage: '<@user or user ID> <duration> [reason]',
  category: 'moderation',
  permissions: ['ModerateMembers'],
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
      return void await message.reply(`Usage: \`${prefix}timeout <user> <duration> [reason]\`\nDuration format: 10s, 5m, 1h, 1d (max 28 days)`);
    }

    if (!args[1]) {
      return void await message.reply('Please specify a duration. Format: 10s, 5m, 1h, 1d (max 28 days)');
    }

    const userId = parseUserId(args[0]);
    if (!userId) {
      return void await message.reply('Please provide a valid user mention or ID.');
    }

    const duration = parseDuration(args[1]);
    if (!duration) {
      return void await message.reply('Invalid duration format. Use: 10s, 5m, 1h, 1d (max 28 days)');
    }

    if (duration > MAX_TIMEOUT) {
      return void await message.reply('Timeout duration cannot exceed 28 days.');
    }

    const reason = args.slice(2).join(' ').trim() || 'No reason provided';

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
        return void await message.reply("I cannot timeout this user because their highest role is equal to or above mine. Ask a server admin to move my role higher in the role list.");
      }
    }

    if (targetMember.communicationDisabledUntil && targetMember.communicationDisabledUntil > new Date()) {
      const remaining = new Date(targetMember.communicationDisabledUntil).getTime() - Date.now();
      return void await message.reply(`That user is already timed out. Remaining: ${formatDuration(remaining)}`);
    }

    try {
      const timeoutUntil = new Date(Date.now() + duration);
      await targetMember.edit({
        communication_disabled_until: timeoutUntil.toISOString(),
        timeout_reason: `${(message as any).author.username}: ${reason}`
      });

      await message.reply(`Successfully timed out **${targetMember.user?.username || targetMember.id}** (<@${targetMember.id}>) for **${formatDuration(duration)}**.\n**Reason:** ${reason}`);

      await logModAction(guild, (message as any).author, targetMember.user || targetMember, 'timeout', reason, {
        fields: [
          { name: 'Duration', value: formatDuration(duration), inline: true }
        ],
        client
      });

      await ModerationLog.logAction({
        guildId: guild.id,
        targetId: targetMember.id,
        userId: (message as any).author.id,
        action: 'timeout',
        reason,
        duration
      });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !timeout (ECONNRESET)`);
      } else if (isPermDenied(error)) {
        message.reply(PERM_MESSAGES.timeout).catch(() => {});
      } else {
        console.error(`[${guildName}] Error in !timeout: ${error.message || error}`);
        message.reply('An error occurred while trying to timeout that member.').catch(() => {});
      }
    }
  }
};

export default command;
