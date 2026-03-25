import { EmbedBuilder } from '@fluxerjs/core';
import type { Command } from '../../types';
import parseUserId from '../../utils/parseUserId';
import Warning from '../../models/Warning';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'warnings',
  description: 'View the warning history for a user \u2014 shows who issued each warning and the reason. Leave blank to see your own',
  usage: '[@user or user ID]',
  category: 'moderation',
  permissions: ['ModerateMembers'],
  cooldown: 3,

  async execute(message, args, client) {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) {
      guild = await client.guilds.fetch((message as any).guildId);
    }

    if (!guild) {
      return void await message.reply('This command can only be used in a server.');
    }

    let userId: string;
    let targetUser: any;

    if (args[0]) {
      const parsed = parseUserId(args[0]);
      if (!parsed) {
        return void await message.reply('Please provide a valid user mention or ID.');
      }
      userId = parsed;
    } else {
      userId = (message as any).author.id;
    }

    try {
      targetUser = await client.users.fetch(userId);
    } catch {
      targetUser = { id: userId, username: 'Unknown User' };
    }

    try {
      const warningRecord = await Warning.getUserWarnings(guild.id, userId);
      const warnings = warningRecord.warnings || [];

      const embed = new EmbedBuilder()
        .setTitle(`Warnings for ${targetUser.username || targetUser.id}`)
        .setColor(0xf39c12)
        .setTimestamp(new Date());

      if (warnings.length === 0) {
        embed.setDescription('This user has no warnings.');
      } else {
        const displayWarnings = warnings.slice(-10);
        const totalWarnings = warnings.length;

        embed.setDescription(`Showing ${displayWarnings.length} of ${totalWarnings} warning(s)`);

        const warningList: string[] = [];
        for (let i = 0; i < displayWarnings.length; i++) {
          const warning = displayWarnings[i];
          const date = warning.date ? new Date(warning.date).toLocaleDateString() : 'Unknown date';
          const modMention = warning.modId ? `<@${warning.modId}>` : 'Unknown';

          warningList.push(`**${i + 1}.** ${warning.reason}`);
          warningList.push(`   \u2514 Moderator: ${modMention} | Date: ${date}`);
        }

        embed.addFields({
          name: 'Recent Warnings',
          value: warningList.join('\n') || 'None'
        });

        embed.setFooter({ text: `Total Warnings: ${totalWarnings}` });
      }

      await message.reply({ embeds: [embed] });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !warnings (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !warnings: ${error.message || error}`);
        message.reply('An error occurred while fetching warnings.').catch(() => {});
      }
    }
  }
};

export default command;
