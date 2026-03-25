import ModerationLog from '../../models/ModerationLog';
import { logToChannel } from '../../utils/logger';
import { hasAnyPermission } from '../../utils/permissions';
import isNetworkError from '../../utils/isNetworkError';
import * as moderationQueue from '../../utils/moderationQueue';
import * as roleQueue from '../../utils/roleQueue';
import * as messageDeleteQueue from '../../utils/messageDeleteQueue';

const REASON = 'Honeypot triggered';

async function check(message: any, client: any, settings: any): Promise<boolean> {
  const honeypots = settings?.honeypotChannels;
  if (!honeypots?.length) return false;

  const channelId = message.channelId || message.channel?.id;
  const entry = honeypots.find((h: any) => h.channelId === channelId);
  if (!entry) return false;

  if (entry.enabled === false) return false;

  const guild = message.guild || await client.guilds.fetch(message.guildId).catch(() => null);
  if (!guild) return false;

  const author = message.author;

  let member = guild.members?.get(author.id);
  if (!member) {
    try {
      member = await guild.fetchMember(author.id);
    } catch {
      return false;
    }
  }

  if (hasAnyPermission(member, ['ManageMessages', 'Administrator'])) return false;

  try {
    await message.delete();
  } catch (delErr: any) {
    if (isNetworkError(delErr)) {
      const msgId = message.id;
      if (msgId && channelId) messageDeleteQueue.enqueue(channelId, msgId);
    }
  }

  const action = entry.action || 'ban';

  try {
    if (action === 'ban') {
      await guild.ban(author.id, {
        reason: REASON,
        delete_message_days: entry.banDeleteDays ?? 1
      });

    } else if (action === 'kick') {
      await guild.kick(author.id);

    } else if (action === 'timeout') {
      const durationMs = (entry.timeoutHours ?? 24) * 3600000;
      await member.edit({
        communication_disabled_until: new Date(Date.now() + durationMs).toISOString(),
        timeout_reason: REASON
      });

    } else if (action === 'role') {
      if (!entry.roleId) {
        console.error(`[${guild.name}] Honeypot role action in <#${channelId}> has no roleId configured - skipping.`);
        return true;
      }
      await member.addRole(entry.roleId);
    }

    const embedAction = action === 'role' ? 'warn' : action;
    await logToChannel(guild, null, {
      action: embedAction,
      title: `Honeypot Triggered - ${author.username || author.id}`,
      description: `<@${author.id}> sent a message in a honeypot channel and was actioned.`,
      fields: [
        { name: 'User',    value: `<@${author.id}> (${author.id})`, inline: true },
        { name: 'Channel', value: `<#${channelId}>`,                inline: true },
        { name: 'Action',  value: formatAction(entry),              inline: true },
      ],
      footer: `User ID: ${author.id}`,
      client,
    }).catch(() => {});

    const alertRoleId  = settings.honeypotAlertRoleId;
    const logChannelId = settings.logChannelId;
    if (alertRoleId && logChannelId) {
      const logChannel = guild.channels?.get(logChannelId);
      if (logChannel) {
        logChannel.send(`<@&${alertRoleId}>`).catch(() => {});
      }
    }

    await ModerationLog.logAction({
      guildId:  guild.id,
      targetId: author.id,
      userId:   'automod',
      action,
      reason:   REASON,
      metadata: { honeypotChannelId: channelId } as any
    });

  } catch (err: any) {
    if (isNetworkError(err)) {
      if (action === 'ban') {
        moderationQueue.enqueue(guild.id, author.id, 'ban', { reason: REASON, deleteDays: entry.banDeleteDays ?? 1 });
      } else if (action === 'kick') {
        moderationQueue.enqueue(guild.id, author.id, 'kick', { reason: REASON });
      } else if (action === 'timeout') {
        const durationMs = (entry.timeoutHours ?? 24) * 3600000;
        moderationQueue.enqueue(guild.id, author.id, 'timeout', { durationMs, reason: REASON });
      } else if (action === 'role' && entry.roleId) {
        roleQueue.enqueue(guild.id, author.id, entry.roleId, 'add');
      }
    } else {
      console.error(`[${guild.name}] Honeypot ${action} failed for ${author.id}: ${err.message || err}`);
    }
  }

  return true;
}

function formatAction(entry: any): string {
  switch (entry.action) {
    case 'ban':     return `Ban (delete ${entry.banDeleteDays ?? 1}d of messages)`;
    case 'kick':    return 'Kick';
    case 'timeout': return `Timeout ${entry.timeoutHours ?? 24}h`;
    case 'role':    return entry.roleId ? `Role <@&${entry.roleId}>` : 'Role (unconfigured)';
    default:        return entry.action;
  }
}

export default { check };
