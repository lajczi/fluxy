import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';

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
    if (!guild) return void await message.reply('This command can only be used in a server.');

    const sub = args[0]?.toLowerCase();

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);

      if (!sub || sub === 'status') {
        const ch    = settings.staffChannelId      ? `<#${settings.staffChannelId}>`      : 'Not set';
        const inbox = settings.staffInboxChannelId ? `<#${settings.staffInboxChannelId}>` : 'Not set';
        const role  = settings.staffRoleId         ? `<@&${settings.staffRoleId}>`        : 'Not set';
        return void await message.reply(
          `**Staff Report Configuration**\n` +
          `Output channel: ${ch}\n` +
          `Report inbox channel: ${inbox}\n` +
          `Staff role ping: ${role}\n\n` +
          `**Tips:**\n` +
          `- In the inbox channel, set \`Read Message History\` to off for \`@everyone\` so members cannot read past messages\n` +
          `- Members can still type in it - the bot deletes messages instantly and forwards them to staff`
        );
      }

      if (sub === 'channel') {
        const val = args[1];
        if (!val) return void await message.reply(`Usage: \`${prefix}setstaff channel <#channel>\` or \`${prefix}setstaff channel clear\``);

        if (val.toLowerCase() === 'clear') {
          settings.staffChannelId = null;
          await settings.save();
          settingsCache.invalidate(guild.id);
          return void await message.reply('Staff output channel has been cleared.');
        }

        const channelId = val.match(/^<#(\d{17,19})>$/)?.[1] ?? (/^\d{17,19}$/.test(val) ? val : null);
        if (!channelId) return void await message.reply('Please mention a valid channel or provide a channel ID.');

        settings.staffChannelId = channelId;
        await settings.save();
        settingsCache.invalidate(guild.id);
        return void await message.reply(`Staff output channel set to <#${channelId}>. Reports from \`${prefix}report\` and the inbox channel will be forwarded there.`);
      }

      if (sub === 'role') {
        const val = args[1];
        if (!val) return void await message.reply(`Usage: \`${prefix}setstaff role <@role>\` or \`${prefix}setstaff role clear\``);

        if (val.toLowerCase() === 'clear') {
          settings.staffRoleId = null;
          await settings.save();
          settingsCache.invalidate(guild.id);
          return void await message.reply('Staff role ping has been cleared. Reports will still be posted but no role will be pinged.');
        }

        const roleId = val.match(/^<@&(\d{17,19})>$/)?.[1] ?? (/^\d{17,19}$/.test(val) ? val : null);
        if (!roleId) return void await message.reply('Please mention a valid role or provide a role ID.');

        settings.staffRoleId = roleId;
        await settings.save();
        settingsCache.invalidate(guild.id);
        return void await message.reply(`Staff role set to <@&${roleId}>. They will be pinged on every new report.`);
      }

      if (sub === 'reportchannel') {
        const val = args[1];
        if (!val) return void await message.reply(`Usage: \`${prefix}setstaff reportchannel <#channel>\` or \`${prefix}setstaff reportchannel clear\``);

        if (val.toLowerCase() === 'clear') {
          settings.staffInboxChannelId = null;
          await settings.save();
          settingsCache.invalidate(guild.id);
          return void await message.reply('Report inbox channel has been cleared. The bot will no longer monitor that channel.');
        }

        const channelId = val.match(/^<#(\d{17,19})>$/)?.[1] ?? (/^\d{17,19}$/.test(val) ? val : null);
        if (!channelId) return void await message.reply('Please mention a valid channel or provide a channel ID.');

        settings.staffInboxChannelId = channelId;
        await settings.save();
        settingsCache.invalidate(guild.id);
        return void await message.reply(
          `Report inbox channel set to <#${channelId}>.\n` +
          `Any message sent there will be silently deleted and forwarded to the staff output channel.\n\n` +
          `**Recommended channel permissions for <#${channelId}>:**\n` +
          `- \`@everyone\`: Send Messages = on, Read Message History = **off**, View Channel = on\n` +
          `- Staff role: all permissions as normal\n` +
          `This way members can submit a report but cannot read what others have sent.`
        );
      }

      return void await message.reply(`Unknown subcommand. Use \`${prefix}setstaff status\`, \`${prefix}setstaff channel\`, \`${prefix}setstaff role\`, or \`${prefix}setstaff reportchannel\`.`);

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !setstaff (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !setstaff: ${error.message || error}`);
        message.reply('An error occurred while updating staff settings.').catch(() => {});
      }
    }
  }
};

export default command;
