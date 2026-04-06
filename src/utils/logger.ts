import { EmbedBuilder, PermissionFlags } from '@erinjs/core';
import type { Client, GuildChannel } from '@erinjs/core';
import settingsCache from './settingsCache';
import isNetworkError from './isNetworkError';
import * as embedQueue from './embedQueue';

const REQUIRED_SEND_PERMS = ['ViewChannel', 'SendMessages', 'EmbedLinks'] as const;

function hasRequiredChannelPerms(me: any, channel: any): boolean {
  if (!me?.permissionsIn || !channel) return true;
  try {
    const chanPerms = me.permissionsIn(channel);
    for (const p of REQUIRED_SEND_PERMS) {
      const flag = (PermissionFlags as any)[p];
      if (flag && !chanPerms.has(flag)) return false;
    }
    return true;
  } catch {
    return true;
  }
}

function logMissingChannelPerms(guild: any, channel: any, channelId: string): void {
  const name = channel && 'name' in channel ? (channel as any).name : channelId;
  console.error(
    `[sendEmbed] Cannot send embed to channel #${name} (${channelId}): channel permission overrides deny the bot Send Messages / Embed Links. Fix channel permissions for the bot role in guild "${guild?.name ?? '?'}".`,
  );
}

function diagnosePermissions(guild: any, channelId: string, error: any, resolvedChannel?: any): string {
  const parts: string[] = [];

  // Guild + channel context
  parts.push(`guild="${guild?.name ?? '?'}" (${guild?.id ?? '?'})`);
  parts.push(`channel=${channelId}`);

  const channel = (resolvedChannel ?? guild?.channels?.get(channelId)) as GuildChannel | undefined;
  if (channel && 'name' in channel) {
    parts.push(`channelName=#${(channel as any).name}`);
  }

  // Get bot member
  const me = guild?.members?.me;
  if (!me) {
    parts.push('botMember=NOT_CACHED (guild.members.me is null)');
    return parts.join(' | ');
  }

  const guildPerms = me.permissions;
  if (guildPerms) {
    const guildPermList = REQUIRED_SEND_PERMS.map((p) => {
      const flag = (PermissionFlags as any)[p];
      return `${p}=${flag ? guildPerms.has(flag) : '?'}`;
    });
    parts.push(`guildPerms=[${guildPermList.join(', ')}]`);
  } else {
    parts.push('guildPerms=UNAVAILABLE');
  }

  if (channel && me.permissionsIn) {
    try {
      const chanPerms = me.permissionsIn(channel);
      const chanPermList = REQUIRED_SEND_PERMS.map((p) => {
        const flag = (PermissionFlags as any)[p];
        return `${p}=${flag ? chanPerms.has(flag) : '?'}`;
      });
      parts.push(`channelPerms=[${chanPermList.join(', ')}]`);
    } catch {
      parts.push('channelPerms=ERROR_COMPUTING');
    }
  } else {
    parts.push('channelPerms=CHANNEL_NOT_CACHED');
  }

  const roleIds = me.roles?.roleIds ?? me._roles;
  if (roleIds) {
    const roleNames = roleIds.map((id: string) => guild.roles?.get(id)?.name ?? id).slice(0, 10);
    parts.push(`botRoles=[${roleNames.join(', ')}]`);
  }

  if (error?.code) parts.push(`apiCode=${error.code}`);
  if (error?.statusCode) parts.push(`httpStatus=${error.statusCode}`);

  return parts.join(' | ');
}

export const COLORS: Record<string, number> = {
  ban: 0xe74c3c, // Red
  unban: 0x2ecc71, // Green
  kick: 0xe67e22, // Orange
  mute: 0xf1c40f, // Yellow
  unmute: 0x2ecc71, // Green
  timeout: 0xf1c40f, // Yellow
  warn: 0xf39c12, // Orange
  clearwarns: 0x3498db, // Blue
  clear: 0x9b59b6, // Purple
  automod: 0xe74c3c, // Red
  default: 0x95a5a6, // Gray
};

/**
 * you can set emojis here if you'd like, i dont like emojis **everywhere** so im leaving them blank but you do you
 */
export const EMOJIS: Record<string, string> = {
  ban: '',
  unban: '',
  kick: '',
  mute: '',
  unmute: '',
  timeout: '',
  warn: '',
  clearwarns: '',
  clear: '',
  automod: '',
  default: '',
};

interface LogField {
  name: string;
  value: string;
  inline?: boolean;
}

interface LogOptions {
  action: string;
  title: string;
  fields?: LogField[];
  thumbnail?: string | null;
  footer?: string;
  description?: string;
  client?: Client;
}

interface UserLike {
  id: string;
  username?: string;
  avatarURL?: () => string;
}

interface ModActionExtra {
  fields?: LogField[];
  footer?: string;
  client?: Client;
}

export async function logToChannel(guild: any, settings: any, options: LogOptions): Promise<boolean> {
  let logChannelId: string | undefined;
  let logChannel: any;
  try {
    if (!settings) {
      settings = await settingsCache.get(guild.id);
    }

    logChannelId = settings?.moderation?.logChannelId || settings?.logChannelId;

    if (!logChannelId) {
      return false;
    }

    logChannel = guild.channels?.get(logChannelId);

    if (!logChannel && options.client) {
      try {
        logChannel = await options.client.channels.fetch(logChannelId);
      } catch {
        return false;
      }
    }

    if (!logChannel) {
      return false;
    }

    const { action, title, fields, thumbnail, footer, description } = options;

    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS[action] || EMOJIS.default} ${title}`)
      .setColor(COLORS[action] || COLORS.default)
      .setTimestamp(new Date());

    if (description) embed.setDescription(description);

    if (fields && Array.isArray(fields)) {
      for (const field of fields) {
        embed.addFields({
          name: field.name,
          value: field.value || 'None',
          inline: field.inline ?? false,
        });
      }
    }

    if (thumbnail) {
      embed.setThumbnail(thumbnail);
    }

    if (footer) {
      embed.setFooter({ text: footer });
    }

    const me = guild?.members?.me;
    if (me && !hasRequiredChannelPerms(me, logChannel)) {
      logMissingChannelPerms(guild, logChannel, logChannelId);
      return false;
    }

    await logChannel.send({ embeds: [embed] });
    return true;
  } catch (error: any) {
    if (error?.code === 'MISSING_PERMISSIONS' || error?.statusCode === 403) {
      const diag = diagnosePermissions(guild, logChannelId ?? 'unknown', error, logChannel);
      console.error(`[logToChannel] MISSING_PERMISSIONS - ${diag}`);
    } else {
      console.error('Error logging to channel:', error);
    }
    return false;
  }
}

export async function logModAction(
  guild: any,
  moderator: UserLike,
  target: UserLike | null,
  action: string,
  reason = 'No reason provided',
  extra: ModActionExtra = {},
): Promise<boolean> {
  const fields: LogField[] = [];

  if (target) {
    fields.push({ name: 'User', value: `<@${target.id}> (${target.id})`, inline: true });
  }

  fields.push(
    { name: 'Moderator', value: `<@${moderator.id}> (${moderator.id})`, inline: true },
    { name: 'Reason', value: reason, inline: false },
  );

  if (extra.fields && Array.isArray(extra.fields)) {
    fields.push(...extra.fields);
  }

  const actionName = action.charAt(0).toUpperCase() + action.slice(1);
  const title = target ? `${actionName} - ${target.username || target.id}` : actionName;

  return logToChannel(guild, null, {
    action,
    title,
    fields,
    thumbnail: target?.avatarURL ? target.avatarURL() : null,
    footer: extra.footer,
    client: extra.client,
  });
}

export async function logAutomodAction(
  message: any,
  action: string,
  reason: string,
  extra: ModActionExtra = {},
): Promise<boolean> {
  const fields: LogField[] = [
    { name: 'User', value: `<@${message.author.id}> (${message.author.id})`, inline: true },
    { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
    { name: 'Reason', value: reason, inline: false },
  ];

  if (extra.fields && Array.isArray(extra.fields)) {
    fields.push(...extra.fields);
  }

  return logToChannel(message.guild, null, {
    action: 'automod',
    title: `Automod: ${action}`,
    fields,
    thumbnail: message.author.avatarURL ? message.author.avatarURL() : null,
    client: extra.client,
  });
}

export async function sendEmbed(guild: any, channelId: string, embed: any, client?: Client): Promise<boolean> {
  let channel: any;
  try {
    channel = guild.channels?.get(channelId);
    if (!channel && client) {
      try {
        channel = await client.channels.fetch(channelId);
      } catch {}
    }
    if (!channel) return false;

    const me = guild?.members?.me;
    if (me && !hasRequiredChannelPerms(me, channel)) {
      logMissingChannelPerms(guild, channel, channelId);
      return false;
    }

    await channel.send({ embeds: [embed] });
    return true;
  } catch (err: any) {
    if (isNetworkError(err)) {
      // plz retry, fluxer api is shite
      embedQueue.enqueue(guild.id, channelId, embed);
    } else if (err?.code === 'MISSING_PERMISSIONS' || err?.statusCode === 403) {
      const diag = diagnosePermissions(guild, channelId, err, channel);
      console.error(`[sendEmbed] MISSING_PERMISSIONS - ${diag}`);
    } else {
      console.error('Error sending embed to channel:', err);
    }
    return false;
  }
}

const EVENT_CATEGORY: Record<string, string> = {
  member_join: 'member',
  member_leave: 'member',
  member_role_update: 'member',
  global_ban: 'member',
  voice_join: 'voice',
  voice_leave: 'voice',
  voice_move: 'voice',
  message_delete: 'message',
  message_edit: 'message',
  channel_pins_update: 'message',
  role_create: 'role',
  role_delete: 'role',
  role_update: 'role',
  channel_create: 'channel',
  channel_delete: 'channel',
  channel_update: 'channel',
  reaction_add: 'reaction',
  reaction_remove: 'reaction',
  webhooks_update: 'server',
  guild_emojis_update: 'server',
  invite_create: 'server',
  invite_delete: 'server',
};

export const LOG_CATEGORIES = ['member', 'voice', 'message', 'role', 'channel', 'reaction', 'server'] as const;
export type LogCategory = (typeof LOG_CATEGORIES)[number];

const bulkRoleUpdateSuppressionUntil = new Map<string, number>();

export function beginBulkRoleUpdateSuppression(guildId: string, durationMs = 10 * 60 * 1000): void {
  bulkRoleUpdateSuppressionUntil.set(guildId, Date.now() + Math.max(1000, durationMs));
}

export function endBulkRoleUpdateSuppression(guildId: string): void {
  bulkRoleUpdateSuppressionUntil.delete(guildId);
}

function isBulkRoleUpdateSuppressed(guildId: string): boolean {
  const until = bulkRoleUpdateSuppressionUntil.get(guildId);
  if (!until) return false;
  if (Date.now() > until) {
    bulkRoleUpdateSuppressionUntil.delete(guildId);
    return false;
  }
  return true;
}

export async function logServerEvent(
  guild: any,
  title: string,
  color: number,
  fields: LogField[],
  client?: Client,
  embedExtra: { description?: string; footer?: string; eventType?: string } = {},
): Promise<boolean> {
  try {
    const settings = await settingsCache.get(guild.id).catch(() => null);

    if (embedExtra.eventType === 'member_role_update' && isBulkRoleUpdateSuppressed(guild.id)) {
      return false;
    }

    if (embedExtra.eventType && (settings as any)?.disabledLogEvents?.includes(embedExtra.eventType)) {
      return false;
    }

    let channelId: string | null = null;
    if (embedExtra.eventType) {
      const category = EVENT_CATEGORY[embedExtra.eventType];
      if (category) {
        channelId = (settings as any)?.logChannelOverrides?.[category] || null;
      }
    }
    if (!channelId) {
      channelId = (settings as any)?.serverLogChannelId;
    }
    if (!channelId) return false;

    const embed = new EmbedBuilder().setTitle(title).setColor(color).setTimestamp(new Date());

    if (embedExtra.description) embed.setDescription(embedExtra.description);

    for (const field of fields) {
      embed.addFields({ name: field.name, value: field.value || 'None', inline: field.inline ?? false });
    }

    if (embedExtra.footer) embed.setFooter({ text: embedExtra.footer });

    return sendEmbed(guild, channelId, embed, client);
  } catch (err) {
    console.error('Error in logServerEvent:', err);
    return false;
  }
}
