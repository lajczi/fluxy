import path from 'path';
import type { Command } from '../../types';
import config from '../../config';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'reload',
  description: 'Reload a command',
  usage: '<command>',
  category: 'owner',
  ownerOnly: true,
  cooldown: 0,

  async execute(message, args, client) {
    if (config.ownerId && (message as any).author.id !== config.ownerId) {
      return void await message.reply('This command is restricted to the bot owner.');
    }

    if (!args[0]) {
      return void await message.reply('Usage: `!reload <command>`');
    }

    const commandName = args[0].toLowerCase();

    const commandHandler = (client as any).commandHandler;

    if (!commandHandler) {
      return void await message.reply('Command handler not available.');
    }

    const oldCommand = commandHandler.getCommand(commandName);

    if (!oldCommand) {
      return void await message.reply(`Command \`${commandName}\` not found.`);
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

      await message.reply(`Successfully reloaded command \`${newCommand.name}\`.`);

    } catch (error: any) {
      if (isNetworkError(error)) {
        console.warn(`Fluxer API unreachable during !reload (ECONNRESET)`);
      } else {
        console.error(`Error in !reload: ${error.message || error}`);
        message.reply(`Error reloading command: \`${error.message}\``).catch(() => {});
      }
    }
  }
};

export default command;
