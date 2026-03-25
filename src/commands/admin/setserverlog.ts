import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { LOG_CATEGORIES, type LogCategory } from '../../utils/logger';

const CATEGORY_LABELS: Record<string, string> = {
  member: 'Member (join/leave/role update)',
  voice: 'Voice (join/leave/move)',
  message: 'Message (edit/delete/pin)',
  role: 'Role (create/delete/update)',
  channel: 'Channel (create/delete/update)',
  reaction: 'Reaction (add/remove)',
  server: 'Server (webhooks/emojis/invites)',
};

function parseChannelId(arg: string): string | null {
  const mention = arg.match(/^<#(\d{17,19})>$/);
  if (mention) return mention[1];
  if (/^\d{17,19}$/.test(arg)) return arg;
  return null;
}

async function verifyChannel(channelId: string, guild: any, client: any): Promise<any> {
  let channel = guild.channels?.get(channelId);
  if (!channel) {
    try { channel = await client.channels.fetch(channelId); } catch {}
  }
  return channel || null;
}

const command: Command = {
  name: 'setserverlog',
  description: [
    'Set the channel where server events are logged. You can also split logs into separate channels by category.',
    '',
    '**Usage:**',
    '`!setserverlog #channel` - set the default log channel for all events',
    '`!setserverlog <category> #channel` - send a specific category to a different channel',
    '`!setserverlog <category> clear` - remove a category override (falls back to default)',
    '`!setserverlog status` - show all configured log channels',
    '`!setserverlog clear` - remove the default log channel',
    '',
    '**Categories:** `member`, `voice`, `message`, `role`, `channel`, `reaction`, `server`',
  ].join('\n'),
  usage: '[category] [#channel | clear]',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) {
      guild = await client.guilds.fetch((message as any).guildId);
    }

    if (!guild) {
      return void await message.reply('This command can only be used in a server.');
    }

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      const overrides = settings.logChannelOverrides || {};

      if (!args[0] || args[0].toLowerCase() === 'status') {
        const defaultCh = settings.serverLogChannelId;
        const lines: string[] = [];
        lines.push(`**Default:** ${defaultCh ? `<#${defaultCh}>` : 'Not set'}`);

        let hasOverrides = false;
        for (const cat of LOG_CATEGORIES) {
          if (overrides[cat]) {
            lines.push(`**${CATEGORY_LABELS[cat] || cat}:** <#${overrides[cat]}>`);
            hasOverrides = true;
          }
        }

        if (!hasOverrides && !defaultCh) {
          return void await message.reply(`No server log channel is set. Use \`${prefix}setserverlog #channel\` to set one.\n\nYou can also split logs by category: \`${prefix}setserverlog voice #voice-logs\``);
        }

        if (!hasOverrides) {
          lines.push('\n*All events go to the default channel. Use `' + prefix + 'setserverlog <category> #channel` to split them.*');
        }

        return void await message.reply(lines.join('\n'));
      }

      if (args[0].toLowerCase() === 'clear') {
        settings.serverLogChannelId = null;
        await settings.save();
        settingsCache.invalidate(guild.id);
        return void await message.reply('Server log channel cleared.');
      }

      const maybeCategory = args[0].toLowerCase();
      if ((LOG_CATEGORIES as readonly string[]).includes(maybeCategory)) {
        const category = maybeCategory as LogCategory;
        const action = args[1]?.toLowerCase();

        if (!action) {
          const current = overrides[category];
          return void await message.reply(
            `**${CATEGORY_LABELS[category]}** logs → ${current ? `<#${current}>` : 'default channel'}\n` +
            `Use \`${prefix}setserverlog ${category} #channel\` to set, or \`${prefix}setserverlog ${category} clear\` to reset.`
          );
        }

        if (action === 'clear') {
          if (!settings.logChannelOverrides) settings.logChannelOverrides = {};
          settings.logChannelOverrides[category] = null;
          settings.markModified('logChannelOverrides');
          await settings.save();
          settingsCache.invalidate(guild.id);
          return void await message.reply(`**${CATEGORY_LABELS[category]}** logs will now go to the default channel.`);
        }

        const channelId = parseChannelId(args[1]);
        if (!channelId) return void await message.reply('Please provide a valid channel mention or ID.');

        const channel = await verifyChannel(channelId, guild, client);
        if (!channel) return void await message.reply('That channel does not exist in this server.');

        if (!settings.logChannelOverrides) settings.logChannelOverrides = {};
        settings.logChannelOverrides[category] = channelId;
        settings.markModified('logChannelOverrides');
        await settings.save();
        settingsCache.invalidate(guild.id);

        return void await message.reply(`**${CATEGORY_LABELS[category]}** logs will now go to <#${channelId}>.`);
      }

      const channelId = parseChannelId(args[0]);
      if (!channelId) {
        return void await message.reply(
          `Invalid argument. Usage:\n` +
          `\`${prefix}setserverlog #channel\` - set the default log channel\n` +
          `\`${prefix}setserverlog <category> #channel\` - split by category\n` +
          `Categories: ${LOG_CATEGORIES.join(', ')}`
        );
      }

      const channel = await verifyChannel(channelId, guild, client);
      if (!channel) return void await message.reply('That channel does not exist in this server.');

      settings.serverLogChannelId = channelId;
      await settings.save();
      settingsCache.invalidate(guild.id);

      await message.reply(`Server log channel has been set to <#${channelId}>.`);

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !setserverlog (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !setserverlog: ${error.message || error}`);
        message.reply('An error occurred while setting the server log channel.').catch(() => {});
      }
    }
  }
};

export default command;
