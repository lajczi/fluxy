import type { Command } from '../../types';
import parseUserId from '../../utils/parseUserId';
import { logModAction } from '../../utils/logger';
import Warning from '../../models/Warning';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'clearwarns',
  description: "Clear all recorded warnings from a user's history",
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
      return void await message.reply(`Usage: \`${prefix}clearwarns <user>\``);
    }

    const userId = parseUserId(args[0]);
    if (!userId) {
      return void await message.reply('Please provide a valid user mention or ID.');
    }

    try {
      const warningRecord = await Warning.getUserWarnings(guild.id, userId);
      const currentCount = warningRecord.warnings?.length || 0;

      if (currentCount === 0) {
        return void await message.reply('That user has no warnings to clear.');
      }

      await Warning.clearWarnings(guild.id, userId);

      let targetUser: any;
      try {
        targetUser = await client.users.fetch(userId);
      } catch {
        targetUser = { id: userId, username: 'Unknown User' };
      }

      await message.reply(`Successfully cleared **${currentCount}** warning(s) for **${targetUser.username || targetUser.id}** (<@${targetUser.id}>).`);

      await logModAction(guild, (message as any).author, targetUser, 'clearwarns', `Cleared ${currentCount} warnings`, { client });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !clearwarns (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !clearwarns: ${error.message || error}`);
        message.reply('An error occurred while clearing warnings.').catch(() => {});
      }
    }
  }
};

export default command;
