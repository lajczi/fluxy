import type { Command } from '../../types';
import UserSettings from '../../models/UserSettings';
import isNetworkError from '../../utils/isNetworkError';

const MAX_PREFIX_LENGTH = 10;

const command: Command = {
  name: 'myprefix',
  description: 'Set a personal prefix that works for you across all servers',
  usage: '<prefix> | clear | view',
  category: 'general',
  permissions: [],
  aliases: ['mp'],
  cooldown: 5,
  allowDM: true,

  async execute(message, args, _client, prefix = '!') {
    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'view') {
      try {
        const current = await UserSettings.getPrefix((message as any).author.id);
        if (current) {
          return void await message.reply(`Your personal prefix is \`${current}\`. Use \`${prefix}myprefix clear\` to remove it.`);
        }
        return void await message.reply(`You don't have a personal prefix set. Use \`${prefix}myprefix <prefix>\` to set one.`);
      } catch (error: any) {
        if (isNetworkError(error)) return;
        return void await message.reply('Could not fetch your prefix setting.');
      }
    }

    if (sub === 'clear' || sub === 'reset' || sub === 'remove') {
      try {
        await UserSettings.setPrefix((message as any).author.id, null);
        return void await message.reply('Your personal prefix has been removed. You will use the server default.');
      } catch (error: any) {
        if (isNetworkError(error)) return;
        return void await message.reply('Could not clear your prefix.');
      }
    }

    const newPrefix = args[0];
    if (newPrefix.length > MAX_PREFIX_LENGTH) {
      return void await message.reply(`Prefix is too long (max ${MAX_PREFIX_LENGTH} characters).`);
    }

    if (/\s/.test(newPrefix)) {
      return void await message.reply('Prefix cannot contain spaces.');
    }

    try {
      await UserSettings.setPrefix((message as any).author.id, newPrefix);
      return void await message.reply(`Your personal prefix has been set to \`${newPrefix}\`. You can now use \`${newPrefix}help\` anywhere.`);
    } catch (error: any) {
      if (isNetworkError(error)) return;
      return void await message.reply('Could not save your prefix.');
    }
  }
};

export default command;
