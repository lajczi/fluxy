import { Routes } from '@fluxerjs/types';
import type { Command } from '../../types';
import { logModAction } from '../../utils/logger';
import isNetworkError from '../../utils/isNetworkError';
import { isPermDenied, PERM_MESSAGES } from '../../utils/permError';

const command: Command = {
  name: 'clear',
  description: 'Bulk delete messages in the current channel \u2014 the command message is also deleted. Max 100 messages at a time',
  usage: '<amount 1\u2013100>',
  category: 'moderation',
  permissions: ['ManageMessages'],
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
      return void await message.reply(`Usage: \`${prefix}clear <amount>\` (1-100)`);
    }

    const amount = parseInt(args[0], 10);

    if (isNaN(amount)) {
      return void await message.reply('Please provide a valid number.');
    }

    if (amount < 1 || amount > 100) {
      return void await message.reply('Amount must be between 1 and 100.');
    }

    try {
      const fetchLimit = Math.min(amount + 1, 100);
      const messagesData: any = await client.rest.get(
        `${Routes.channelMessages((message as any).channel.id)}?limit=${fetchLimit}`
      );

      const messages = Array.isArray(messagesData) ? messagesData : [];

      if (messages.length === 0) {
        return void await message.reply('No messages found to delete.');
      }

      const messageIds = messages.map((msg: any) => msg.id).slice(0, 100);

      let deletedCount = 0;

      if (messageIds.length >= 2) {
        try {
          await (message as any).channel.bulkDeleteMessages(messageIds);
          deletedCount = messageIds.length;
        } catch (bulkError: any) {
          console.warn(`[${guild?.name || 'Unknown Server'}] Bulk delete failed, falling back to individual deletion: ${bulkError.message}`);
          for (const id of messageIds) {
            try {
              await client.rest.delete(Routes.channelMessage((message as any).channel.id, id));
              deletedCount++;
            } catch (e: any) {
              console.warn(`[${guild?.name || 'Unknown Server'}] Failed to delete message ${id}: ${e.message}`);
            }
          }
        }
      } else {
        for (const id of messageIds) {
          try {
            await client.rest.delete(Routes.channelMessage((message as any).channel.id, id));
            deletedCount++;
          } catch (e: any) {
            console.warn(`[${guild?.name || 'Unknown Server'}] Failed to delete message ${id}: ${e.message}`);
          }
        }
      }

      const userCount = Math.max(0, deletedCount - 1);
      const confirmMsg = await (message as any).channel.send(`Successfully deleted **${userCount}** message(s).`);

      setTimeout(() => {
        confirmMsg.delete().catch(() => {});
      }, 5000);

      await logModAction(guild, (message as any).author, null, 'clear', `Deleted ${userCount} messages in #${(message as any).channel.name}`, {
        fields: [
          { name: 'Channel', value: `<#${(message as any).channel.id}>`, inline: true },
          { name: 'Messages Deleted', value: `${userCount}`, inline: true }
        ],
        client
      });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !clear (ECONNRESET)`);
      } else if (error.code === 50034) {
        message.reply('Cannot delete messages older than 14 days.').catch(() => {});
      } else if (isPermDenied(error)) {
        message.reply(PERM_MESSAGES.clear).catch(() => {});
      } else {
        console.error(`[${guildName}] Error in !clear: ${error.message || error}`);
        message.reply('An error occurred while trying to delete messages.').catch(() => {});
      }
    }
  }
};

export default command;
