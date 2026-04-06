import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import config from '../../config';
import isNetworkError from '../../utils/isNetworkError';
import { t, normalizeLocale } from '../../i18n';

const command: Command = {
  name: 'clearprefix',
  description: 'Reset the server prefix to the default',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, _args, client) {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void (await message.reply(t('en', 'commands.admin.clearprefix.serverOnly')));

    try {
      const cached: any = await settingsCache.get(guild.id).catch(() => null);
      const lang = normalizeLocale(cached?.language);
      const defaultPrefix = config.prefix;
      await GuildSettings.updateSetting(guild.id, 'prefixes', [defaultPrefix]);
      settingsCache.invalidate(guild.id);
      await message.reply(t(lang, 'commands.admin.clearprefix.resetDone', { defaultPrefix }));
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !clearprefix (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !clearprefix: ${error.message || error}`);
        const cached: any = await settingsCache.get(guild.id).catch(() => null);
        const lang = normalizeLocale(cached?.language);
        message.reply(t(lang, 'commands.admin.clearprefix.errors.generic')).catch(() => {});
      }
    }
  },
};

export default command;
