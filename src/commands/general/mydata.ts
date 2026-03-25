import type { Command } from '../../types';
import { collectUserData, deleteUserData } from '../../services/UserDataService';
import isNetworkError from '../../utils/isNetworkError';

const pendingDeletes = new Set<string>();

const command: Command = {
  name: 'mydata',
  description: 'View, export, or delete all data Fluxy stores about you',
  usage: '<export|delete|info>',
  category: 'general',
  permissions: [],
  cooldown: 30,
  allowDM: true,

  async execute(message, args, client, prefix = '!') {
    const userId = (message as any).author.id;
    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'info') {
      return void await message.reply(
        '**Data Fluxy stores about you:**\n' +
        '- Personal prefix (if set via `!myprefix`)\n' +
        '- Warnings you have received in servers\n' +
        '- Moderation actions involving you (as target or moderator)\n' +
        '- Ticket messages you sent in ticket channels\n' +
        '- Command usage statistics\n' +
        '- Global ban entry (if applicable)\n\n' +
        `\`${prefix}mydata export\` - get a file with all your data\n` +
        `\`${prefix}mydata delete\` - permanently delete all your data`
      );
    }

    if (sub === 'export') {
      try {
        await message.reply('Collecting your data... I will DM you the export file.');

        const data = await collectUserData(userId);
        const json = JSON.stringify(data, null, 2);
        const buffer = Buffer.from(json, 'utf-8');

        try {
          const dmChannel = await (client as any).users.createDM?.(userId);
          if (dmChannel) {
            await dmChannel.send({
              content: 'Here is all the data Fluxy has stored about you. This includes warnings, moderation logs, ticket participation, and settings.',
              files: [{ name: `fluxy-data-${userId}.json`, data: buffer }],
            });
            await message.reply('Sent! Check your DMs.');
          } else {
            await message.reply('I could not open a DM with you. Make sure your DMs are open.');
          }
        } catch {
          await message.reply('I could not send you a DM. Make sure your DMs are open and try again.');
        }
      } catch (error: any) {
        if (isNetworkError(error)) return;
        console.error(`[mydata] Export failed for ${userId}: ${error.message}`);
        await message.reply('Something went wrong while collecting your data. Please try again later.').catch(() => {});
      }
      return;
    }

    if (sub === 'delete') {
      if (!pendingDeletes.has(userId)) {
        pendingDeletes.add(userId);
        setTimeout(() => pendingDeletes.delete(userId), 60 * 1000);

        return void await message.reply(
          '**Are you sure?** This will permanently delete:\n' +
          '- Your personal prefix\n' +
          '- All your warnings across every server\n' +
          '- Your identity in moderation logs (anonymized to "[deleted]")\n' +
          '- Your identity in ticket transcripts (anonymized to "Deleted User")\n' +
          '- Your command usage statistics\n\n' +
          '**This cannot be undone.**\n' +
          `Run \`${prefix}mydata delete\` again within 60 seconds to confirm.`
        );
      }

      pendingDeletes.delete(userId);

      try {
        await message.reply('Deleting your data...');
        const result = await deleteUserData(userId);

        const lines = [];
        if (result.userSettings) lines.push('- Personal settings deleted');
        if (result.warnings > 0) lines.push(`- ${result.warnings} warning record(s) deleted`);
        if (result.moderationLogsAnonymized > 0) lines.push(`- ${result.moderationLogsAnonymized} moderation log(s) anonymized`);
        if (result.ticketMessagesAnonymized > 0) lines.push('- Ticket transcript messages anonymized');
        if (result.commandUsage > 0) lines.push(`- ${result.commandUsage} command usage record(s) deleted`);
        if (result.guildSettingsReferences > 0) lines.push(`- Removed from ${result.guildSettingsReferences} guild allowlist(s)`);

        if (lines.length === 0) {
          lines.push('No data was found to delete.');
        }

        await message.reply('**Data deletion complete.**\n' + lines.join('\n'));
      } catch (error: any) {
        if (isNetworkError(error)) return;
        console.error(`[mydata] Delete failed for ${userId}: ${error.message}`);
        await message.reply('Something went wrong while deleting your data. Please try again later.').catch(() => {});
      }
      return;
    }

    return void await message.reply(
      `Unknown option. Use \`${prefix}mydata info\`, \`${prefix}mydata export\`, or \`${prefix}mydata delete\`.`
    );
  }
};

export default command;
