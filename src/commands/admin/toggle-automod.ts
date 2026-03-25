import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'toggle-automod',
  description: 'Enable or disable the entire automod system \u2014 overrides all individual filter toggles',
  usage: '',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, _args, client) {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply('This command can only be used in a server.');

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      const currentLevel = settings.automod?.level || 'off';
      const newLevel = currentLevel === 'off' ? 'minimal' : 'off';

      settings.automod.level = newLevel;
      settings.markModified('automod');
      await settings.save();
      settingsCache.invalidate(guild.id);

      const status = newLevel === 'off' ? 'disabled' : 'enabled';
      await message.reply(`Automod system has been **${status}**.${newLevel !== 'off' ? ' Level: `minimal` (anti-spam on, anti-link off). Use `!toggle-antilink` / `!toggle-antispam` to adjust.' : ''}`);
    } catch (error: any) {
      if (isNetworkError(error)) {
        console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !toggle-automod (ECONNRESET)`);
      } else {
        console.error(`[${guild?.name || 'Unknown Server'}] Error in !toggle-automod: ${error.message || error}`);
        message.reply('An error occurred while toggling automod.').catch(() => {});
      }
    }
  }
};

export default command;
