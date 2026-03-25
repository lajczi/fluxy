import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'toggle-antispam',
  description: 'Mute members who send many messages in quick succession \u2014 triggers after repeated rapid messages',
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
      const newState = !settings.automod.antiSpam;
      settings.automod.antiSpam = newState;

      if (newState && (!settings.automod.level || settings.automod.level === 'off')) {
        settings.automod.level = 'minimal';
      }

      settings.markModified('automod');
      await settings.save();
      settingsCache.invalidate(guild.id);

      const status = newState ? 'enabled' : 'disabled';
      let reply = `Anti-spam filter has been **${status}**.`;
      if (newState && settings.automod.level === 'minimal') {
        reply += ' Automod level set to `minimal` to activate it.';
      }
      if (!newState && settings.automod.level === 'off') {
        reply += ` (Automod is also off \u2014 use \`${prefix}toggle-automod\` to enable it.)`;
      }
      await message.reply(reply);
    } catch (error: any) {
      if (isNetworkError(error)) {
        console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !toggle-antispam (ECONNRESET)`);
      } else {
        console.error(`[${guild?.name || 'Unknown Server'}] Error in !toggle-antispam: ${error.message || error}`);
        message.reply('An error occurred while toggling anti-spam.').catch(() => {});
      }
    }
  }
};

export default command;
