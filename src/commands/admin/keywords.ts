import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';

const MAX_KEYWORDS = 50;

async function getSettings(guildId: string): Promise<any> {
  return GuildSettings.getOrCreate(guildId);
}

async function invalidate(guildId: string): Promise<void> {
  settingsCache.invalidate(guildId);
}


async function showList(message: any, guild: any, prefix = '!') {
  const settings = await getSettings(guild.id);
  const kw = settings.keywordWarnings;
  const keywords = kw?.keywords || [];

  const statusLine = kw?.enabled ? '**Enabled**' : '**Disabled**';
  const actionLine = `Action: \`${kw?.action || 'delete+warn'}\``;

  if (!keywords.length) {
    return message.reply(
      `**Keyword System** - ${statusLine} | ${actionLine}\n\nNo keywords configured. Use \`${prefix}keywords add <word>\` to add one.`
    );
  }

  const list = keywords.map((k: any, i: number) => {
    const tag = k.isRegex ? '`regex`' : '`plain`';
    const lbl = k.label ? ` *(${k.label})*` : '';
    return `**${i + 1}.** ${tag} \`${k.pattern}\`${lbl}`;
  }).join('\n');

  return message.reply(
    `**Keyword System** - ${statusLine} | ${actionLine}\n\n${list}\n\n` +
    `${keywords.length}/${MAX_KEYWORDS} keywords used.`
  );
}

async function setEnabled(message: any, guild: any, enabled: boolean) {
  const settings = await getSettings(guild.id);
  settings.keywordWarnings.enabled = enabled;
  await settings.save();
  await invalidate(guild.id);
  return message.reply(`Keyword warning system **${enabled ? 'enabled' : 'disabled'}**.`);
}

async function addKeyword(message: any, guild: any, args: string[], prefix = '!') {
  if (!args.length) {
    return message.reply(
      'Usage:\n' +
      `\`${prefix}keywords add <word>\` - plain match\n` +
      `\`${prefix}keywords add regex <pattern>\` - regex match`
    );
  }

  let isRegex = false;
  let pattern: string;

  if (args[0]?.toLowerCase() === 'regex') {
    isRegex = true;
    pattern = args.slice(1).join(' ').trim();
    if (!pattern) return message.reply('Please provide a regex pattern after `regex`.');

    try {
      new RegExp(pattern, 'i');
    } catch (e: any) {
      return message.reply(`Invalid regex pattern: \`${e.message}\``);
    }

    const { isSafeRegex } = await import('../../utils/safeRegex');
    const check = isSafeRegex(pattern);
    if (!check.safe) {
      return message.reply(`Regex rejected: ${check.reason} Simplify it or use a plain keyword instead.`);
    }
  } else {
    pattern = args.join(' ').trim();
  }

  const settings = await getSettings(guild.id);
  if (!settings.keywordWarnings) settings.keywordWarnings = {};
  if (!settings.keywordWarnings.keywords) settings.keywordWarnings.keywords = [];

  if (settings.keywordWarnings.keywords.length >= MAX_KEYWORDS) {
    return message.reply(`Maximum of ${MAX_KEYWORDS} keywords reached. Remove one first.`);
  }

  const duplicate = settings.keywordWarnings.keywords.find((k: any) => k.pattern === pattern && k.isRegex === isRegex);
  if (duplicate) return message.reply('That pattern is already in the list.');

  settings.keywordWarnings.keywords.push({ pattern, isRegex, addedBy: message.author.id });
  settings.markModified('keywordWarnings');
  await settings.save();
  await invalidate(guild.id);

  const tag = isRegex ? 'regex pattern' : 'keyword';
  return message.reply(`Added ${tag}: \`${pattern}\`\n\nDon't forget to \`${prefix}keywords enable\` if the system is off.`);
}

async function removeKeyword(message: any, guild: any, numArg: string, prefix = '!') {
  const num = parseInt(numArg, 10);
  const settings = await getSettings(guild.id);
  const keywords = settings.keywordWarnings?.keywords || [];

  if (isNaN(num) || num < 1 || num > keywords.length) {
    return message.reply(`Please give a valid number (1–${keywords.length}). Use \`${prefix}keywords list\` to see numbers.`);
  }

  const removed = keywords.splice(num - 1, 1)[0];
  settings.markModified('keywordWarnings');
  await settings.save();
  await invalidate(guild.id);

  return message.reply(`Removed keyword #${num}: \`${removed.pattern}\``);
}

async function setAction(message: any, guild: any, action: string) {
  const valid = ['warn', 'delete', 'delete+warn'];
  if (!action || !valid.includes(action.toLowerCase())) {
    return message.reply(`Valid actions: \`warn\`, \`delete\`, \`delete+warn\``);
  }

  const settings = await getSettings(guild.id);
  settings.keywordWarnings.action = action.toLowerCase();
  settings.markModified('keywordWarnings');
  await settings.save();
  await invalidate(guild.id);

  const descriptions: Record<string, string> = {
    'warn':        'Issue a warning but leave the message.',
    'delete':      'Silently delete the message, no warning.',
    'delete+warn': 'Delete the message and issue a warning.'
  };

  return message.reply(`Action set to \`${action}\` - ${descriptions[action.toLowerCase()]}`);
}

async function testKeywords(message: any, guild: any, text: string, prefix = '!') {
  if (!text) return message.reply(`Provide some text to test: \`${prefix}keywords test <your text here>\``);

  const settings = await getSettings(guild.id);
  const keywords = settings.keywordWarnings?.keywords || [];
  if (!keywords.length) return message.reply('No keywords configured yet.');

  const hits = keywords
    .map((k: any, i: number) => {
      let matched = false;
      if (k.isRegex) {
        try { matched = new RegExp(k.pattern, 'i').test(text); } catch {}
      } else {
        matched = text.toLowerCase().includes(k.pattern.toLowerCase());
      }
      return matched ? `**${i + 1}.** \`${k.pattern}\`` : null;
    })
    .filter(Boolean);

  if (!hits.length) {
    return message.reply(`No keywords matched: \`${text.slice(0, 100)}\``);
  }
  return message.reply(`**Matched ${hits.length} keyword(s):**\n${hits.join('\n')}`);
}

const command: Command = {
  name: 'keywords',
  description: [
    'Manage the keyword auto-warning system. When a message matches a keyword the bot can delete it, warn the member, or both.',
    '',
    '**Subcommands:**',
    '`list` - show all keywords',
    '`add <word>` - add a plain word/phrase (case-insensitive substring match)',
    '`add regex <pattern>` - add a regular expression pattern',
    '`remove <number>` - remove a keyword by its list number',
    '`enable` / `disable` - turn the system on or off',
    '`action <warn|delete|delete+warn>` - set the action taken on a match',
    '`test <text>` - test whether a string would be caught',
  ].join('\n'),
  usage: '<subcommand> [args...]',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, _client, prefix = '!') {
    const guild = (message as any).guild;
    if (!guild) return void await message.reply('This command can only be used in a server.');

    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'list') return showList(message, guild, prefix);

    if (sub === 'enable')  return setEnabled(message, guild, true);
    if (sub === 'disable') return setEnabled(message, guild, false);

    if (sub === 'add')    return addKeyword(message, guild, args.slice(1), prefix);
    if (sub === 'remove') return removeKeyword(message, guild, args[1], prefix);
    if (sub === 'action') return setAction(message, guild, args[1]);
    if (sub === 'test')   return testKeywords(message, guild, args.slice(1).join(' '), prefix);

    return void await message.reply(`Unknown subcommand. Use \`${prefix}keywords\` to see all options.`);
  }
};

export default command;
