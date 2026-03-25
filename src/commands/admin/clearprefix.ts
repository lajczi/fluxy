import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import config from '../../config';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'clearprefix',
  description: 'Reset the server prefix to the default',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, _args, client) {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply('This command can only be used in a server.');

    try {
      const defaultPrefix = config.prefix;
      await GuildSettings.updateSetting(guild.id, 'prefixes', [defaultPrefix]);
      settingsCache.invalidate(guild.id);
      await message.reply(`Server prefix has been reset to the default: \`${defaultPrefix}\`.`);
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !clearprefix (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !clearprefix: ${error.message || error}`);
        message.reply('An error occurred while clearing the prefix.').catch(() => {});
      }
    }
  }
};

export default command;
