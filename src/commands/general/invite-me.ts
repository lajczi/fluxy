import { EmbedBuilder } from '@fluxerjs/core';
import type { Command } from '../../types';
import isNetworkError from '../../utils/isNetworkError';

const INVITE_URL = 'https://web.fluxer.app/oauth2/authorize?client_id=1474069931333816428&scope=bot&permissions=4504699474930806';

const command: Command = {
  name: 'invite-me',
  description: 'Get the bot invite link to add Fluxy to your server.',
  usage: '',
  category: 'general',
  aliases: ['inv'],
  cooldown: 5,

  async execute(message, _args, _client) {
    try {
      const embed = new EmbedBuilder()
        .setTitle('Invite Fluxy')
        .setDescription(
          `Add Fluxy to your server and get powerful moderation, welcome messages, logging, and more!\n\n` +
          `**[Click here to invite Fluxy](${INVITE_URL})**\n\n` +
          `Need help? Join the **[Fluxy Support Server](https://fluxer.gg/fluxy)**.`
        )
        .setColor(0x6c72f8)
        .setFooter({ text: 'Fluxy - Moderation made simple' })
        .setTimestamp(new Date());

      await message.reply({ embeds: [embed] });
    } catch (error: any) {
      if (isNetworkError(error)) {
        console.warn('Fluxer API unreachable during !invite-me (ECONNRESET)');
      } else {
        console.error(`Error in !invite-me: ${error.message || error}`);
        await message.reply(
          `**Invite Fluxy to your server:**\n${INVITE_URL}\n\nNeed help? https://fluxer.gg/fluxy`
        ).catch(() => { });
      }
    }
  }
};

export default command;
