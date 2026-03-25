import type { Command } from '../../types';
import parseUserId from '../../utils/parseUserId';
import { canModerate } from '../../utils/permissions';
import { logModAction } from '../../utils/logger';
import ModerationLog from '../../models/ModerationLog';
import isNetworkError from '../../utils/isNetworkError';
import { isPermDenied, PERM_MESSAGES } from '../../utils/permError';
import { EmbedBuilder } from '@fluxerjs/core';

const command: Command = {
  name: 'massban',
  description: 'Ban all unique message authors between two boundary messages in the current channel',
  usage: '<startMessageId> <endMessageId> [reason]',
  category: 'moderation',
  permissions: ['BanMembers'],
  cooldown: 10,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) {
      guild = await client.guilds.fetch((message as any).guildId);
    }

    if (!guild) {
      return void await message.reply('This command can only be used in a server.');
    }

    if (args.length < 2) {
      return void await message.reply(
        `**Usage:** \`${prefix}massban <startMessageId> <endMessageId> [reason]\`\n` +
        'Bans all unique authors of messages between the two boundary messages (inclusive) in the current channel.\n' +
        '**Tip:** Right-click a message → Copy ID to get message IDs.'
      );
    }

    const startId = args[0];
    const endId = args[1];
    const reason = args.slice(2).join(' ').trim() || 'Mass ban';

    if (!/^\d{17,22}$/.test(startId) || !/^\d{17,22}$/.test(endId)) {
      return void await message.reply('Please provide valid message IDs (17-22 digit numbers).');
    }

    const channelId = (message as any).channelId || (message as any).channel?.id;
    if (!channelId) {
      return void await message.reply('Could not determine the current channel.');
    }

    const channel = guild.channels?.get(channelId)
      || await guild.fetchChannel?.(channelId).catch(() => null);
    if (!channel) {
      return void await message.reply('Could not access this channel.');
    }

    let startMsg: any, endMsg: any;
    try {
      startMsg = await channel.messages.fetch(startId);
    } catch {
      return void await message.reply(`Could not find start message with ID \`${startId}\` in this channel.`);
    }
    try {
      endMsg = await channel.messages.fetch(endId);
    } catch {
      return void await message.reply(`Could not find end message with ID \`${endId}\` in this channel.`);
    }

    const [lowId, highId] = BigInt(startId) <= BigInt(endId) ? [startId, endId] : [endId, startId];

    const statusMsg = await message.reply('⏳ Fetching messages between the two boundaries...');

    const allMessages: any[] = [];
    let lastFetchedId: string | undefined = undefined;
    let reachedEnd = false;

    while (!reachedEnd) {
      try {
        const fetchOptions: any = { limit: 100 };
        if (lastFetchedId) {
          fetchOptions.after = lastFetchedId;
        } else {
          fetchOptions.after = lowId;
        }

        const fetched = await channel.messages.fetch(fetchOptions);
        const msgs = Array.isArray(fetched) ? fetched : [...(fetched.values?.() ?? [])];

        if (msgs.length === 0) {
          reachedEnd = true;
          break;
        }

        for (const msg of msgs) {
          const msgIdBig = BigInt(msg.id);
          if (msgIdBig >= BigInt(lowId) && msgIdBig <= BigInt(highId)) {
            allMessages.push(msg);
          }
          if (msgIdBig > BigInt(highId)) {
            reachedEnd = true;
            break;
          }
        }

        const sortedMsgs = msgs.sort((a: any, b: any) => {
          const diff = BigInt(a.id) - BigInt(b.id);
          return diff < 0n ? -1 : diff > 0n ? 1 : 0;
        });
        lastFetchedId = sortedMsgs[sortedMsgs.length - 1].id;

        if (msgs.length < 100) reachedEnd = true;
      } catch (err) {
        reachedEnd = true;
      }
    }

    const messageMap = new Map<string, any>();
    for (const msg of allMessages) {
      messageMap.set(msg.id, msg);
    }
    messageMap.set(startMsg.id, startMsg);
    messageMap.set(endMsg.id, endMsg);

    const authorIds = new Set<string>();
    const botUserId = client.user?.id;
    const invokerId = (message as any).author.id;

    for (const [, msg] of messageMap) {
      const authorId = msg.author?.id;
      if (!authorId) continue;
      if (msg.author.bot) continue;
      if (authorId === invokerId) continue;
      if (authorId === botUserId) continue;
      authorIds.add(authorId);
    }

    if (authorIds.size === 0) {
      return void await statusMsg.edit({ content: 'No bannable users found between those messages (bots and yourself are excluded).' });
    }

    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Mass Ban Confirmation')
      .setColor(0xFF4444)
      .setDescription(
        `Found **${authorIds.size}** unique user(s) across **${messageMap.size}** messages.\n\n` +
        `**Reason:** ${reason}\n\n` +
        `React with ✅ to confirm or ❌ to cancel.\n` +
        `*This will expire in 30 seconds.*`
      );

    const confirmMsg = await statusMsg.edit({ content: undefined, embeds: [confirmEmbed] });

    try {
      await confirmMsg.react('✅');
      await confirmMsg.react('❌');
    } catch {
      return void await confirmMsg.edit({
        content: 'Could not add confirmation reactions. Make sure I have **Add Reactions** permission.',
        embeds: []
      });
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        client.off?.('messageReactionAdd', handler);
        resolve(false);
      }, 30_000);

      const handler = (...handlerArgs: any[]) => {
        const [reaction, reactor] = handlerArgs;
        if (reaction.messageId !== confirmMsg.id) return;
        if (reactor.id !== invokerId) return;

        const emoji = reaction.emoji?.name;
        if (emoji === '✅') {
          clearTimeout(timeout);
          client.off?.('messageReactionAdd', handler);
          resolve(true);
        } else if (emoji === '❌') {
          clearTimeout(timeout);
          client.off?.('messageReactionAdd', handler);
          resolve(false);
        }
      };

      client.on?.('messageReactionAdd', handler);
    });

    if (!confirmed) {
      return void await confirmMsg.edit({ content: 'Mass ban cancelled.', embeds: [] });
    }

    await confirmMsg.edit({ content: `⏳ Banning ${authorIds.size} user(s)...`, embeds: [] });

    let moderator: any = guild.members?.get(invokerId);
    if (!moderator) {
      moderator = await guild.fetchMember(invokerId);
    }

    let banned = 0;
    let failed = 0;
    const failures: string[] = [];

    for (const userId of authorIds) {
      try {
        let targetMember: any = guild.members?.get(userId);
        if (!targetMember) {
          try { targetMember = await guild.fetchMember(userId); } catch { targetMember = null; }
        }

        if (targetMember && moderator) {
          const modCheck = canModerate(moderator, targetMember);
          if (!modCheck.canModerate) {
            failed++;
            failures.push(`<@${userId}>: ${modCheck.reason}`);
            continue;
          }
        }

        await guild.ban(userId, {
          reason: `[massban] ${(message as any).author.username}: ${reason}`,
          deleteMessageSeconds: 86400,
        });

        banned++;

        let targetUser: any = targetMember?.user;
        if (!targetUser) {
          try { targetUser = await client.users.fetch(userId); } catch {
            targetUser = { id: userId, username: 'Unknown User' };
          }
        }

        await logModAction(guild, (message as any).author, targetUser, 'ban', `[massban] ${reason}`, { client }).catch(() => {});

        await ModerationLog.logAction({
          guildId: guild.id,
          targetId: userId,
          userId: invokerId,
          action: 'ban',
          reason: `[massban] ${reason}`
        }).catch(() => {});

        if (authorIds.size > 5) await new Promise(r => setTimeout(r, 300));

      } catch (error: any) {
        failed++;
        if (isNetworkError(error)) {
          failures.push(`<@${userId}>: Network error`);
        } else if (isPermDenied(error)) {
          failures.push(`<@${userId}>: Missing permissions`);
        } else {
          failures.push(`<@${userId}>: ${error.message || 'Unknown error'}`);
        }
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle('Mass Ban Complete')
      .setColor(banned > 0 ? 0x43B581 : 0xFF4444)
      .setDescription(
        `**Banned:** ${banned}/${authorIds.size}\n` +
        `**Failed:** ${failed}\n` +
        `**Reason:** ${reason}` +
        (failures.length > 0 ? `\n\n**Failures:**\n${failures.slice(0, 10).join('\n')}` +
          (failures.length > 10 ? `\n...and ${failures.length - 10} more` : '') : '')
      );

    await confirmMsg.edit({ content: undefined, embeds: [resultEmbed] });
  }
};

export default command;
