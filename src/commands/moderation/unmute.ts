import type { Command } from '../../types';
import parseUserId from '../../utils/parseUserId';
import { logModAction } from '../../utils/logger';
import settingsCache from '../../utils/settingsCache';
import ModerationLog from '../../models/ModerationLog';
import isNetworkError from '../../utils/isNetworkError';
import { isPermDenied, PERM_MESSAGES } from '../../utils/permError';

const command: Command = {
  name: 'unmute',
  description: 'Remove a Fluxer timeout from a member so they can send messages and join voice again',
  usage: '<@user or user ID>',
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
      return void await message.reply(`Usage: \`${prefix}unmute <user>\``);
    }

    const userId = parseUserId(args[0]);
    if (!userId) {
      return void await message.reply('Please provide a valid user mention or ID.');
    }

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

    const settings = await settingsCache.get(guild.id);
    const muteRoleId = settings?.moderation?.muteRoleId || settings?.muteRoleId;
    const muteMethod: 'auto' | 'timeout' | 'mute_role' = settings?.moderation?.muteMethod || 'auto';

    const isTimeoutMuted = targetMember.communicationDisabledUntil && targetMember.communicationDisabledUntil > new Date();
    const memberRoleIds: string[] = targetMember.roles?.roleIds ?? [];
    const isRoleMuted = !!(muteRoleId && memberRoleIds.includes(muteRoleId));

    const unmuteByTimeout = muteMethod === 'timeout' || muteMethod === 'auto';
    const unmuteByRole = muteMethod === 'mute_role' || muteMethod === 'auto';

    if ((!unmuteByTimeout || !isTimeoutMuted) && (!unmuteByRole || !isRoleMuted)) {
      return void await message.reply('That user is not currently muted.');
    }

    try {
      if (unmuteByRole && isRoleMuted && muteRoleId) {
        await targetMember.removeRole(muteRoleId);
      }

      if (unmuteByTimeout && isTimeoutMuted) {
        await targetMember.edit({
          communication_disabled_until: null
        });
      }

      await message.reply(`Successfully unmuted **${targetMember.user?.username || targetMember.id}** (<@${targetMember.id}>).`);

      await logModAction(guild, (message as any).author, targetMember.user || targetMember, 'unmute', 'Timeout removed', { client });

      await ModerationLog.logAction({
        guildId: guild.id,
        targetId: targetMember.id,
        userId: (message as any).author.id,
        action: 'unmute',
        reason: 'Unmuted by moderator'
      });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !unmute (ECONNRESET)`);
      } else if (isPermDenied(error)) {
        message.reply(PERM_MESSAGES.unmute).catch(() => {});
      } else {
        console.error(`[${guildName}] Error in !unmute: ${error.message || error}`);
        message.reply('An error occurred while trying to unmute that member.').catch(() => {});
      }
    }
  }
};

export default command;
