import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { t, normalizeLocale } from '../../i18n';

const command: Command = {
  name: 'toggle-antireactionspam',
  description: 'Toggle anti-reaction spam detection \u2014 prevents users from rapidly adding reactions',
  usage: '',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, _args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply(t('en', 'commands.admin.toggleAntireactionspam.serverOnly'));

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      const lang = normalizeLocale(settings?.language);
      const newState = !settings.automod.antiReactionSpam;
      settings.automod.antiReactionSpam = newState;

      if (newState && (!settings.automod.level || settings.automod.level === 'off')) {
        settings.automod.level = 'minimal';
      }

      settings.markModified('automod');
      await settings.save();
      settingsCache.invalidate(guild.id);

      const status = newState ? 'enabled' : 'disabled';
      let reply = t(lang, 'commands.admin.toggleAntireactionspam.base', { status });
      if (newState && settings.automod.level === 'minimal') {
        reply += t(lang, 'commands.admin.toggleAntireactionspam.suffixLevelMinimal');
      }
      if (!newState && settings.automod.level === 'off') {
        reply += t(lang, 'commands.admin.toggleAntireactionspam.suffixAutomodAlsoOff', { prefix });
      }
      await message.reply(reply);
    } catch (error: any) {
      if (isNetworkError(error)) {
        console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !toggle-antireactionspam (ECONNRESET)`);
      } else {
        console.error(`[${guild?.name || 'Unknown Server'}] Error in !toggle-antireactionspam: ${error.message || error}`);
        const cached: any = await settingsCache.get(guild.id).catch(() => null);
        const lang = normalizeLocale(cached?.language);
        message.reply(t(lang, 'commands.admin.toggleAntireactionspam.errors.generic')).catch(() => {});
      }
    }
  }
};

export default command;
