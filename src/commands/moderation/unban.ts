import type { Command } from '../../types';
import parseUserId from '../../utils/parseUserId';
import { logModAction } from '../../utils/logger';
import ModerationLog from '../../models/ModerationLog';
import isNetworkError from '../../utils/isNetworkError';
import { isPermDenied, PERM_MESSAGES } from '../../utils/permError';

const command: Command = {
  name: 'unban',
  description: 'Remove a ban from a previously banned user. Requires their user ID (right-click their name > Copy ID) also in logs',
  usage: '<user ID> [reason]',
  category: 'moderation',
  permissions: ['BanMembers'],
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
      return void await message.reply(`Usage: \`${prefix}unban <userId> [reason]\``);
    }

    const userId = parseUserId(args[0]);
    if (!userId) {
      return void await message.reply('Please provide a valid user ID.');
    }

    const reason = args.slice(1).join(' ').trim() || 'No reason provided';

    try {
      let targetUser: any;
      try {
        targetUser = await client.users.fetch(userId);
      } catch {
        targetUser = { id: userId, username: 'Unknown User' };
      }

      await guild.unban(userId);

      await message.reply(`Successfully unbanned **${targetUser.username || targetUser.id}** (<@${targetUser.id}>).\n**Reason:** ${reason}`);

      await logModAction(guild, (message as any).author, targetUser, 'unban', reason, { client });

      await ModerationLog.logAction({
        guildId: guild.id,
        targetId: userId,
        userId: (message as any).author.id,
        action: 'unban',
        reason
      });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !unban (ECONNRESET)`);
      } else if (error.code === 10026) {
        message.reply('That user is not banned from this server.').catch(() => {});
      } else if (isPermDenied(error)) {
        message.reply(PERM_MESSAGES.unban).catch(() => {});
      } else {
        console.error(`[${guildName}] Error in !unban: ${error.message || error}`);
        message.reply('An error occurred while trying to unban that user.').catch(() => {});
      }
    }
  }
};

export default command;
