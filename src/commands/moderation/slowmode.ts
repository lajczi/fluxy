import type { Command } from '../../types';
import { PermissionFlags } from '@fluxerjs/core';
import parseDuration from '../../utils/parseDuration';
import formatDuration from '../../utils/formatDuration';
import isNetworkError from '../../utils/isNetworkError';
import settingsCache from '../../utils/settingsCache';

const MAX_SLOWMODE = 6 * 60 * 60; // 6 hours in seconds (21600)

const command: Command = {
  name: 'slowmode',
  description: 'Set channel slowmode. Duration format: 10s, 5m, 1h - max 6 hours',
  usage: '<duration> or "off" to disable',
  category: 'moderation',
  permissions: ['ManageChannels'],
  cooldown: 3,

  async execute(message, args, _client) {
    const guildId = (message as any).guild?.id;
    let member = (message as any).guild?.members?.get((message as any).author.id);
    if (!member && (message as any).guild) {
      try { member = await (message as any).guild.fetchMember((message as any).author.id); } catch {}
    }

    if (member) {
      const perms = member.permissions;
      const hasManageChannels = perms?.has(PermissionFlags.ManageChannels);
      const hasAdmin = perms?.has(PermissionFlags.Administrator);
      const hasManageGuild = perms?.has(PermissionFlags.ManageGuild);

      if (!hasManageChannels && !hasAdmin && !hasManageGuild) {
        let allowed = false;
        if (guildId) {
          try {
            const settings = await settingsCache.get(guildId);
            const allowedRoles: string[] = settings?.slowmodeAllowedRoles ?? [];
            if (allowedRoles.length > 0) {
              const memberRoleIds: string[] = member.roles?.roleIds ?? member.roles ?? [];
              allowed = memberRoleIds.some((rid: string) => allowedRoles.includes(rid));
            }
          } catch {}
        }

        if (!allowed) {
          return void await message.reply('You need the **Manage Channels** permission (or an allowed role) to use this command.');
        }
      }
    }

    const currentSlowmode = (message as any).channel.rateLimitPerUser || 0;

    if (!args[0]) {
      if (currentSlowmode === 0) {
        return void await message.reply('Slowmode is currently **disabled** in this channel.');
      }
      return void await message.reply(`Current slowmode is **${formatDuration(currentSlowmode * 1000)}**.`);
    }

    if (args[0].toLowerCase() === 'off' || args[0] === '0') {
      try {
        await (message as any).channel.edit({ rate_limit_per_user: 0 });
        await message.reply('Slowmode has been **disabled**.');
      } catch (error: any) {
        if (!isNetworkError(error)) {
          console.error('Error disabling slowmode:', error);
          return void await message.reply('Failed to disable slowmode.');
        }
      }
      return;
    }

    const durationMs = parseDuration(args[0]);
    if (!durationMs || durationMs <= 0) {
      return void await message.reply('Invalid duration format. Use: 10s, 5m, 1h (max 6 hours) or "off" to disable.');
    }

    const durationSeconds = Math.floor(durationMs / 1000);

    if (durationSeconds < 1) {
      return void await message.reply('Slowmode must be at least 1 second.');
    }

    if (durationSeconds > MAX_SLOWMODE) {
      return void await message.reply('Slowmode cannot exceed 6 hours.');
    }

    try {
      await (message as any).channel.edit({ rate_limit_per_user: durationSeconds });
      await message.reply(`Set slowmode to **${formatDuration(durationMs)}**.`);
    } catch (error: any) {
      if (!isNetworkError(error)) {
        console.error('Error setting slowmode:', error);
        return void await message.reply('Failed to set slowmode.');
      }
    }
  }
};

export default command;
