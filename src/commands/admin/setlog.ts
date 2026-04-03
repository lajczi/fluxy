import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { t, normalizeLocale } from '../../i18n';

const command: Command = {
  name: 'setlog',
  description: 'Set the channel where moderation actions are logged. Run with no argument to view the current setting',
  usage: '[#channel or channel ID]',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply(t('en', 'commands.admin.setlog.serverOnly'));

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      const lang = normalizeLocale(settings?.language);

      if (!args[0]) {
        const current = settings.moderation?.logChannelId || settings.logChannelId;
        if (!current) return void await message.reply(t(lang, 'commands.admin.setlog.noLogChannel', { prefix }));
        return void await message.reply(t(lang, 'commands.admin.setlog.currentLogChannel', { channelId: current }));
      }

      if (args[0].toLowerCase() === 'clear') {
        if (!settings.moderation) settings.moderation = {};
        settings.moderation.logChannelId = null;
        settings.logChannelId = null;
        settings.markModified('moderation');
        await settings.save();
        settingsCache.invalidate(guild.id);
        return void await message.reply(t(lang, 'commands.admin.setlog.cleared'));
      }

      const channelMention = args[0].match(/^<#(\d{17,19})>$/);
      let channelId: string;
      if (channelMention) channelId = channelMention[1];
      else if (/^\d{17,19}$/.test(args[0])) channelId = args[0];
      else return void await message.reply(t(lang, 'commands.admin.setlog.invalidChannel'));

      let channel: any = guild.channels?.get(channelId);
      if (!channel) {
        try { channel = await client.channels.fetch(channelId); } catch {
          return void await message.reply(t(lang, 'commands.admin.setlog.channelDoesNotExist'));
        }
      }
      if (!channel) return void await message.reply(t(lang, 'commands.admin.setlog.channelDoesNotExist'));

      if (!settings.moderation) settings.moderation = {};
      settings.moderation.logChannelId = channelId;
      settings.logChannelId = null;
      settings.markModified('moderation');
      await settings.save();
      settingsCache.invalidate(guild.id);
      await message.reply(t(lang, 'commands.admin.setlog.setDone', { channelId }));
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !setlog (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !setlog: ${error.message || error}`);
        const cached: any = await settingsCache.get(guild.id).catch(() => null);
        const lang = normalizeLocale(cached?.language);
        message.reply(t(lang, 'commands.admin.setlog.errors.generic')).catch(() => {});
      }
    }
  }
};

export default command;
