import path from 'path';
import type { Command } from '../../types';
import config from '../../config';
import isNetworkError from '../../utils/isNetworkError';
import settingsCache from '../../utils/settingsCache';
import { t, normalizeLocale } from '../../i18n';

const command: Command = {
  name: 'reload',
  description: 'Reload a command',
  usage: '<command>',
  category: 'owner',
  ownerOnly: true,
  cooldown: 0,

  async execute(message, args, client) {
    if (config.ownerId && (message as any).author.id !== config.ownerId) {
      const guildId = message.guildId || message.guild?.id;
      const guildSettings = guildId ? await settingsCache.get(guildId).catch(() => null) : null;
      const lang = normalizeLocale(guildSettings?.language);
      return void await message.reply(t(lang, 'commands.reload.ownerOnly'));
    }

    if (!args[0]) {
      return void await message.reply(t('en', 'commands.reload.usage', { prefix: config.prefix }));
    }

    const commandName = args[0].toLowerCase();

    const commandHandler = (client as any).commandHandler;

    if (!commandHandler) {
      const guildId = message.guildId || message.guild?.id;
      const guildSettings = guildId ? await settingsCache.get(guildId).catch(() => null) : null;
      const lang = normalizeLocale(guildSettings?.language);
      return void await message.reply(t(lang, 'commands.reload.commandHandlerMissing'));
    }

    const oldCommand = commandHandler.getCommand(commandName);

    if (!oldCommand) {
      const guildId = message.guildId || message.guild?.id;
      const guildSettings = guildId ? await settingsCache.get(guildId).catch(() => null) : null;
      const lang = normalizeLocale(guildSettings?.language);
      return void await message.reply(t(lang, 'commands.reload.commandNotFound', { commandName }));
    }

    try {
      const commandsPath = path.join(__dirname, '..', '..', 'commands');
      const category = oldCommand.category;

      let commandPath: string;
      try {
        commandPath = require.resolve(path.join(commandsPath, category, `${oldCommand.name}.ts`));
      } catch {
        commandPath = require.resolve(path.join(commandsPath, category, `${oldCommand.name}.js`));
      }

      delete require.cache[commandPath];

      const imported = require(commandPath);
      const newCommand = imported.default || imported;

      commandHandler.commands.delete(oldCommand.name);
      if (oldCommand.aliases) {
        for (const alias of oldCommand.aliases) {
          commandHandler.commands.delete(alias);
        }
      }

      commandHandler.commands.set(newCommand.name, {
        ...newCommand,
        category
      });

      if (newCommand.aliases && Array.isArray(newCommand.aliases)) {
        for (const alias of newCommand.aliases) {
          commandHandler.commands.set(alias, {
            ...newCommand,
            category,
            isAlias: true
          });
        }
      }

      const guildId = message.guildId || message.guild?.id;
      const guildSettings = guildId ? await settingsCache.get(guildId).catch(() => null) : null;
      const lang = normalizeLocale(guildSettings?.language);
      await message.reply(t(lang, 'commands.reload.success', { commandName: newCommand.name }));

    } catch (error: any) {
      if (isNetworkError(error)) {
        console.warn(`Fluxer API unreachable during !reload (ECONNRESET)`);
      } else {
        console.error(`Error in !reload: ${error.message || error}`);
        const guildId = message.guildId || message.guild?.id;
        const guildSettings = guildId ? await settingsCache.get(guildId).catch(() => null) : null;
        const lang = normalizeLocale(guildSettings?.language);
        message.reply(t(lang, 'commands.reload.error', { error: error.message })).catch(() => {});
      }
    }
  }
};

export default command;
