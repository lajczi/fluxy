import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { t, normalizeLocale } from '../../i18n';

const command: Command = {
  name: 'setstaff',
  description: [
    'Configure the staff report system.',
    '',
    '**Subcommands:**',
    '`channel <#channel>` this will set the channel where `!report` submissions are posted',
    '`channel clear` this will remove the staff output channel',
    '`role <@role>`this will set the role pinged on every new report',
    '`role clear` removes the role ping',
    '`reportchannel <#channel>` used to set a dedicated inbox channel: any message sent there is silently deleted and forwarded to staff (no command needed)',
    '`reportchannel clear` removes the inbox channel',
    '`status` shows the current configuration',
  ].join('\n'),
  usage: '<channel|role|reportchannel|status> [value|clear]',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void (await message.reply(t('en', 'commands.admin.setstaff.serverOnly')));

    const sub = args[0]?.toLowerCase();

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      const lang = normalizeLocale(settings?.language);

      if (!sub || sub === 'status') {
        const ch = settings.staffChannelId ? `<#${settings.staffChannelId}>` : 'Not set';
        const inbox = settings.staffInboxChannelId ? `<#${settings.staffInboxChannelId}>` : 'Not set';
        const role = settings.staffRoleId ? `<@&${settings.staffRoleId}>` : 'Not set';
        return void (await message.reply(t(lang, 'commands.admin.setstaff.status', { ch, inbox, role })));
      }

      if (sub === 'channel') {
        const val = args[1];
        if (!val) return void (await message.reply(t(lang, 'commands.admin.setstaff.channelUsage', { prefix })));

        if (val.toLowerCase() === 'clear') {
          settings.staffChannelId = null;
          await settings.save();
          settingsCache.invalidate(guild.id);
          return void (await message.reply(t(lang, 'commands.admin.setstaff.channelCleared')));
        }

        const channelId = val.match(/^<#(\d{17,19})>$/)?.[1] ?? (/^\d{17,19}$/.test(val) ? val : null);
        if (!channelId) return void (await message.reply(t(lang, 'commands.admin.setstaff.channelInvalid')));

        settings.staffChannelId = channelId;
        await settings.save();
        settingsCache.invalidate(guild.id);
        return void (await message.reply(t(lang, 'commands.admin.setstaff.channelSetDone', { channelId, prefix })));
      }

      if (sub === 'role') {
        const val = args[1];
        if (!val) return void (await message.reply(t(lang, 'commands.admin.setstaff.roleUsage', { prefix })));

        if (val.toLowerCase() === 'clear') {
          settings.staffRoleId = null;
          await settings.save();
          settingsCache.invalidate(guild.id);
          return void (await message.reply(t(lang, 'commands.admin.setstaff.roleCleared')));
        }

        const roleId = val.match(/^<@&(\d{17,19})>$/)?.[1] ?? (/^\d{17,19}$/.test(val) ? val : null);
        if (!roleId) return void (await message.reply(t(lang, 'commands.admin.setstaff.roleInvalid')));

        settings.staffRoleId = roleId;
        await settings.save();
        settingsCache.invalidate(guild.id);
        return void (await message.reply(t(lang, 'commands.admin.setstaff.roleSetDone', { roleId })));
      }

      if (sub === 'reportchannel') {
        const val = args[1];
        if (!val) return void (await message.reply(t(lang, 'commands.admin.setstaff.reportChannelUsage', { prefix })));

        if (val.toLowerCase() === 'clear') {
          settings.staffInboxChannelId = null;
          await settings.save();
          settingsCache.invalidate(guild.id);
          return void (await message.reply(t(lang, 'commands.admin.setstaff.reportChannelCleared')));
        }

        const channelId = val.match(/^<#(\d{17,19})>$/)?.[1] ?? (/^\d{17,19}$/.test(val) ? val : null);
        if (!channelId) return void (await message.reply(t(lang, 'commands.admin.setstaff.reportChannelInvalid')));

        settings.staffInboxChannelId = channelId;
        await settings.save();
        settingsCache.invalidate(guild.id);
        return void (await message.reply(t(lang, 'commands.admin.setstaff.reportChannelSetDone', { channelId })));
      }

      return void (await message.reply(t(lang, 'commands.admin.setstaff.unknownSubcommand', { prefix })));
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !setstaff (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !setstaff: ${error.message || error}`);
        const cached: any = await settingsCache.get(guild.id).catch(() => null);
        const lang = normalizeLocale(cached?.language);
        message.reply(t(lang, 'commands.admin.setstaff.errors.generic')).catch(() => {});
      }
    }
  },
};

export default command;
