import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { t, normalizeLocale } from '../../i18n';

const command: Command = {
  name: 'blacklist',
  description: 'Manage channels where the bot ignores commands from non-staff',
  usage: 'add <#channel> | remove <#channel> | list | clear',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) {
      guild = await client.guilds.fetch((message as any).guildId);
    }

    if (!guild) {
      return void (await message.reply(t('en', 'commands.admin.blacklist.serverOnly')));
    }

    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || !['add', 'remove', 'list', 'clear'].includes(subcommand)) {
      return void (await message.reply(t('en', 'commands.admin.blacklist.usage', { prefix })));
    }

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      const lang = normalizeLocale(settings?.language);

      switch (subcommand) {
        case 'add': {
          const channelArg = args[1];
          if (!channelArg) {
            return void (await message.reply(t(lang, 'commands.admin.blacklist.specifyChannelToAdd', { prefix })));
          }

          let channelId: string;
          const mentionMatch = channelArg.match(/^<#(\d+)>$/);
          if (mentionMatch) {
            channelId = mentionMatch[1];
          } else if (/^\d+$/.test(channelArg)) {
            channelId = channelArg;
          } else {
            return void (await message.reply(t(lang, 'commands.admin.blacklist.invalidChannel')));
          }

          const channel = guild.channels?.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
          if (!channel) {
            return void (await message.reply(t(lang, 'commands.admin.blacklist.channelDoesNotExist')));
          }

          if (settings.blacklistedChannels?.includes(channelId)) {
            return void (await message.reply(t(lang, 'commands.admin.blacklist.alreadyBlacklisted', { channelId })));
          }

          if (!settings.blacklistedChannels) {
            settings.blacklistedChannels = [];
          }
          settings.blacklistedChannels.push(channelId);
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void (await message.reply(t(lang, 'commands.admin.blacklist.addedToBlacklist', { channelId })));
        }

        case 'remove': {
          const channelArg = args[1];
          if (!channelArg) {
            return void (await message.reply(t(lang, 'commands.admin.blacklist.specifyChannelToRemove', { prefix })));
          }

          let channelId: string;
          const mentionMatch = channelArg.match(/^<#(\d+)>$/);
          if (mentionMatch) {
            channelId = mentionMatch[1];
          } else if (/^\d+$/.test(channelArg)) {
            channelId = channelArg;
          } else {
            return void (await message.reply(t(lang, 'commands.admin.blacklist.invalidChannel')));
          }

          if (!settings.blacklistedChannels?.includes(channelId)) {
            return void (await message.reply(t(lang, 'commands.admin.blacklist.notInBlacklist', { channelId })));
          }

          settings.blacklistedChannels = settings.blacklistedChannels.filter((id: string) => id !== channelId);
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void (await message.reply(t(lang, 'commands.admin.blacklist.removedFromBlacklist', { channelId })));
        }

        case 'list': {
          const blacklisted = settings.blacklistedChannels || [];

          if (blacklisted.length === 0) {
            return void (await message.reply(t(lang, 'commands.admin.blacklist.noChannelsBlacklisted')));
          }

          const channelList = blacklisted.map((id: string) => `<#${id}>`).join('\n');
          return void (await message.reply(t(lang, 'commands.admin.blacklist.blacklistedChannels', { channelList })));
        }

        case 'clear': {
          if (!settings.blacklistedChannels || settings.blacklistedChannels.length === 0) {
            return void (await message.reply(t(lang, 'commands.admin.blacklist.noChannelsToClear')));
          }

          settings.blacklistedChannels = [];
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void (await message.reply(t(lang, 'commands.admin.blacklist.clearedAll')));
        }
      }
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !blacklist (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !blacklist: ${error.message || error}`);
        const cached: any = await settingsCache.get(guild.id).catch(() => null);
        const lang = normalizeLocale(cached?.language);
        message.reply(t(lang, 'commands.admin.blacklist.errors.generic')).catch(() => {});
      }
    }
  },
};

export default command;
