import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';

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
    if (!guild) return void await message.reply('This command can only be used in a server.');

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      const newState = !settings.automod.antiReactionSpam;
      settings.automod.antiReactionSpam = newState;

      if (newState && (!settings.automod.level || settings.automod.level === 'off')) {
        settings.automod.level = 'minimal';
      }

      settings.markModified('automod');
      await settings.save();
      settingsCache.invalidate(guild.id);

      const status = newState ? 'enabled' : 'disabled';
      let reply = `Anti-reaction spam has been **${status}**.`;
      if (newState && settings.automod.level === 'minimal') {
        reply += ' Automod level set to `minimal` to activate it.';
      }
      if (!newState && settings.automod.level === 'off') {
        reply += ` (Automod is also off \u2014 use \`${prefix}toggle-automod\` to enable it.)`;
      }
      await message.reply(reply);
    } catch (error: any) {
      if (isNetworkError(error)) {
        console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !toggle-antireactionspam (ECONNRESET)`);
      } else {
        console.error(`[${guild?.name || 'Unknown Server'}] Error in !toggle-antireactionspam: ${error.message || error}`);
        message.reply('An error occurred while toggling anti-reaction spam.').catch(() => {});
      }
    }
  }
};

export default command;
