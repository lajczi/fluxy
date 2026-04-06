import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import { listLocales, normalizeLocale } from '../../i18n';
import { t } from '../../i18n';

async function save(settings: any, guildId: string): Promise<void> {
  settings.markModified('language');
  await settings.save();
  settingsCache.invalidate(guildId);
}

const command: Command = {
  name: 'language',
  description: 'Set the language used for bot messages in this server.',
  usage: '<set|list> [code]',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void (await message.reply(t('en', 'verification.errors.serverOnly')));

    const settings: any = await GuildSettings.getOrCreate(guild.id);
    const sub = args[0]?.toLowerCase();
    const available = listLocales().join(', ');

    if (!sub || sub === 'help') {
      const cur = normalizeLocale(settings.language);
      return void (await message.reply(
        t(cur, 'language.current', { language: cur }) + '\n' + t(cur, 'language.usage', { prefix }),
      ));
    }

    if (sub === 'list') {
      const cur = normalizeLocale(settings.language);
      return void (await message.reply(t(cur, 'language.available', { available })));
    }

    if (sub === 'set') {
      const code = (args[1] || '').trim().toLowerCase();
      const cur = normalizeLocale(settings.language);
      if (!code) return void (await message.reply(t(cur, 'language.usage', { prefix })));
      const normalized = normalizeLocale(code);
      if (!listLocales().includes(normalized as any)) {
        return void (await message.reply(t(cur, 'language.invalid', { language: code, available })));
      }
      settings.language = normalized;
      await save(settings, guild.id);
      return void (await message.reply(t(normalized, 'language.set', { language: normalized })));
    }

    const cur = normalizeLocale(settings.language);
    return void (await message.reply(t(cur, 'language.usage', { prefix })));
  },
};

export default command;
