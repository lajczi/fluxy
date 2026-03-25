import { EmbedBuilder } from '@fluxerjs/core';
import type { Command } from '../../types';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';

async function tempReply(message: any, text: string, ms = 7000): Promise<void> {
  const reply = await message.reply(text).catch(() => null);
  setTimeout(() => {
    message.delete().catch(() => {});
    reply?.delete?.().catch(() => {});
  }, ms);
}

const command: Command = {
  name: 'report',
  description: [
    'Privately alert the staff team about an issue. Your message is deleted immediately \u2014 other members will not know you reported anything.',
    '',
    '**How it works:**',
    '`!report <your message>` \u2014 your message is deleted on the spot and only staff can see it in their private channel.',
    '',
    '**Tip for server staff:** There is also a dedicated report inbox channel available (`!setstaff reportchannel`). Members can type there directly without using any command \u2014 the bot deletes every message instantly and forwards it to staff.',
    'To keep the inbox fully private, set **Read Message History** to off for `@everyone` in that channel \u2014 members will only ever see an empty channel when they open it.',
  ].join('\n'),
  usage: '<your message>',
  category: 'general',
  cooldown: 300,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply('This command can only be used in a server.');

    const reportContent = args.join(' ').trim();

    if (!reportContent) {
      return void await tempReply(message, `Please include a message with your report. Example: \`${prefix}report someone is posting spam in #general\``);
    }

    if (reportContent.length > 1000) {
      return void await tempReply(message, 'Your report is too long (max 1000 characters). Please summarise and try again.');
    }

    (message as any).delete().catch(() => {});

    let settings: any;
    try {
      settings = await settingsCache.get(guild.id);
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.warn(`[${guild.name}] Fluxer API unreachable during !report (ECONNRESET)`);
      } else {
        console.error(`[${guild.name}] Error loading settings in !report: ${err.message || err}`);
      }
      (message as any).author.send('Your report could not be submitted right now due to a server error. Please try again shortly.').catch(() => {});
      return;
    }

    if (!settings?.staffChannelId) {
      (message as any).author.send('Staff reports are not configured on this server yet. Please contact an administrator directly.').catch(() => {});
      return;
    }

    const author = (message as any).author;
    const embed = new EmbedBuilder()
      .setTitle('New Staff Report')
      .setColor(0xED4245)
      .setDescription(reportContent)
      .addFields(
        { name: 'Reporter', value: `${author.username} (<@${author.id}>)`, inline: true },
        { name: 'User ID',  value: author.id, inline: true },
        { name: 'Channel',  value: `<#${(message as any).channelId || (message as any).channel?.id}>`, inline: true }
      )
      .setThumbnail(author.displayAvatarURL?.() ?? author.avatarURL ?? null)
      .setFooter({ text: 'This report is only visible to staff' })
      .setTimestamp(new Date());

    let staffChannel: any;
    try {
      const channelsMap = guild.channels?.cache || guild.channels;
      staffChannel = channelsMap?.get(settings.staffChannelId)
        ?? await guild.channels.fetch(settings.staffChannelId).catch(() => null);
    } catch {
      staffChannel = null;
    }

    if (!staffChannel) {
      console.warn(`[${guild.name}] Staff channel ${settings.staffChannelId} not found during !report`);
      author.send(
        `Your report in **${guild.name}** could not be delivered because the staff channel is unavailable. Please contact a staff member directly.`
      ).catch(() => {});
      return;
    }

    try {
      const rolePing = settings.staffRoleId ? `<@&${settings.staffRoleId}>` : null;
      await staffChannel.send({
        content: rolePing ?? undefined,
        embeds:  [embed]
      });

      author.send(
        `Your report in **${guild.name}** has been sent to the staff team. Someone will follow up with you directly if needed. Thank you for letting us know.`
      ).catch(() => {});

    } catch (err: any) {
      console.error(`[${guild.name}] Failed to send report to staff channel: ${err.message || err}`);
      author.send(
        `Your report in **${guild.name}** could not be delivered due to a permissions error. Please contact a staff member directly.`
      ).catch(() => {});
    }
  }
};

export default command;
