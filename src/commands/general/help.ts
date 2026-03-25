import { EmbedBuilder } from '@fluxerjs/core';
import type { Command } from '../../types';
import config from '../../config';
import isNetworkError from '../../utils/isNetworkError';
import settingsCache from '../../utils/settingsCache';
import { hasAnyPermission } from '../../utils/permissions';

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  moderation: { label: 'Moderation', description: 'Ban, kick, warn, timeout, mute, clear, slowmode' },
  admin:      { label: 'Admin',      description: 'Configure the bot - logging, automod, tickets, lockdown, reaction roles' },
  info:       { label: 'Info',        description: 'Server, member, role, and bot information' },
  general:    { label: 'General',     description: 'Help, ping, report' },
};

const CATEGORY_ORDER = ['moderation', 'admin', 'info', 'general'];


async function getPrefix(message: any): Promise<string> {
  const guildId = message.guildId || message.guild?.id;
  if (!guildId) return config.prefix;
  try {
    const settings = await settingsCache.get(guildId);
    if (settings?.prefixes?.length) return settings.prefixes[0];
  } catch {}
  return config.prefix;
}

function isCommandDisabledInGuild(cmd: Command, disabled: unknown): boolean {
  if (!Array.isArray(disabled) || disabled.length === 0) return false;
  return disabled.includes(cmd.name) || disabled.includes(cmd.category);
}

async function canUserSeeCommand(opts: {
  message: any;
  cmd: Command;
  isOwner: boolean;
  member: any | null;
  disabledCommands: unknown;
}): Promise<boolean> {
  const { message, cmd, isOwner, member, disabledCommands } = opts;

  if ((cmd as any).hidden) return false;
  if (cmd.ownerOnly && !isOwner) return false;
  if (!message.guildId && !message.guild?.id) {
    if (cmd.category === 'owner') return isOwner;
    return Boolean(cmd.allowDM);
  }

  if (cmd.category !== 'owner' && isCommandDisabledInGuild(cmd, disabledCommands)) return false;

  if (cmd.permissions?.length) {
    if (!member) return false;
    return hasAnyPermission(member, cmd.permissions);
  }

  return true;
}

const command: Command = {
  name: 'help',
  description: 'Show all commands, or detailed info on a specific command.',
  usage: '[command]',
  category: 'general',
  cooldown: 5,

  async execute(message, args, client) {
    const commandHandler = (client as any).commandHandler;
    if (!commandHandler) return void await message.reply('Command handler not available.');

    const prefix = await getPrefix(message);
    const isOwner = Boolean(config.ownerId && (message as any).author.id === config.ownerId);
    const guildId = message.guildId || message.guild?.id;
    const member = guildId ? await (commandHandler as any).getMember(message).catch(() => null) : null;
    const disabledCommands = guildId ? (await settingsCache.get(guildId).catch(() => null))?.disabledCommands : null;

    try {
      if (args[0]) {
        const commandName = args[0].toLowerCase().replace(/^[^\w]/, '');
        const cmd = commandHandler.getCommand(commandName);

        const visible = cmd && await canUserSeeCommand({ message, cmd, isOwner, member, disabledCommands });
        if (!cmd || !visible) {
          return void await message.reply(`No command called \`${commandName}\` found. Use \`${prefix}help\` to see all commands.`).catch(() => {});
        }

        const usageStr = `\`${prefix}${cmd.name}${cmd.usage ? ' ' + cmd.usage : ''}\``;
        const meta = CATEGORY_META[cmd.category] ?? { label: cmd.category };

        const embed = new EmbedBuilder()
          .setTitle(`${cmd.name}`)
          .setDescription(Array.isArray(cmd.description) ? cmd.description.join('\n') : (cmd.description || 'No description provided.'))
          .setColor(0x6c72f8)
          .addFields({ name: 'Usage', value: usageStr, inline: false });

        if (cmd.permissions?.length) {
          embed.addFields({ name: 'Permission Required', value: cmd.permissions.join(', '), inline: true });
        }
        if (cmd.aliases?.length) {
          embed.addFields({ name: 'Aliases', value: cmd.aliases.map((a: string) => `\`${a}\``).join('  '), inline: true });
        }
        if (cmd.cooldown) {
          embed.addFields({ name: 'Cooldown', value: `${cmd.cooldown}s`, inline: true });
        }

        embed.addFields({ name: 'Category', value: `${meta.label}`, inline: true });
        embed.setFooter({ text: `${prefix}help [command] \u2022 Fluxy Docs: fluxy.dorcus.digital` });
        embed.setTimestamp(new Date());

        try {
          return void await message.reply({ embeds: [embed] });
        } catch {
          const lines = [
            `**${cmd.name}** \u2014 ${Array.isArray(cmd.description) ? cmd.description[0] : cmd.description || ''}`,
            `Usage: ${usageStr}`,
            cmd.permissions?.length ? `Permission: ${cmd.permissions.join(', ')}` : '',
            cmd.aliases?.length    ? `Aliases: ${cmd.aliases.join(', ')}` : '',
          ].filter(Boolean);
          return void await message.reply(lines.join('\n')).catch(() => {});
        }
      }

      const categories = commandHandler.getCommandsByCategory();
      const sorted = CATEGORY_ORDER.filter(c => categories[c])
        .concat(Object.keys(categories).filter(c => !CATEGORY_ORDER.includes(c)));

      const embed = new EmbedBuilder()
        .setTitle('Fluxy \u2014 Help Menu')
        .setDescription(
          `Prefix: **\`${prefix}\`**\n` +
          `Use \`${prefix}help <command>\` for detailed info on any command.\n` +
          `[Full Documentation](https://fluxy.dorcus.digital) \u2022 [Web Dashboard](https://bot.dorcus.digital)`
        )
        .setColor(0x6c72f8)
        .setFooter({ text: `${prefix}help <command> for details \u2022 Dashboard: bot.dorcus.digital` })
        .setTimestamp(new Date());

      for (const cat of sorted) {
        const cmds = categories[cat];
        if (!cmds) continue;
        if (cat === 'owner') continue;
        const visible: Command[] = [];
        for (const c of cmds) {
          if (await canUserSeeCommand({ message, cmd: c, isOwner, member, disabledCommands })) visible.push(c);
        }
        if (visible.length === 0) continue;
        const meta = CATEGORY_META[cat] ?? { label: cat };
        const cmdList = visible.map((cmd: Command) => `\`${cmd.name}\``).join('  ');
        embed.addFields({ name: meta.label, value: cmdList, inline: false });
      }

      try {
        await message.reply({ embeds: [embed] });
      } catch {
        const lines = [`**Fluxy \u2014 Command List** \u2022 Prefix: \`${prefix}\``, ''];
        for (const cat of sorted) {
          const cmds = categories[cat];
          if (!cmds) continue;
          if (cat === 'owner') continue;
          const visible: Command[] = [];
          for (const c of cmds) {
            if (await canUserSeeCommand({ message, cmd: c, isOwner, member, disabledCommands })) visible.push(c);
          }
          if (visible.length === 0) continue;
          const meta = CATEGORY_META[cat] ?? { label: cat };
          lines.push(`**${meta.label}**`);
          lines.push(visible.map((c: Command) => `\`${c.name}\``).join('  '));
          lines.push('');
        }
        return void await message.reply(lines.join('\n')).catch(() => {});
      }

    } catch (error: any) {
      const guildName = (message as any).guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !help (ECONNRESET)`);
      } else if (
        error?.message?.toLowerCase().includes('nsfw') ||
        error?.message?.toLowerCase().includes('age restricted')
      ) {
      } else {
        console.error(`[${guildName}] Error in !help: ${error.message || error}`);
        try { await message.reply('An error occurred while generating help information.'); } catch {}
      }
    }
  }
};

export default command;
