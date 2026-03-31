import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { t, normalizeLocale } from '../../i18n';

const command: Command = {
  name: 'toggle-ghostping',
  description: 'Detect and alert when a member pings someone then immediately deletes the message',
  usage: '',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, _args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply(t('en', 'commands.admin.toggleGhostping.serverOnly'));

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      const lang = normalizeLocale(settings?.language);
      if (!settings.automod) settings.automod = {};
      settings.automod.ghostPing = !settings.automod.ghostPing;
      settings.markModified('automod');
      await settings.save();
      settingsCache.invalidate(guild.id);

      const status = settings.automod.ghostPing ? 'enabled' : 'disabled';
      let reply = t(lang, 'commands.admin.toggleGhostping.base', { status });

      if (settings.automod.ghostPing && settings.automod.level === 'off') {
        reply += t(lang, 'commands.admin.toggleGhostping.noteLevelOff', { prefix });
      }

      await message.reply(reply);
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !toggle-ghostping (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !toggle-ghostping: ${error.message || error}`);
        const cached: any = await settingsCache.get(guild.id).catch(() => null);
        const lang = normalizeLocale(cached?.language);
        message.reply(t(lang, 'commands.admin.toggleGhostping.errors.generic')).catch(() => {});
      }
    }
  }
};

export default command;
