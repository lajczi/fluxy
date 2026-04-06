import type { Command } from '../../types';
import UserSettings from '../../models/UserSettings';
import isNetworkError from '../../utils/isNetworkError';
import settingsCache from '../../utils/settingsCache';
import { t, normalizeLocale } from '../../i18n';

const MAX_PREFIX_LENGTH = 10;

const command: Command = {
  name: 'myprefix',
  description: 'Set a personal prefix that works for you across all servers',
  usage: '<prefix> | clear | view',
  category: 'general',
  permissions: [],
  aliases: ['mp'],
  cooldown: 5,
  allowDM: true,

  async execute(message, args, _client, prefix = '!') {
    const guildId = (message as any).guildId || (message as any).guild?.id;
    const settings = guildId ? await settingsCache.get(guildId).catch(() => null) : null;
    const lang = normalizeLocale(settings?.language);
    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'view') {
      try {
        const current = await UserSettings.getPrefix((message as any).author.id);
        if (current) {
          return void (await message.reply(t(lang, 'commands.myprefix.current', { prefixValue: current, prefix })));
        }
        return void (await message.reply(t(lang, 'commands.myprefix.notSet', { prefix })));
      } catch (error: any) {
        if (isNetworkError(error)) return;
        return void (await message.reply(t(lang, 'commands.myprefix.fetchFailed')));
      }
    }

    if (sub === 'clear' || sub === 'reset' || sub === 'remove') {
      try {
        await UserSettings.setPrefix((message as any).author.id, null);
        return void (await message.reply(t(lang, 'commands.myprefix.cleared')));
      } catch (error: any) {
        if (isNetworkError(error)) return;
        return void (await message.reply(t(lang, 'commands.myprefix.clearFailed')));
      }
    }

    const newPrefix = args[0];
    if (newPrefix.length > MAX_PREFIX_LENGTH) {
      return void (await message.reply(t(lang, 'commands.myprefix.tooLong', { max: MAX_PREFIX_LENGTH })));
    }

    if (/\s/.test(newPrefix)) {
      return void (await message.reply(t(lang, 'commands.myprefix.noSpaces')));
    }

    try {
      await UserSettings.setPrefix((message as any).author.id, newPrefix);
      return void (await message.reply(t(lang, 'commands.myprefix.saved', { newPrefix })));
    } catch (error: any) {
      if (isNetworkError(error)) return;
      return void (await message.reply(t(lang, 'commands.myprefix.saveFailed')));
    }
  },
};

export default command;
