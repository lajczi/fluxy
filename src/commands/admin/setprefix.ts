import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'setprefix',
  description: 'Set a custom prefix for this server',
  usage: '<prefix>',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client) {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply('This command can only be used in a server.');

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);

      if (!args[0]) {
        const currentPrefixes = settings.prefixes || [];
        if (currentPrefixes.length === 0) {
          return void await message.reply('No custom prefix is set. The default prefix is being used.');
        }
        const prefixList = currentPrefixes.map((p: string) => `\`${p}\``).join(', ');
        return void await message.reply(`Current prefix(es): ${prefixList}`);
      }

      const newPrefix = args[0];
      if (!newPrefix || newPrefix.trim() === '') return void await message.reply('The prefix cannot be empty or only whitespace.');
      if (newPrefix.includes(' ')) return void await message.reply('The prefix cannot contain spaces.');
      if (newPrefix.length > 10) return void await message.reply('The prefix cannot be longer than 10 characters.');

      await GuildSettings.updateSetting(guild.id, 'prefixes', [newPrefix]);
      settingsCache.invalidate(guild.id);
      await message.reply(`Server prefix has been set to \`${newPrefix}\`.`);
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !setprefix (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !setprefix: ${error.message || error}`);
        message.reply('An error occurred while setting the prefix.').catch(() => {});
      }
    }
  }
};

export default command;
