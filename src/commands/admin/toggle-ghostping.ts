import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';

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
    if (!guild) return void await message.reply('This command can only be used in a server.');

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      if (!settings.automod) settings.automod = {};
      settings.automod.ghostPing = !settings.automod.ghostPing;
      settings.markModified('automod');
      await settings.save();
      settingsCache.invalidate(guild.id);

      const status = settings.automod.ghostPing ? 'enabled' : 'disabled';
      await message.reply(`Anti-ghost ping filter has been **${status}**.`);

      if (settings.automod.ghostPing && settings.automod.level === 'off') {
        await message.reply(`**Note:** Automod level is currently set to \`off\`. Use \`${prefix}automod level minimal\` (or higher) or run \`${prefix}toggle-automod\` for ghost ping detection to take effect.`);
      }
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !toggle-ghostping (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !toggle-ghostping: ${error.message || error}`);
        message.reply('An error occurred while toggling anti-ghost ping.').catch(() => {});
      }
    }
  }
};

export default command;
