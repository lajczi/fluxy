import type { Command } from '../../types';
import isNetworkError from '../../utils/isNetworkError';
import settingsCache from '../../utils/settingsCache';
import { t, normalizeLocale } from '../../i18n';

const startTime = Date.now();

const command: Command = {
  name: 'uptime',
  description: 'Show how long the bot has been running since its last restart',
  usage: '',
  category: 'info',
  cooldown: 5,

  async execute(message, _args, _client) {
    try {
      const guildId = (message as any).guildId || (message as any).guild?.id;
      const settings = guildId ? await settingsCache.get(guildId).catch(() => null) : null;
      const lang = normalizeLocale(settings?.language);
      const uptime = Date.now() - startTime;

      const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
      const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((uptime % (60 * 1000)) / 1000);

      const uptimeParts: string[] = [];
      if (days > 0)
        uptimeParts.push(
          `${days} ${t(lang, days === 1 ? 'commands.uptime.unitDaySingular' : 'commands.uptime.unitDayPlural')}`,
        );
      if (hours > 0)
        uptimeParts.push(
          `${hours} ${t(lang, hours === 1 ? 'commands.uptime.unitHourSingular' : 'commands.uptime.unitHourPlural')}`,
        );
      if (minutes > 0)
        uptimeParts.push(
          `${minutes} ${t(lang, minutes === 1 ? 'commands.uptime.unitMinuteSingular' : 'commands.uptime.unitMinutePlural')}`,
        );
      if (seconds > 0 || uptimeParts.length === 0)
        uptimeParts.push(
          `${seconds} ${t(lang, seconds === 1 ? 'commands.uptime.unitSecondSingular' : 'commands.uptime.unitSecondPlural')}`,
        );

      const uptimeString = uptimeParts.join(t(lang, 'commands.uptime.listSeparator'));

      const startDate = new Date(startTime);
      const localeForDate = lang === 'en' ? 'en-US' : lang;
      const startString = startDate.toLocaleString(localeForDate, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });

      await message.reply(
        t(lang, 'commands.uptime.response', {
          labelUptime: t(lang, 'commands.uptime.labelUptime'),
          labelStarted: t(lang, 'commands.uptime.labelStarted'),
          uptimeString,
          startString,
        }),
      );
    } catch (error: any) {
      if (isNetworkError(error)) {
        console.warn(`Fluxer API unreachable during !uptime (ECONNRESET)`);
      } else {
        console.error(`Error in !uptime: ${error.message || error}`);
      }
    }
  },
};

export default command;
