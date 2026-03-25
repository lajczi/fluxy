import { EmbedBuilder } from '@fluxerjs/core';
import type { Command } from '../../types';
import parseUserId from '../../utils/parseUserId';
import { canModerate, getMemberHighestRolePosition } from '../../utils/permissions';
import { logModAction } from '../../utils/logger';
import Warning from '../../models/Warning';
import ModerationLog from '../../models/ModerationLog';
import isNetworkError from '../../utils/isNetworkError';
import settingsCache from '../../utils/settingsCache';

const command: Command = {
  name: 'warn',
  description: 'Issue a formal warning to a user \u2014 reason is stored and can be reviewed with !warnings or cleared with !clearwarns',
  usage: '<@user or user ID> <reason>',
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
      return void await message.reply(`Usage: \`${prefix}warn <user> <reason>\``);
    }

    if (!args[1]) {
      return void await message.reply('Please provide a reason for the warning.');
    }

    const userId = parseUserId(args[0]);
    if (!userId) {
      return void await message.reply('Please provide a valid user mention or ID.');
    }

    const reason = args.slice(1).join(' ').trim();

    let moderator: any = guild.members?.get((message as any).author.id);
    if (!moderator) {
      moderator = await guild.fetchMember((message as any).author.id);
    }

    let targetMember: any = guild.members?.get(userId);
    if (!targetMember) {
      try {
        targetMember = await guild.fetchMember(userId);
      } catch {
        targetMember = null;
      }
    }

    if (targetMember) {
      const modCheck = canModerate(moderator, targetMember);
      if (!modCheck.canModerate) {
        return void await message.reply(`${modCheck.reason}`);
      }
    }

    try {
      const warningRecord = await Warning.addWarning(guild.id, userId, (message as any).author.id, reason);
      const warningCount = warningRecord.warnings.length;

      let targetUser: any = targetMember?.user;
      if (!targetUser) {
        try {
          targetUser = await client.users.fetch(userId);
        } catch {
          targetUser = { id: userId, username: 'Unknown User' };
        }
      }

      await message.reply(`Successfully warned **${targetUser.username || targetUser.id}** (<@${targetUser.id}>).\n**Reason:** ${reason}\n**Total Warnings:** ${warningCount}`);

      try {
        const settings: any = await settingsCache.get(guild.id);
        const moderation = settings?.moderation ?? {};
        const autoMuteEnabled = moderation.autoMute === true;
        const muteMethod: 'auto' | 'timeout' | 'mute_role' = moderation.muteMethod || 'auto';
        const threshold = Number.isFinite(Number(moderation.autoMuteThreshold))
          ? Math.max(1, Number(moderation.autoMuteThreshold))
          : 3;

        if (autoMuteEnabled && warningCount >= threshold && targetMember) {
          const muteRoleId = moderation.muteRoleId || settings?.muteRoleId || null;
          const alreadyTimedOut = targetMember.communicationDisabledUntil && targetMember.communicationDisabledUntil > new Date();
          const alreadyRoleMuted = muteRoleId && targetMember.roles?.roleIds?.includes?.(muteRoleId);

          if (!alreadyTimedOut && !alreadyRoleMuted) {
            const botUserId = client.user?.id;
            let botMember: any = null;
            if (botUserId) {
              try {
                await guild.fetchRoles?.();
                botMember = await guild.fetchMember(botUserId);
              } catch {}
              if (!botMember) botMember = guild.members?.get?.(botUserId) ?? guild.members?.me;
            }

            let muted = false;
            const tryRole = muteMethod === 'mute_role' || muteMethod === 'auto';
            const tryTimeout = muteMethod === 'timeout' || muteMethod === 'auto';

            if (tryRole && muteRoleId && botMember) {
              const muteRole = guild.roles?.get(muteRoleId) ?? (guild.roles as any)?.cache?.get?.(muteRoleId);
              if (muteRole) {
                const muteRolePos = typeof (muteRole as any).position === 'number' ? (muteRole as any).position : 0;
                const botHighest = getMemberHighestRolePosition(botMember, guild);
                if (botHighest >= 0 && muteRolePos < botHighest) {
                  await targetMember.addRole(muteRoleId);
                  muted = true;
                }
              }
            }

            if (!muted && tryTimeout) {
              const canBotModerate = botMember ? canModerate(botMember, targetMember).canModerate : true;
              if (canBotModerate) {
                const timeoutUntil = new Date(Date.now() + 10 * 60 * 1000);
                await targetMember.edit({
                  communication_disabled_until: timeoutUntil.toISOString(),
                  timeout_reason: `Auto-mute threshold reached (${warningCount}/${threshold})`,
                });
                muted = true;
              }
            }

            if (muted) {
              await message.reply(`⚠️ Auto-mute applied to <@${targetMember.id}> after reaching **${warningCount}** warnings (threshold: **${threshold}**).`);
              await logModAction(guild, (message as any).author, targetUser, 'mute', `Auto-mute threshold reached (${warningCount}/${threshold})`, { client });
              await ModerationLog.logAction({
                guildId: guild.id,
                targetId: targetMember.id,
                userId: (message as any).author.id,
                action: 'mute',
                reason: `Auto-mute threshold reached (${warningCount}/${threshold})`,
                duration: 10 * 60 * 1000,
              });
            }
          }
        }
      } catch (autoMuteErr: any) {
        console.warn(`[${guild.name}] Auto-mute on warn failed: ${autoMuteErr?.message || autoMuteErr}`);
      }

      try {
        if (targetUser && targetUser.id) {
          const dmEmbed = new EmbedBuilder()
            .setTitle(`Warning in ${guild.name}`)
            .setDescription(`You have received a warning in **${guild.name}**.`)
            .addFields(
              { name: 'Reason', value: reason },
              { name: 'Total Warnings', value: `${warningCount}` }
            )
            .setColor(0xf39c12)
            .setTimestamp(new Date());

          const dmChannel = await (client as any).users.createDM?.(targetUser.id);
          if (dmChannel) {
            await dmChannel.send({ embeds: [dmEmbed] });
          }
        }
      } catch (dmError: any) {
        console.log('Could not DM user about warning:', dmError.message);
      }

      await logModAction(guild, (message as any).author, targetUser, 'warn', reason, {
        fields: [
          { name: 'Total Warnings', value: `${warningCount}`, inline: true }
        ],
        client
      });

      await ModerationLog.logAction({
        guildId: guild.id,
        targetId: userId,
        userId: (message as any).author.id,
        action: 'warn',
        reason,
        metadata: { caseNumber: warningCount } as any
      });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !warn (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !warn: ${error.message || error}`);
        message.reply('An error occurred while trying to warn that user.').catch(() => {});
      }
    }
  }
};

export default command;
