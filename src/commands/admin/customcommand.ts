import type { Command } from '../../types';
import { EmbedBuilder } from '@fluxerjs/core';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';

const RESERVED_NAMES = [
  'help', 'ticket', 'automod', 'ban', 'kick', 'warn', 'mute', 'unmute',
  'clear', 'timeout', 'lockdown', 'setlog', 'setserverlog', 'setstaff',
  'setprefix', 'clearprefix', 'blacklist', 'welcome', 'autorole',
  'reactionrole', 'rr', 'roleall', 'roleclear', 'status', 'report',
  'honeypot', 'hp', 'keywords', 'customcommand', 'cc',
  'toggle-automod', 'toggle-antispam', 'toggle-antilink',
  'toggle-antireactionspam', 'toggle-ghostping',
  'serverinfo', 'userinfo', 'avatar', 'ping', 'uptime',
  'warnings', 'slowmode', 'nick'
];

const MAX_COMMANDS = 50;
const MAX_RESPONSE_LENGTH = 2000;

function parseColor(str?: string): string | null {
  if (!str) return null;
  const hex = str.replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
  return null;
}

const subcommands: Record<string, (message: any, args: string[], guild: any, settings: any) => Promise<any>> = {

  async add(message, args, guild, settings) {
    const name = args[0]?.toLowerCase();
    if (!name) {
      return message.reply(
        'Usage: `!customcommand add <name> <response>`\n' +
        'Example: `!customcommand add invite Join our server: https://fluxer.app/invite/abc`'
      );
    }

    if (!/^[a-z0-9_-]{1,32}$/.test(name)) {
      return message.reply('Command names must be 1–32 characters, alphanumeric, hyphens, or underscores only.');
    }

    if (RESERVED_NAMES.includes(name)) {
      return message.reply(`\`${name}\` is a built-in command and cannot be used as a custom command name.`);
    }

    const response = args.slice(1).join(' ').trim();
    if (!response) {
      return message.reply('Please provide a response message.\nUsage: `!customcommand add <name> <response>`');
    }

    if (response.length > MAX_RESPONSE_LENGTH) {
      return message.reply(`Response is too long (${response.length}/${MAX_RESPONSE_LENGTH} characters).`);
    }

    const existing = settings.customCommands?.find((c: any) => c.name === name);
    if (existing) {
      return message.reply(`A custom command \`!${name}\` already exists. Use \`!customcommand edit ${name} <new response>\` to change it, or \`!customcommand remove ${name}\` first.`);
    }

    if ((settings.customCommands?.length || 0) >= MAX_COMMANDS) {
      return message.reply(`You've reached the maximum of ${MAX_COMMANDS} custom commands. Remove one first.`);
    }

    settings.customCommands.push({ name, response: response.replace(/\\n/g, '\n') });
    settings.markModified('customCommands');
    await settings.save();
    settingsCache.invalidate(guild.id);

    return message.reply(`Custom command \`!${name}\` created.`);
  },

  async remove(message, args, guild, settings) {
    const name = args[0]?.toLowerCase();
    if (!name) return message.reply('Usage: `!customcommand remove <name>`');

    const idx = settings.customCommands?.findIndex((c: any) => c.name === name);
    if (idx === undefined || idx === -1) {
      return message.reply(`No custom command \`!${name}\` found.`);
    }

    settings.customCommands.splice(idx, 1);
    settings.markModified('customCommands');
    await settings.save();
    settingsCache.invalidate(guild.id);

    return message.reply(`Custom command \`!${name}\` removed.`);
  },

  async edit(message, args, guild, settings) {
    const name = args[0]?.toLowerCase();
    if (!name) return message.reply('Usage: `!customcommand edit <name> <new response>`');

    const response = args.slice(1).join(' ').trim();
    if (!response) return message.reply('Please provide the new response.\nUsage: `!customcommand edit <name> <new response>`');

    if (response.length > MAX_RESPONSE_LENGTH) {
      return message.reply(`Response is too long (${response.length}/${MAX_RESPONSE_LENGTH} characters).`);
    }

    const cmd = settings.customCommands?.find((c: any) => c.name === name);
    if (!cmd) {
      return message.reply(`No custom command \`!${name}\` found.`);
    }

    cmd.response = response.replace(/\\n/g, '\n');
    settings.markModified('customCommands');
    await settings.save();
    settingsCache.invalidate(guild.id);

    return message.reply(`Custom command \`!${name}\` updated.`);
  },

  async embed(message, args, guild, settings) {
    const name = args[0]?.toLowerCase();
    const toggle = args[1]?.toLowerCase();

    if (!name || !['on', 'off'].includes(toggle)) {
      return message.reply(
        'Usage: `!customcommand embed <name> <on|off> [color] [title]`\n' +
        'Example: `!customcommand embed invite on #5865F2 Server Invite`'
      );
    }

    const cmd = settings.customCommands?.find((c: any) => c.name === name);
    if (!cmd) {
      return message.reply(`No custom command \`!${name}\` found.`);
    }

    cmd.embed = toggle === 'on';

    if (toggle === 'on') {
      const colorArg = args[2];
      const color = parseColor(colorArg);
      if (color) {
        cmd.color = color;
        const title = args.slice(3).join(' ').trim() || null;
        cmd.title = title;
      } else if (colorArg) {
        cmd.title = args.slice(2).join(' ').trim() || null;
      }
    }

    settings.markModified('customCommands');
    await settings.save();
    settingsCache.invalidate(guild.id);

    if (cmd.embed) {
      let reply = `\`!${name}\` will now send as an embed.`;
      if (cmd.color) reply += ` Color: \`${cmd.color}\``;
      if (cmd.title) reply += ` Title: **${cmd.title}**`;
      return message.reply(reply);
    }
    return message.reply(`\`!${name}\` will now send as a plain message.`);
  },

  async list(message, args, guild, settings) {
    const commands = settings.customCommands || [];
    if (commands.length === 0) {
      return message.reply('No custom commands configured. Use `!customcommand add <name> <response>` to create one.');
    }

    const lines = commands.map((c: any, i: number) => {
      const preview = c.response.length > 60 ? c.response.substring(0, 57) + '...' : c.response;
      const flags = c.embed ? ' (embed)' : '';
      return `**${i + 1}.** \`!${c.name}\`${flags} - ${preview}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`Custom Commands - ${guild.name}`)
      .setDescription(lines.join('\n'))
      .setColor(0x5865F2)
      .setFooter({ text: `${commands.length}/${MAX_COMMANDS} commands` });

    return message.reply({ embeds: [embed] });
  },

  async info(message, args, guild, settings) {
    const name = args[0]?.toLowerCase();
    if (!name) return message.reply('Usage: `!customcommand info <name>`');

    const cmd = settings.customCommands?.find((c: any) => c.name === name);
    if (!cmd) {
      return message.reply(`No custom command \`!${name}\` found.`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`Custom Command: !${cmd.name}`)
      .setColor(0x5865F2)
      .addFields(
        { name: 'Response', value: cmd.response.length > 1024 ? cmd.response.substring(0, 1021) + '...' : cmd.response },
        { name: 'Embed Mode', value: cmd.embed ? 'Yes' : 'No', inline: true }
      );

    if (cmd.embed && cmd.color) embed.addFields({ name: 'Color', value: cmd.color, inline: true });
    if (cmd.embed && cmd.title) embed.addFields({ name: 'Title', value: cmd.title, inline: true });

    return message.reply({ embeds: [embed] });
  }
};

function showHelp(message: any) {
  const embed = new EmbedBuilder()
    .setTitle('Custom Commands')
    .setColor(0x5865F2)
    .setDescription('Create custom commands that the bot responds to with a configured message.')
    .addFields(
      { name: '!customcommand add <name> <response>', value: 'Create a new custom command' },
      { name: '!customcommand remove <name>', value: 'Delete a custom command' },
      { name: '!customcommand edit <name> <new response>', value: 'Change the response of an existing command' },
      { name: '!customcommand embed <name> <on|off> [color] [title]', value: 'Toggle embed mode for a command' },
      { name: '!customcommand list', value: 'List all custom commands' },
      { name: '!customcommand info <name>', value: 'Show details of a specific command' }
    )
    .setFooter({ text: 'Use \\n in responses for line breaks. Max 50 commands, 2000 chars each.' });

  return message.reply({ embeds: [embed] });
}

const command: Command = {
  name: 'customcommand',
  aliases: ['cc'],
  description: 'Create and manage custom commands with configurable responses.',
  usage: '<add|remove|edit|embed|list|info> [args...]',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client) {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply('This command can only be used in a server.');

    const sub = args[0]?.toLowerCase();

    if (!sub || !subcommands[sub]) {
      return showHelp(message);
    }

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      if (!settings.customCommands) settings.customCommands = [];
      await subcommands[sub](message, args.slice(1), guild, settings);
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !customcommand (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !customcommand: ${error.message || error}`);
        message.reply('An error occurred while processing the custom command.').catch(() => {});
      }
    }
  }
};

export default command;
