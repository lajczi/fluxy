import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { t, normalizeLocale } from '../../i18n';

const command: Command = {
  name: 'toggle-antispam',
  description: 'Mute members who send many messages in quick succession \u2014 triggers after repeated rapid messages',
  usage: '',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, _args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply(t('en', 'commands.admin.toggleAntispam.serverOnly'));

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      const lang = normalizeLocale(settings?.language);
      const newState = !settings.automod.antiSpam;
      settings.automod.antiSpam = newState;

      if (newState && (!settings.automod.level || settings.automod.level === 'off')) {
        settings.automod.level = 'minimal';
      }

      settings.markModified('automod');
      await settings.save();
      settingsCache.invalidate(guild.id);

      const status = newState ? 'enabled' : 'disabled';
      let reply = t(lang, 'commands.admin.toggleAntispam.base', { status });
      if (newState && settings.automod.level === 'minimal') {
        reply += t(lang, 'commands.admin.toggleAntispam.suffixLevelMinimal');
      }
      if (!newState && settings.automod.level === 'off') {
        reply += t(lang, 'commands.admin.toggleAntispam.suffixAutomodAlsoOff', { prefix });
      }
      await message.reply(reply);
    } catch (error: any) {
      if (isNetworkError(error)) {
        console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !toggle-antispam (ECONNRESET)`);
      } else {
        console.error(`[${guild?.name || 'Unknown Server'}] Error in !toggle-antispam: ${error.message || error}`);
        const cached: any = guild ? await settingsCache.get(guild.id).catch(() => null) : null;
        const lang = normalizeLocale(cached?.language);
        message.reply(t(lang, 'commands.admin.toggleAntispam.errors.generic')).catch(() => {});
      }
    }
  }
};

export default command;
