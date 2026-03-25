import type { Command } from '../../types';
import { EmbedBuilder } from '@fluxerjs/core';
import GuildSettings from '../../models/GuildSettings';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'status',
  description: 'Show all bot settings for this server, automod, anti-link, anti-spam, ghost ping, log channel, autorole, and more',
  usage: '',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client) {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) {
      guild = await client.guilds.fetch((message as any).guildId);
    }
    
    if (!guild) {
      return void await message.reply('This command can only be used in a server.');
    }

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);

      const embed = new EmbedBuilder()
        .setTitle(`Server Settings for ${guild.name}`)
        .setColor(0x3498db)
        .setTimestamp(new Date());

      const am = settings.automod || {};
      const automodStatus = am.level && am.level !== 'off' ? `Enabled (${am.level})` : 'Disabled';
      const antiLinkStatus = am.antiLink ? 'Enabled' : 'Disabled';
      const antiSpamStatus = am.antiSpam ? 'Enabled' : 'Disabled';
      const antiReactionSpamStatus = am.antiReactionSpam ? 'Enabled' : 'Disabled';
      const antiGhostPingStatus = am.ghostPing ? 'Enabled' : 'Disabled';

      embed.addFields(
        { 
          name: 'Automod System', 
          value: `Status: ${automodStatus}`,
          inline: false 
        },
        { 
          name: 'Anti-Link', 
          value: antiLinkStatus, 
          inline: true 
        },
        { 
          name: 'Anti-Spam', 
          value: antiSpamStatus, 
          inline: true 
        },
        {
          name: 'Anti-Reaction Spam',
          value: antiReactionSpamStatus,
          inline: true
        },
        { 
          name: 'Anti-Ghost Ping', 
          value: antiGhostPingStatus, 
          inline: true 
        }
      );

      const modLogChannelId = settings.moderation?.logChannelId || settings.logChannelId;
      const logChannel = modLogChannelId 
        ? `<#${modLogChannelId}>` 
        : 'Not set';

      embed.addFields(
        { 
          name: 'Log Channel', 
          value: logChannel, 
          inline: true 
        }
      );

      const muteRole = settings.muteRoleId 
        ? `<@&${settings.muteRoleId}>` 
        : 'Not set';

      embed.addFields(
        { 
          name: 'Mute Role', 
          value: muteRole, 
          inline: true 
        }
      );

      const prefix = settings.prefix || process.env.PREFIX || '!';

      embed.addFields(
        { 
          name: 'Custom Prefix', 
          value: settings.prefix ? `\`${prefix}\`` : `Default (\`${process.env.PREFIX || '!'}\`)`, 
          inline: true 
        }
      );

      embed.setFooter({ 
        text: `Use !toggle-automod, !toggle-antilink, !toggle-antispam, !toggle-ghostping to change settings` 
      });

      await message.reply({ embeds: [embed] });

    } catch (error: any) {
      if (isNetworkError(error)) {
        console.warn(`[${(message as any).guild?.name || 'Unknown Server'}] Fluxer API unreachable during !status (ECONNRESET)`);
      } else {
        console.error(`[${(message as any).guild?.name || 'Unknown Server'}] Error in !status:`, error);
        message.reply('An error occurred while fetching server settings.').catch(() => {});
      }
    }
  }
};

export default command;
