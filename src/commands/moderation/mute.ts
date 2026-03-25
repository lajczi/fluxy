// legacy atp

import type { Command } from '../../types';
import parseUserId from '../../utils/parseUserId';
import { canModerate, getMemberHighestRolePosition } from '../../utils/permissions';
import { logModAction } from '../../utils/logger';
import formatDuration from '../../utils/formatDuration';
import settingsCache from '../../utils/settingsCache';
import ModerationLog from '../../models/ModerationLog';
import isNetworkError from '../../utils/isNetworkError';
import { isPermDenied, PERM_MESSAGES } from '../../utils/permError';

const DEFAULT_MUTE_DURATION = 10 * 60 * 1000; // default mute, change if you would like :)

const command: Command = {
  name: 'mute',
  description: 'Apply a 10-minute timeout to a member \u2014 they cannot send messages or join voice. Use !timeout for a custom duration',
  usage: '<@user or user ID> [reason]',
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
      return void await message.reply(`Usage: \`${prefix}mute <user> [reason]\``);
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
      if (!(botMember as any).guild) (botMember as any).guild = guild;
      if (!(targetMember as any).guild) (targetMember as any).guild = guild;
      const botCheck = canModerate(botMember as any, targetMember);
      if (!botCheck.canModerate) {
        return void await message.reply("I cannot mute this user because their highest role is equal to or above mine. Ask a server admin to move my role higher in the role list.");
      }
    }

    if (targetMember.communicationDisabledUntil && targetMember.communicationDisabledUntil > new Date()) {
      return void await message.reply('That user is already muted.');
    }

    const settings = await settingsCache.get(guild.id);
    const muteRoleId = settings?.moderation?.muteRoleId || settings?.muteRoleId;
    const muteMethod: 'auto' | 'timeout' | 'mute_role' = settings?.moderation?.muteMethod || 'auto';

    try {
      const timeoutUntil = new Date(Date.now() + DEFAULT_MUTE_DURATION);

      let useMuteRole = false;
      if (muteRoleId && botMember) {
        const muteRole = guild.roles?.get(muteRoleId) ?? (guild.roles as any)?.cache?.get?.(muteRoleId);
        if (muteRole) {
          const muteRolePos = typeof (muteRole as any).position === 'number' ? (muteRole as any).position : 0;
          const botHighest = getMemberHighestRolePosition(botMember, guild);
          if (botHighest >= 0 && muteRolePos < botHighest) {
            useMuteRole = true;
          }
        }
      }

      if (muteMethod === 'mute_role' && !useMuteRole) {
          return void await message.reply('Mute method is set to **mute role only**, but I cannot apply the mute role (missing role, missing permission, or role hierarchy issue).');
      }

      const shouldUseRole = muteMethod === 'mute_role' || (muteMethod === 'auto' && useMuteRole);
      if (shouldUseRole && muteRoleId) {
          await targetMember.addRole(muteRoleId);

          await message.reply(`Successfully muted **${targetMember.user?.username || targetMember.id}** (<@${targetMember.id}>).\n**Reason:** ${reason}`);

          await logModAction(guild, (message as any).author, targetMember.user || targetMember, 'mute', reason, {
            fields: [
              { name: 'Method', value: 'Mute Role', inline: true },
            ],
            client
          });

          await ModerationLog.logAction({
            guildId: guild.id,
            targetId: targetMember.id,
            userId: (message as any).author.id,
            action: 'mute',
            reason,
            duration: DEFAULT_MUTE_DURATION
          });

          return;
      }

      if (muteMethod === 'mute_role') {
        return void await message.reply('Mute role method is enabled, but no mute role is configured.');
      }

      await targetMember.edit({
        communication_disabled_until: timeoutUntil.toISOString(),
        timeout_reason: `${(message as any).author.username}: ${reason}`
      });

      await message.reply(`Successfully muted **${targetMember.user?.username || targetMember.id}** (<@${targetMember.id}>) for **${formatDuration(DEFAULT_MUTE_DURATION)}**.\n**Reason:** ${reason}`);

      await logModAction(guild, (message as any).author, targetMember.user || targetMember, 'mute', reason, {
        fields: [
          { name: 'Duration', value: formatDuration(DEFAULT_MUTE_DURATION), inline: true }
        ],
        client
      });

      await ModerationLog.logAction({
        guildId: guild.id,
        targetId: targetMember.id,
        userId: (message as any).author.id,
        action: 'mute',
        reason,
        duration: DEFAULT_MUTE_DURATION
      });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !mute (ECONNRESET)`);
      } else if (isPermDenied(error)) {
        message.reply(PERM_MESSAGES.mute).catch(() => {});
      } else {
        console.error(`[${guildName}] Error in !mute: ${error.message || error}`);
        message.reply('An error occurred while trying to mute that member.').catch(() => {});
      }
    }
  }
};

export default command;
