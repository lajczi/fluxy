import type { Command } from '../../types';
import { EmbedBuilder } from '@fluxerjs/core';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';

const VALID_LEVELS = ['off', 'minimal', 'medium', 'high'];

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  off:     'All automod modules disabled',
  minimal: 'Anti-spam on, anti-link off, relaxed mention/line limits',
  medium:  'Anti-spam + anti-link + anti-reaction spam on, moderate limits',
  high:    'Anti-spam + anti-link + anti-reaction spam on, strict limits'
};

function yn(bool: any): string {
  return bool ? 'Yes' : 'No';
}


function parseRoleId(arg?: string): string | null {
  const m = arg?.match(/^<@&(\d{17,19})>$/);
  return m ? m[1] : (/^\d{17,19}$/.test(arg || '') ? arg! : null);
}

function parseChannelId(arg?: string): string | null {
  const m = arg?.match(/^<#(\d{17,19})>$/);
  return m ? m[1] : (/^\d{17,19}$/.test(arg || '') ? arg! : null);
}

async function showStatus(message: any, guild: any, settings: any) {
  const am = settings.automod || {};
  const spam = am.spam || {};
  const exemptRoles    = (am.exemptRoles    || []).map((id: string) => `<@&${id}>`).join(', ') || 'None';
  const exemptChannels = (am.exemptChannels || []).map((id: string) => `<#${id}>`).join(', ')   || 'None';
  const customDomains  = (am.allowedDomains || []).join(', ') || 'None';

  const embed = new EmbedBuilder()
    .setTitle(`Automod Settings - ${guild.name}`)
    .setColor(0x5865F2)
    .addFields(
      { name: 'Level',       value: `\`${am.level || 'off'}\` - ${LEVEL_DESCRIPTIONS[am.level || 'off']}` },
      { name: 'Anti-Spam',   value: yn(am.antiSpam),  inline: true },
      { name: 'Anti-Link',   value: yn(am.antiLink),  inline: true },
      { name: 'Anti-Reaction Spam', value: yn(am.antiReactionSpam), inline: true },
      { name: 'Ghost Ping',  value: yn(am.ghostPing), inline: true },
      {
        name: 'Spam Thresholds',
        value:
          `**Max messages:** ${spam.maxMessages ?? 5} per **${spam.timeWindow ?? 5}s** window\n` +
          `**Timeout after:** ${spam.violationThreshold ?? 3} violations → ${spam.timeoutDuration ?? 10} min timeout`
      },
      { name: 'Allowed Domains (extra)', value: customDomains },
      { name: 'Exempt Roles',    value: exemptRoles },
      { name: 'Exempt Channels', value: exemptChannels }
    )
    .setFooter({ text: 'Use !automod <subcommand> to change settings' })
    .setTimestamp(new Date());

  return message.reply({ embeds: [embed] });
}

const subcommands: Record<string, (message: any, args: string[], guild: any, settings: any) => Promise<any>> = {

  async status(message, args, guild, settings) {
    return showStatus(message, guild, settings);
  },

  async level(message, args, guild, settings) {
    const lvl = args[0]?.toLowerCase();
    if (!lvl || !VALID_LEVELS.includes(lvl)) {
      return message.reply(`Valid levels: \`${VALID_LEVELS.join('`, `')}\``);
    }

    settings.automod.level = lvl;

    const presets: Record<string, { antiSpam: boolean; antiLink: boolean; antiReactionSpam: boolean }> = {
      off:     { antiSpam: false, antiLink: false, antiReactionSpam: false },
      minimal: { antiSpam: true,  antiLink: false, antiReactionSpam: false },
      medium:  { antiSpam: true,  antiLink: true,  antiReactionSpam: true  },
      high:    { antiSpam: true,  antiLink: true,  antiReactionSpam: true  }
    };
    Object.assign(settings.automod, presets[lvl]);

    settings.markModified('automod');
    await settings.save();
    settingsCache.invalidate(guild.id);

    return message.reply(`Automod level set to \`${lvl}\`. ${LEVEL_DESCRIPTIONS[lvl]}.`);
  },

  async spam(message, args, guild, settings) {
    const [sub, rawVal] = args;
    const val = parseInt(rawVal, 10);

    if (!settings.automod.spam) settings.automod.spam = {};

    switch (sub) {
      case 'messages': {
        if (isNaN(val) || val < 2 || val > 20) return message.reply('`messages` must be between 2 and 20.');
        settings.automod.spam.maxMessages = val;
        break;
      }
      case 'window': {
        if (isNaN(val) || val < 1 || val > 60) return message.reply('`window` must be between 1 and 60 seconds.');
        settings.automod.spam.timeWindow = val;
        break;
      }
      case 'timeout': {
        if (isNaN(val) || val < 1 || val > 60) return message.reply('`timeout` must be between 1 and 60 minutes.');
        settings.automod.spam.timeoutDuration = val;
        break;
      }
      case 'violations': {
        if (isNaN(val) || val < 1 || val > 10) return message.reply('`violations` must be between 1 and 10.');
        settings.automod.spam.violationThreshold = val;
        break;
      }
      default:
        return message.reply(
          'Usage: `!automod spam <messages|window|timeout|violations> <value>`\n' +
          '- `messages` - max messages per window (2–20, default 5)\n' +
          '- `window` - tracking window in seconds (1–60, default 5)\n' +
          '- `timeout` - timeout length in minutes (1–60, default 10)\n' +
          '- `violations` - violations before timeout (1–10, default 3)'
        );
    }

    settings.markModified('automod');
    await settings.save();
    settingsCache.invalidate(guild.id);

    const spam = settings.automod.spam;
    return message.reply(
      `Spam settings updated.\n` +
      `Max **${spam.maxMessages ?? 5}** messages per **${spam.timeWindow ?? 5}s** → ` +
      `timeout after **${spam.violationThreshold ?? 3}** violations (**${spam.timeoutDuration ?? 10} min**).`
    );
  },

  async link(message, args, guild, settings) {
    const [action, domain] = args;

    if (!domain || !['allow', 'deny'].includes(action)) {
      return message.reply(
        'Usage:\n' +
        '`!automod link allow <domain>` - exempt a domain from the link filter\n' +
        '`!automod link deny <domain>` - remove a domain exemption\n\n' +
        'Example: `!automod link allow youtube.com`'
      );
    }

    const clean = domain.replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase();

    if (!settings.automod.allowedDomains) settings.automod.allowedDomains = [];

    if (action === 'allow') {
      if (settings.automod.allowedDomains.includes(clean)) {
        return message.reply(`\`${clean}\` is already in the allowed list.`);
      }
      settings.automod.allowedDomains.push(clean);
      settings.markModified('automod');
      await settings.save();
      settingsCache.invalidate(guild.id);
      return message.reply(`\`${clean}\` added to the link allowlist. Links from this domain will no longer be deleted.`);
    } else {
      const idx = settings.automod.allowedDomains.indexOf(clean);
      if (idx === -1) return message.reply(`\`${clean}\` is not in the allowed list.`);
      settings.automod.allowedDomains.splice(idx, 1);
      settings.markModified('automod');
      await settings.save();
      settingsCache.invalidate(guild.id);
      return message.reply(`\`${clean}\` removed from the link allowlist.`);
    }
  },

  async reactionspam(message, args, guild, settings) {
    const val = args[0]?.toLowerCase();
    if (!val || !['on', 'off'].includes(val)) {
      return message.reply('Usage: `!automod reactionspam <on|off>`');
    }

    settings.automod.antiReactionSpam = val === 'on';

    if (val === 'on' && (!settings.automod.level || settings.automod.level === 'off')) {
      settings.automod.level = 'minimal';
    }

    settings.markModified('automod');
    await settings.save();
    settingsCache.invalidate(guild.id);

    const status = settings.automod.antiReactionSpam ? 'enabled' : 'disabled';
    let reply = `Anti-reaction spam has been **${status}**.`;
    if (settings.automod.antiReactionSpam && settings.automod.level === 'minimal') {
      reply += ' Automod level set to `minimal` to activate it.';
    }
    return message.reply(reply);
  },

  async ghostping(message, args, guild, settings) {
    const val = args[0]?.toLowerCase();
    if (!val || !['on', 'off'].includes(val)) {
      return message.reply('Usage: `!automod ghostping <on|off>`');
    }

    settings.automod.ghostPing = val === 'on';
    settings.markModified('automod');
    await settings.save();
    settingsCache.invalidate(guild.id);

    const status = settings.automod.ghostPing ? 'enabled' : 'disabled';

    let reply = `Ghost ping detection has been **${status}**.`;
    if (settings.automod.ghostPing && settings.automod.level === 'off') {
      reply += '\n**Note:** Automod level is `off` - run `!automod level minimal` for this to take effect.';
    }
    return message.reply(reply);
  },

  async exempt(message, args, guild, settings) {
    const [type, action, target] = args;

    if (!type || !action || !target || !['role', 'channel'].includes(type) || !['add', 'remove'].includes(action)) {
      return message.reply(
        'Usage:\n' +
        '`!automod exempt role add <@role>` - exempt a role from all automod checks\n' +
        '`!automod exempt role remove <@role>` - remove role exemption\n' +
        '`!automod exempt channel add <#channel>` - disable automod in a channel\n' +
        '`!automod exempt channel remove <#channel>` - re-enable automod in a channel'
      );
    }

    if (type === 'role') {
      const roleId = parseRoleId(target);
      if (!roleId) return message.reply('Please provide a valid role mention or role ID.');

      if (!settings.automod.exemptRoles) settings.automod.exemptRoles = [];

      if (action === 'add') {
        if (settings.automod.exemptRoles.includes(roleId)) {
          return message.reply('That role is already exempt.');
        }
        settings.automod.exemptRoles.push(roleId);
        settings.markModified('automod');
        await settings.save();
        settingsCache.invalidate(guild.id);
        return message.reply(`Members with <@&${roleId}> are now exempt from automod.`);
      } else {
        const idx = settings.automod.exemptRoles.indexOf(roleId);
        if (idx === -1) return message.reply('That role is not in the exempt list.');
        settings.automod.exemptRoles.splice(idx, 1);
        settings.markModified('automod');
        await settings.save();
        settingsCache.invalidate(guild.id);
        return message.reply(`<@&${roleId}> is no longer exempt from automod.`);
      }
    }

    if (type === 'channel') {
      const channelId = parseChannelId(target);
      if (!channelId) return message.reply('Please provide a valid channel mention or channel ID.');

      if (!settings.automod.exemptChannels) settings.automod.exemptChannels = [];

      if (action === 'add') {
        if (settings.automod.exemptChannels.includes(channelId)) {
          return message.reply('That channel is already exempt.');
        }
        settings.automod.exemptChannels.push(channelId);
        settings.markModified('automod');
        await settings.save();
        settingsCache.invalidate(guild.id);
        return message.reply(`Automod is now disabled in <#${channelId}>.`);
      } else {
        const idx = settings.automod.exemptChannels.indexOf(channelId);
        if (idx === -1) return message.reply('That channel is not in the exempt list.');
        settings.automod.exemptChannels.splice(idx, 1);
        settings.markModified('automod');
        await settings.save();
        settingsCache.invalidate(guild.id);
        return message.reply(`Automod has been re-enabled in <#${channelId}>.`);
      }
    }
  }
};

function showHelp(message: any) {
  const embed = new EmbedBuilder()
    .setTitle('Automod - Subcommands')
    .setColor(0x5865F2)
    .addFields(
      {
        name: '!automod status',
        value: 'Show all current automod settings'
      },
      {
        name: '!automod level <off|minimal|medium|high>',
        value:
          '`off` - disable all\n' +
          '`minimal` - anti-spam only\n' +
          '`medium` - anti-spam + anti-link\n' +
          '`high` - anti-spam + anti-link, strict limits'
      },
      {
        name: '!automod spam <messages|window|timeout|violations> <value>',
        value:
          'Fine-tune spam detection:\n' +
          '`messages` 2–20 (default 5) · `window` 1–60 s (default 5)\n' +
          '`violations` 1–10 (default 3) · `timeout` 1–60 min (default 10)'
      },
      {
        name: '!automod link <allow|deny> <domain>',
        value: 'Manage domains exempt from the link filter\nExample: `!automod link allow youtube.com`'
      },
      {
        name: '!automod reactionspam <on|off>',
        value: 'Enable or disable anti-reaction spam detection'
      },
      {
        name: '!automod ghostping <on|off>',
        value: 'Enable or disable ghost-ping detection'
      },
      {
        name: '!automod exempt role <add|remove> <@role>',
        value: 'Exempt a role from all automod checks'
      },
      {
        name: '!automod exempt channel <add|remove> <#channel>',
        value: 'Disable automod in a specific channel'
      }
    )
    .setFooter({ text: 'Requires Manage Server permission' });

  return message.reply({ embeds: [embed] });
}

const command: Command = {
  name: 'automod',
  description: [
    'Configure every aspect of automod for your server. Run `!automod` with no arguments to see the full subcommand guide.',
    '',
    '**Subcommands:**',
    '`status` - show all current automod settings',
    '`level <off|minimal|medium|high>` - set the overall automod preset',
    '`spam <messages|window|violations|timeout> <value>` - tune spam detection thresholds',
    '`link <allow|deny> <domain>` - manage the link filter domain allowlist',
    '`ghostping <on|off>` - enable or disable ghost ping detection',
    '`exempt role <add|remove> <@role>` - give a role full automod immunity',
    '`exempt channel <add|remove> <#channel>` - disable automod in a specific channel',
  ].join('\n'),
  usage: '<subcommand> [args...]',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client) {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply('This command can only be used in a server.');

    try {
      const sub = args[0]?.toLowerCase();

      if (!sub || !subcommands[sub]) {
        return showHelp(message);
      }

      const settings: any = await GuildSettings.getOrCreate(guild.id);
      if (!settings.automod) settings.automod = {};

      await subcommands[sub](message, args.slice(1), guild, settings);

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !automod (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !automod: ${error.message || error}`);
        message.reply('There was an error executing this command.').catch(() => {});
      }
    }
  }
};

export default command;
