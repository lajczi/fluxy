import { EmbedBuilder, Routes } from '@fluxerjs/core';
import type { Command } from '../../types';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'ping',
  description: 'Check if the bot is online and see the round-trip response time',
  usage: '',
  category: 'general',
  cooldown: 3,

  async execute(message, args, client) {
    try {
      const msgStart = Date.now();
      const msg = await message.reply('Pinging...');
      const msgLatency = Date.now() - msgStart;

      const restStart = Date.now();
      await client.rest.get(Routes.currentUser());
      const restLatency = Date.now() - restStart;

      const embed = new EmbedBuilder()
        .setTitle('Pong!')
        .setColor(0x5865F2)
        .addFields(
          { name: 'REST API',        value: `\`${restLatency}ms\``,  inline: true },
          { name: 'Message Round-trip', value: `\`${msgLatency}ms\``, inline: true }
        )
        .setFooter({ text: 'Fluxer API - api.fluxer.app' })
        .setTimestamp(new Date());

      await msg.edit({ content: '', embeds: [embed] });

    } catch (error: any) {
      if (isNetworkError(error)) {
        console.warn(`Fluxer API unreachable during !ping (ECONNRESET)`);
      } else {
        console.error(`Error in !ping: ${error.message || error}`);
      }
    }
  }
};

export default command;
