import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';

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
      return void await message.reply('This command can only be used in a server.');
    }

    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || !['add', 'remove', 'list', 'clear'].includes(subcommand)) {
      return void await message.reply(
        `Usage: \`${prefix}blacklist add <#channel> | remove <#channel> | list | clear\`\n` +
        'Blacklisted channels prevent the bot from responding to non-staff members.'
      );
    }

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);

      switch (subcommand) {
        case 'add': {
          const channelArg = args[1];
          if (!channelArg) {
            return void await message.reply(`Please specify a channel to add. Usage: \`${prefix}blacklist add <#channel>\``);
          }

          let channelId: string;
          const mentionMatch = channelArg.match(/^<#(\d+)>$/);
          if (mentionMatch) {
            channelId = mentionMatch[1];
          } else if (/^\d+$/.test(channelArg)) {
            channelId = channelArg;
          } else {
            return void await message.reply('Invalid channel. Please use a channel mention or channel ID.');
          }

          const channel = guild.channels?.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
          if (!channel) {
            return void await message.reply('That channel doesn\'t exist in this server.');
          }

          if (settings.blacklistedChannels?.includes(channelId)) {
            return void await message.reply(`<#${channelId}> is already blacklisted.`);
          }

          if (!settings.blacklistedChannels) {
            settings.blacklistedChannels = [];
          }
          settings.blacklistedChannels.push(channelId);
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void await message.reply(`Added <#${channelId}> to the blacklist. Non-staff members cannot use bot commands there.`);
        }

        case 'remove': {
          const channelArg = args[1];
          if (!channelArg) {
            return void await message.reply(`Please specify a channel to remove. Usage: \`${prefix}blacklist remove <#channel>\``);
          }

          let channelId: string;
          const mentionMatch = channelArg.match(/^<#(\d+)>$/);
          if (mentionMatch) {
            channelId = mentionMatch[1];
          } else if (/^\d+$/.test(channelArg)) {
            channelId = channelArg;
          } else {
            return void await message.reply('Invalid channel. Please use a channel mention or channel ID.');
          }

          if (!settings.blacklistedChannels?.includes(channelId)) {
            return void await message.reply(`<#${channelId}> is not in the blacklist.`);
          }

          settings.blacklistedChannels = settings.blacklistedChannels.filter((id: string) => id !== channelId);
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void await message.reply(`Removed <#${channelId}> from the blacklist.`);
        }

        case 'list': {
          const blacklisted = settings.blacklistedChannels || [];

          if (blacklisted.length === 0) {
            return void await message.reply('No channels are currently blacklisted.');
          }

          const channelList = blacklisted.map((id: string) => `<#${id}>`).join('\n');
          return void await message.reply(`**Blacklisted Channels:**\n${channelList}`);
        }

        case 'clear': {
          if (!settings.blacklistedChannels || settings.blacklistedChannels.length === 0) {
            return void await message.reply('There are no blacklisted channels to clear.');
          }

          settings.blacklistedChannels = [];
          await settings.save();
          settingsCache.invalidate(guild.id);

          return void await message.reply('Cleared all channels from the blacklist.');
        }
      }

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !blacklist (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !blacklist: ${error.message || error}`);
        message.reply('An error occurred while managing the blacklist.').catch(() => {});
      }
    }
  }
};

export default command;
