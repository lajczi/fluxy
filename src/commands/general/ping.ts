import { EmbedBuilder, Routes } from '@erinjs/core';
import type { Command } from '../../types';
import isNetworkError from '../../utils/isNetworkError';
import settingsCache from '../../utils/settingsCache';
import { t, normalizeLocale } from '../../i18n';

const command: Command = {
  name: 'ping',
  description: 'Check if the bot is online and see the round-trip response time',
  usage: '',
  category: 'general',
  cooldown: 3,

  async execute(message, args, client) {
    try {
      const guildId = (message as any).guildId || (message as any).guild?.id;
      const settings = guildId ? await settingsCache.get(guildId).catch(() => null) : null;
      const lang = normalizeLocale(settings?.language);
      const msgStart = Date.now();
      const msg = await message.reply(t(lang, 'commands.ping.pinging'));
      const msgLatency = Date.now() - msgStart;

      const restStart = Date.now();
      await client.rest.get(Routes.currentUser());
      const restLatency = Date.now() - restStart;

      const embed = new EmbedBuilder()
        .setTitle(t(lang, 'commands.ping.title'))
        .setColor(0x5865F2)
        .addFields(
          { name: t(lang, 'commands.ping.restApi'), value: `\`${restLatency}ms\``, inline: true },
          { name: t(lang, 'commands.ping.roundTrip'), value: `\`${msgLatency}ms\``, inline: true }
        )
        .setFooter({ text: t(lang, 'commands.ping.footer') })
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
