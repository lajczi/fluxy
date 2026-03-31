import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import { t, normalizeLocale } from '../../i18n';

const MAX_KEYWORDS = 50;

async function getSettings(guildId: string): Promise<any> {
  return GuildSettings.getOrCreate(guildId);
}

async function invalidate(guildId: string): Promise<void> {
  settingsCache.invalidate(guildId);
}


async function showList(message: any, guild: any, prefix = '!') {
  const settings = await getSettings(guild.id);
  const lang = normalizeLocale(settings?.language);
  const kw = settings.keywordWarnings;
  const keywords = kw?.keywords || [];

  const statusLine = kw?.enabled
    ? t(lang, 'commands.admin.keywords.statusEnabled')
    : t(lang, 'commands.admin.keywords.statusDisabled');
  const actionLine = t(lang, 'commands.admin.keywords.actionLine', { action: kw?.action || 'delete+warn' });

  if (!keywords.length) {
    return message.reply(
      t(lang, 'commands.admin.keywords.showListEmpty', { statusLine, actionLine, prefix })
    );
  }

  const list = keywords.map((k: any, i: number) => {
    const tag = k.isRegex ? '`regex`' : '`plain`';
    const lbl = k.label ? ` *(${k.label})*` : '';
    return `**${i + 1}.** ${tag} \`${k.pattern}\`${lbl}`;
  }).join('\n');

  return message.reply(
    t(lang, 'commands.admin.keywords.showList', {
      statusLine,
      actionLine,
      list,
      usedCount: keywords.length,
      max: MAX_KEYWORDS
    })
  );
}

async function setEnabled(message: any, guild: any, enabled: boolean) {
  const settings = await getSettings(guild.id);
  const lang = normalizeLocale(settings?.language);
  settings.keywordWarnings.enabled = enabled;
  await settings.save();
  await invalidate(guild.id);
  return message.reply(
    enabled
      ? t(lang, 'commands.admin.keywords.setEnabledEnabled')
      : t(lang, 'commands.admin.keywords.setEnabledDisabled')
  );
}

async function addKeyword(message: any, guild: any, args: string[], prefix = '!') {
  const settings = await getSettings(guild.id);
  const lang = normalizeLocale(settings?.language);

  if (!args.length) {
    return message.reply(t(lang, 'commands.admin.keywords.addUsage', { prefix }));
  }

  let isRegex = false;
  let pattern: string;

  if (args[0]?.toLowerCase() === 'regex') {
    isRegex = true;
    pattern = args.slice(1).join(' ').trim();
    if (!pattern) return message.reply(t(lang, 'commands.admin.keywords.regexPatternRequired'));

    try {
      new RegExp(pattern, 'i');
    } catch (e: any) {
      return message.reply(t(lang, 'commands.admin.keywords.invalidRegexPattern', { error: e.message }));
    }

    const { isSafeRegex } = await import('../../utils/safeRegex');
    const check = isSafeRegex(pattern);
    if (!check.safe) {
      return message.reply(t(lang, 'commands.admin.keywords.regexRejected', { reason: check.reason }));
    }
  } else {
    pattern = args.join(' ').trim();
  }

  if (!settings.keywordWarnings) settings.keywordWarnings = {};
  if (!settings.keywordWarnings.keywords) settings.keywordWarnings.keywords = [];

  if (settings.keywordWarnings.keywords.length >= MAX_KEYWORDS) {
    return message.reply(t(lang, 'commands.admin.keywords.maxKeywordsReached', { max: MAX_KEYWORDS }));
  }

  const duplicate = settings.keywordWarnings.keywords.find((k: any) => k.pattern === pattern && k.isRegex === isRegex);
  if (duplicate) return message.reply(t(lang, 'commands.admin.keywords.duplicatePattern'));

  settings.keywordWarnings.keywords.push({ pattern, isRegex, addedBy: message.author.id });
  settings.markModified('keywordWarnings');
  await settings.save();
  await invalidate(guild.id);

  const tag = isRegex
    ? t(lang, 'commands.admin.keywords.tagRegexPattern')
    : t(lang, 'commands.admin.keywords.tagKeyword');
  return message.reply(
    t(lang, 'commands.admin.keywords.added', {
      tag,
      pattern,
      prefix
    })
  );
}

async function removeKeyword(message: any, guild: any, numArg: string, prefix = '!') {
  const num = parseInt(numArg, 10);
  const settings = await getSettings(guild.id);
  const lang = normalizeLocale(settings?.language);
  const keywords = settings.keywordWarnings?.keywords || [];

  if (isNaN(num) || num < 1 || num > keywords.length) {
    return message.reply(t(lang, 'commands.admin.keywords.removeInvalidNumber', { max: keywords.length, prefix }));
  }

  const removed = keywords.splice(num - 1, 1)[0];
  settings.markModified('keywordWarnings');
  await settings.save();
  await invalidate(guild.id);

  return message.reply(t(lang, 'commands.admin.keywords.removed', { num, pattern: removed.pattern }));
}

async function setAction(message: any, guild: any, action: string) {
  const valid = ['warn', 'delete', 'delete+warn'];
  if (!action || !valid.includes(action.toLowerCase())) {
    return message.reply(t('en', 'commands.admin.keywords.validActions'));
  }

  const settings = await getSettings(guild.id);
  const lang = normalizeLocale(settings?.language);
  const actionLower = action.toLowerCase();
  settings.keywordWarnings.action = actionLower;
  settings.markModified('keywordWarnings');
  await settings.save();
  await invalidate(guild.id);

  const descriptions: Record<string, string> = {
    warn: t(lang, 'commands.admin.keywords.actionWarn'),
    delete: t(lang, 'commands.admin.keywords.actionDelete'),
    'delete+warn': t(lang, 'commands.admin.keywords.actionDeleteWarn')
  };

  return message.reply(
    t(lang, 'commands.admin.keywords.actionSetDone', {
      action: actionLower,
      description: descriptions[actionLower]
    })
  );
}

async function testKeywords(message: any, guild: any, text: string, prefix = '!') {
  const settings = await getSettings(guild.id);
  const lang = normalizeLocale(settings?.language);
  if (!text) return message.reply(t(lang, 'commands.admin.keywords.testMissingText', { prefix }));
  const keywords = settings.keywordWarnings?.keywords || [];
  if (!keywords.length) return message.reply(t(lang, 'commands.admin.keywords.noKeywordsConfigured'));

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
    const preview = text.slice(0, 100);
    return message.reply(t(lang, 'commands.admin.keywords.noKeywordsMatched', { preview }));
  }
  return message.reply(
    t(lang, 'commands.admin.keywords.testMatches', { hitsCount: hits.length, hits: hits.join('\n') })
  );
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
    if (!guild) return void await message.reply(t('en', 'commands.admin.keywords.serverOnly'));

    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'list') return showList(message, guild, prefix);

    if (sub === 'enable')  return setEnabled(message, guild, true);
    if (sub === 'disable') return setEnabled(message, guild, false);

    if (sub === 'add')    return addKeyword(message, guild, args.slice(1), prefix);
    if (sub === 'remove') return removeKeyword(message, guild, args[1], prefix);
    if (sub === 'action') return setAction(message, guild, args[1]);
    if (sub === 'test')   return testKeywords(message, guild, args.slice(1).join(' '), prefix);

    return void await message.reply(t('en', 'commands.admin.keywords.unknownSubcommand', { prefix }));
  }
};

export default command;
