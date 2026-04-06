import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { EmbedBuilder } from '@erinjs/core';

const HEX_RE = /^#[0-9a-f]{6}$/i;

function strLen(str: string): number {
  return [...str].length;
}

async function save(settings: any, guildId: string): Promise<void> {
  settings.markModified('goodbyeMessage');
  await settings.save();
  settingsCache.invalidate(guildId);
}

function embedReply(message: any, description: string, title?: string): Promise<any> {
  const embed = new EmbedBuilder().setDescription(description).setColor(0x5865F2);
  if (title) embed.setTitle(title);
  return message.reply({ embeds: [embed] });
}

const subcommands: Record<string, (message: any, args: string[], guild: any, settings: any, client: any, prefix: string) => Promise<any>> = {

  async status(message, _args, guild, settings, _client, _prefix) {
    const gm   = settings.goodbyeMessage || {};
    const emb  = gm.embed || {};

    const ch      = gm.channelId ? `<#${gm.channelId}>` : 'Not set';
    const enabled = gm.enabled   ? 'Yes' : 'No';
    const msg     = gm.message   || 'Default';

    const statusEmbed = new EmbedBuilder()
      .setTitle('Goodbye Configuration')
      .setColor(0x5865F2)
      .setDescription(
        `Enabled: **${enabled}** | Channel: ${ch}\n` +
        `Text: ${msg}`
      )
      .addFields(
        {
          name: 'Embed',
          value: `${emb.enabled ? 'Enabled' : 'Disabled'}${emb.title ? ` | Title: ${emb.title}` : ''}` +
            (emb.description ? `\nDescription: ${emb.description}` : '') +
            (emb.color ? `\nColor: ${emb.color}` : '') +
            (emb.footer ? `\nFooter: ${emb.footer}` : ''),
        },
      )
      .setFooter({ text: 'Use !goodbye test to preview' })
      .setTimestamp(new Date());

    return message.reply({ embeds: [statusEmbed] });
  },

  async channel(message, args, guild, settings, client, prefix) {
    const val = args[0];
    if (!val) return embedReply(message, `Usage: \`${prefix}goodbye channel <#channel>\` or \`${prefix}goodbye channel clear\``);

    const gm = settings.goodbyeMessage;

    if (val.toLowerCase() === 'clear') {
      gm.channelId = null;
      gm.enabled = false;
      await save(settings, guild.id);
      return embedReply(message, 'Goodbye channel cleared and goodbye messages disabled.');
    }

    const channelId = val.match(/^<#(\d{17,19})>$/)?.[1] ?? (/^\d{17,19}$/.test(val) ? val : null);
    if (!channelId) return embedReply(message, 'Please mention a valid channel or provide a channel ID.');

    gm.channelId = channelId;
    gm.enabled = true;
    await save(settings, guild.id);
    return embedReply(message, `Goodbye channel set to <#${channelId}> and goodbye messages **enabled**.`);
  },

  async on(message, _args, guild, settings, client, prefix) {
    const gm = settings.goodbyeMessage;
    if (!gm.channelId) return embedReply(message, `Set a goodbye channel first: \`${prefix}goodbye channel <#channel>\``);
    gm.enabled = true;
    await save(settings, guild.id);
    return embedReply(message, 'Goodbye messages **enabled**.');
  },

  async off(message, _args, guild, settings, _client, _prefix) {
    settings.goodbyeMessage.enabled = false;
    await save(settings, guild.id);
    return embedReply(message, 'Goodbye messages **disabled**.');
  },

  async message(message, args, guild, settings, client, prefix) {
    const val = args.join(' ').trim();
    if (!val) return embedReply(message, `Usage: \`${prefix}goodbye message <text>\` or \`${prefix}goodbye message clear\`\nVariables: \`{user}\` \`{username}\` \`{server}\` \`{count}\``);

    const gm = settings.goodbyeMessage;

    if (val.toLowerCase() === 'clear') {
      gm.message = null;
      await save(settings, guild.id);
      return embedReply(message, 'Custom goodbye text cleared. Default message will be used.');
    }

    if (strLen(val) > 500) return embedReply(message, 'Goodbye message is too long (max 500 characters).');

    gm.message = val;
    await save(settings, guild.id);
    return embedReply(message, `Goodbye text set to:\n>>> ${val}`);
  },

  async embed(message, args, guild, settings, client, prefix) {
    const sub = args[0]?.toLowerCase();
    const gm = settings.goodbyeMessage;
    if (!gm.embed) gm.embed = {};
    const emb = gm.embed;

    if (sub === 'on') {
      emb.enabled = true;
      await save(settings, guild.id);
      return embedReply(message, 'Goodbye embed **enabled**.');
    }

    if (sub === 'off') {
      emb.enabled = false;
      await save(settings, guild.id);
      return embedReply(message, 'Goodbye embed **disabled**.');
    }

    if (sub === 'title') {
      const val = args.slice(1).join(' ').trim();
      if (!val) return embedReply(message, `Usage: \`${prefix}goodbye embed title <text>\` or \`${prefix}goodbye embed title clear\``);
      if (val.toLowerCase() === 'clear') {
        emb.title = null;
        await save(settings, guild.id);
        return embedReply(message, 'Embed title cleared.');
      }
      if (strLen(val) > 256) return embedReply(message, 'Embed title is too long (max 256 characters).');
      emb.title = val;
      await save(settings, guild.id);
      return embedReply(message, `Embed title set to: **${val}**`);
    }

    if (sub === 'description') {
      const val = args.slice(1).join(' ').trim();
      if (!val) return embedReply(message, `Usage: \`${prefix}goodbye embed description <text>\` or \`${prefix}goodbye embed description clear\``);
      if (val.toLowerCase() === 'clear') {
        emb.description = null;
        await save(settings, guild.id);
        return embedReply(message, 'Embed description cleared.');
      }
      if (strLen(val) > 2048) return embedReply(message, 'Embed description is too long (max 2048 characters).');
      emb.description = val;
      await save(settings, guild.id);
      return embedReply(message, 'Embed description set.');
    }

    if (sub === 'color') {
      const hex = args[1];
      if (!hex || !HEX_RE.test(hex)) return embedReply(message, `Provide a valid hex color. Example: \`${prefix}goodbye embed color #ff0000\``);
      emb.color = hex;
      await save(settings, guild.id);
      return embedReply(message, `Embed color set to **${hex}**.`);
    }

    if (sub === 'footer') {
      const val = args.slice(1).join(' ').trim();
      if (!val) return embedReply(message, `Usage: \`${prefix}goodbye embed footer <text>\` or \`${prefix}goodbye embed footer clear\``);
      if (val.toLowerCase() === 'clear') {
        emb.footer = null;
        await save(settings, guild.id);
        return embedReply(message, 'Embed footer cleared.');
      }
      if (strLen(val) > 2048) return embedReply(message, 'Embed footer is too long (max 2048 characters).');
      emb.footer = val;
      await save(settings, guild.id);
      return embedReply(message, `Embed footer set to: ${val}`);
    }

    return embedReply(message,
      `\`${prefix}goodbye embed on/off\` - enable or disable the embed\n` +
      `\`${prefix}goodbye embed title <text>\` - set embed title\n` +
      `\`${prefix}goodbye embed description <text>\` - set embed description\n` +
      `\`${prefix}goodbye embed color <#hex>\` - set embed color\n` +
      `\`${prefix}goodbye embed footer <text>\` - set embed footer\n` +
      'Variables: `{user}` `{username}` `{server}` `{count}`',
      'Goodbye Embed Options'
    );
  },

  async test(message, _args, guild, settings, client, prefix) {
    const gm = settings.goodbyeMessage || {};
    if (!gm.enabled && !gm.channelId && !gm.message) {
      return embedReply(message, `Goodbye messages are not configured yet. Use \`${prefix}goodbye channel <#channel>\` to get started.`);
    }

    const user = (message as any).author || (message as any).user;
    const memberCount = guild.members?.size || guild.memberCount || 0;

    const replaceVars = (text: string) => text
      .replace(/\\n/g, '\n')
      .replace(/\{user\}/gi, `<@${user.id}>`)
      .replace(/\{username\}/gi, user.username || 'Unknown')
      .replace(/\{server\}/gi, guild.name)
      .replace(/\{count\}/gi, String(memberCount || 0));

    const sendOpts: any = {};

    if (gm.message) {
      sendOpts.content = replaceVars(gm.message);
    } else {
      sendOpts.content = `**${user.username || 'Someone'}** has left **${guild.name}**.`;
    }

    if (gm.embed?.enabled) {
      const embConf = gm.embed;
      const embed = new EmbedBuilder();
      if (embConf.title) embed.setTitle(replaceVars(embConf.title));
      if (embConf.description) embed.setDescription(replaceVars(embConf.description));
      if (embConf.color) embed.setColor(parseInt(embConf.color.replace('#', ''), 16));
      if (embConf.footer) embed.setFooter({ text: replaceVars(embConf.footer) });
      embed.setTimestamp(new Date());
      sendOpts.embeds = [embed];
    }

    const channelNote = gm.channelId
      ? `This is a preview. Real goodbye messages will be sent to <#${gm.channelId}>.`
      : `This is a preview. Set a goodbye channel with \`${prefix}goodbye channel <#channel>\` for messages to send automatically.`;
    await embedReply(message, channelNote);
    await (message as any).channel.send(sendOpts);
  },
};


function showHelp(message: any, prefix = '!') {
  return embedReply(message,
    `\`${prefix}goodbye status\` - show current configuration\n` +
    `\`${prefix}goodbye channel <#channel>\` - set goodbye channel\n` +
    `\`${prefix}goodbye on/off\` - enable or disable\n` +
    `\`${prefix}goodbye message <text>\` - set custom text ({user} {username} {server} {count})\n` +
    `\`${prefix}goodbye embed\` - configure a goodbye embed (title, description, color, footer)\n` +
    `\`${prefix}goodbye test\` - preview the goodbye message`,
    'Goodbye System'
  );
}

const command: Command = {
  name: 'goodbye',
  description: [
    'Configure goodbye messages for your server. Run `!goodbye` with no arguments for the full guide.',
    '',
    '**Subcommands:**',
    '`status` - show current goodbye configuration',
    '`channel <#channel>` - set the goodbye channel',
    '`on/off` - enable or disable goodbye messages',
    '`message <text>` - set custom goodbye text ({user} {username} {server} {count})',
    '`embed on/off` - toggle a goodbye embed (title, description, color, footer)',
    '`test` - preview the goodbye output',
  ].join('\n'),
  usage: '<subcommand> [options]',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await embedReply(message, 'This command can only be used in a server.');

    const sub = args[0]?.toLowerCase();

    if (!sub || !subcommands[sub]) {
      return showHelp(message, prefix);
    }

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      if (!settings.goodbyeMessage) settings.goodbyeMessage = {};
      await subcommands[sub](message, args.slice(1), guild, settings, client, prefix);
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !goodbye (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !goodbye: ${error.message || error}`);
        embedReply(message, 'An error occurred while updating goodbye settings.').catch(() => {});
      }
    }
  }
};

export default command;
