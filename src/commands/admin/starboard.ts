import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import StarboardMessage from '../../models/StarboardMessage';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { EmbedBuilder, PermissionFlags } from '@fluxerjs/core';
import { t, normalizeLocale } from '../../i18n';

function getStarEmoji(count: number): string {
  if (count >= 25) return '💫';
  if (count >= 10) return '🌟';
  return '⭐';
}

function getStarColor(count: number): number {
  if (count >= 25) return 0xe74c3c;
  if (count >= 10) return 0xe67e22;
  return 0xf1c40f;
}

async function isStarboardAdmin(message: any, guild: any): Promise<boolean> {
  let member = guild.members?.get(message.author.id);
  if (!member) {
    try { member = await guild.fetchMember(message.author.id); } catch {}
  }
  if (!member) return false;
  return Boolean(
    member.permissions?.has(PermissionFlags.ManageGuild) ||
    member.permissions?.has(PermissionFlags.Administrator)
  );
}

const command: Command = {
  name: 'starboard',
  description: [
    'Configure the starboard system for your server.',
    'Subcommands: setup, threshold, emoji, toggle, selfstar, ignorechannel, ignorerole, settings, leaderboard, top, stats, force, remove',
  ],
  usage: '<subcommand> [args]',
  category: 'info',
  aliases: ['sb'],
  permissions: [],
  cooldown: 3,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await message.reply(t('en', 'commands.admin.starboard.serverOnly'));

    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'help') {
      const usageStr = `\`${prefix}starboard <subcommand> [args]\``;
      const publicSubs = [
        `\`${prefix}starboard leaderboard\``,
        `\`${prefix}starboard top\``,
        `\`${prefix}starboard stats\``,
      ];
      const adminSubs = [
        `\`${prefix}starboard setup #channel\``,
        `\`${prefix}starboard threshold <1-100>\``,
        `\`${prefix}starboard emoji <emoji>\``,
        `\`${prefix}starboard toggle\``,
        `\`${prefix}starboard selfstar\``,
        `\`${prefix}starboard ignorechannel #channel\``,
        `\`${prefix}starboard ignorerole @role\``,
        `\`${prefix}starboard settings\``,
        `\`${prefix}starboard force <messageLink|messageId> [channelId]\``,
        `\`${prefix}starboard remove <messageId>\``,
      ];

      const embed = new EmbedBuilder()
        .setTitle(t('en', 'commands.admin.starboard.help.title'))
        .setColor(0xf1c40f)
        .setDescription(t('en', 'commands.admin.starboard.help.description'))
        .addFields(
          { name: t('en', 'commands.admin.starboard.help.fieldUsage'), value: usageStr, inline: false },
          { name: t('en', 'commands.admin.starboard.help.fieldAliases'), value: '`sb`', inline: true },
          { name: t('en', 'commands.admin.starboard.help.fieldCooldown'), value: '3s', inline: true },
          { name: t('en', 'commands.admin.starboard.help.fieldPublic'), value: publicSubs.join('\n'), inline: false },
          { name: t('en', 'commands.admin.starboard.help.fieldAdmin'), value: adminSubs.join('\n'), inline: false },
        )
        .setTimestamp(new Date());
      return void await message.reply({ embeds: [embed] });
    }

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      const lang = normalizeLocale(settings?.language);
      const needsAdmin = ![
        'leaderboard',
        'lb',
        'top',
        'topusers',
        'stats',
      ].includes(sub);

      if (needsAdmin) {
        const ok = await isStarboardAdmin(message, guild);
        if (!ok) {
          return void await message.reply(t(lang, 'commands.admin.starboard.adminRequired'));
        }
      }

      switch (sub) {
        case 'setup':
        case 'setchannel':
        case 'channel': {
          if (!args[1]) return void await message.reply(t(lang, 'commands.admin.starboard.setup.usage', { prefix }));

          const channelMention = args[1].match(/^<#(\d{17,19})>$/);
          let channelId: string;
          if (channelMention) channelId = channelMention[1];
          else if (/^\d{17,19}$/.test(args[1])) channelId = args[1];
          else return void await message.reply(t(lang, 'commands.admin.starboard.setup.invalidChannel'));

          let channel: any = guild.channels?.get(channelId);
          if (!channel) {
            try { channel = await client.channels.fetch(channelId); } catch {
              return void await message.reply(t(lang, 'commands.admin.starboard.setup.channelDoesNotExist'));
            }
          }
          if (!channel) return void await message.reply(t(lang, 'commands.admin.starboard.setup.channelDoesNotExist'));

          if (!settings.starboard) settings.starboard = {};
          settings.starboard.channelId = channelId;
          settings.starboard.enabled = true;
          settings.markModified('starboard');
          await settings.save();
          settingsCache.invalidate(guild.id);

          const embed = new EmbedBuilder()
            .setTitle(t(lang, 'commands.admin.starboard.setup.title'))
            .setDescription(t(lang, 'commands.admin.starboard.setup.description', { channelId }))
            .setColor(0xf1c40f)
            .addFields(
              { name: t(lang, 'commands.admin.starboard.setup.fieldThreshold'), value: t(lang, 'commands.admin.starboard.setup.thresholdReactions', { threshold: settings.starboard.threshold ?? 3 }), inline: true },
              { name: t(lang, 'commands.admin.starboard.setup.fieldEmoji'), value: settings.starboard.emoji ?? '⭐', inline: true },
            )
            .setTimestamp(new Date());
          return void await message.reply({ embeds: [embed] });
        }

        case 'threshold': {
          const num = parseInt(args[1], 10);
          if (!args[1] || isNaN(num) || num < 1 || num > 100) {
            return void await message.reply(t(lang, 'commands.admin.starboard.threshold.usage', { prefix, current: settings.starboard?.threshold ?? 3 }));
          }
          if (!settings.starboard) settings.starboard = {};
          settings.starboard.threshold = num;
          settings.markModified('starboard');
          await settings.save();
          settingsCache.invalidate(guild.id);
          return void await message.reply(t(lang, 'commands.admin.starboard.threshold.setDone', { threshold: num }));
        }

        case 'emoji': {
          if (!args[1]) {
            return void await message.reply(t(lang, 'commands.admin.starboard.emoji.usage', { prefix, currentEmoji: settings.starboard?.emoji ?? '⭐' }));
          }
          const rawEmoji = args[1].trim();
          if (!settings.starboard) settings.starboard = {};
          settings.starboard.emoji = rawEmoji;
          settings.markModified('starboard');
          await settings.save();
          settingsCache.invalidate(guild.id);
          return void await message.reply(t(lang, 'commands.admin.starboard.emoji.setDone', { emoji: rawEmoji }));
        }

        case 'toggle':
        case 'enable':
        case 'disable': {
          if (!settings.starboard) settings.starboard = {};
          if (sub === 'enable') {
            settings.starboard.enabled = true;
          } else if (sub === 'disable') {
            settings.starboard.enabled = false;
          } else {
            settings.starboard.enabled = !settings.starboard.enabled;
          }
          settings.markModified('starboard');
          await settings.save();
          settingsCache.invalidate(guild.id);
          return void await message.reply(t(lang, 'commands.admin.starboard.toggle.setDone', { status: settings.starboard.enabled ? 'enabled' : 'disabled' }));
        }

        case 'selfstar': {
          if (!settings.starboard) settings.starboard = {};
          settings.starboard.selfStarEnabled = !settings.starboard.selfStarEnabled;
          settings.markModified('starboard');
          await settings.save();
          settingsCache.invalidate(guild.id);
          return void await message.reply(t(lang, 'commands.admin.starboard.selfstar.setDone', { status: settings.starboard.selfStarEnabled ? 'enabled' : 'disabled' }));
        }

        case 'ignorechannel': {
          if (!args[1]) return void await message.reply(t(lang, 'commands.admin.starboard.ignorechannel.usage', { prefix }));
          const channelMention = args[1].match(/^<#(\d{17,19})>$/);
          let channelId: string;
          if (channelMention) channelId = channelMention[1];
          else if (/^\d{17,19}$/.test(args[1])) channelId = args[1];
          else return void await message.reply(t(lang, 'commands.admin.starboard.ignorechannel.invalidChannel'));

          if (!settings.starboard) settings.starboard = {};
          if (!settings.starboard.ignoredChannels) settings.starboard.ignoredChannels = [];

          const idx = settings.starboard.ignoredChannels.indexOf(channelId);
          if (idx === -1) {
            settings.starboard.ignoredChannels.push(channelId);
            settings.markModified('starboard');
            await settings.save();
            settingsCache.invalidate(guild.id);
            return void await message.reply(t(lang, 'commands.admin.starboard.ignorechannel.nowIgnored', { channelId }));
          } else {
            settings.starboard.ignoredChannels.splice(idx, 1);
            settings.markModified('starboard');
            await settings.save();
            settingsCache.invalidate(guild.id);
            return void await message.reply(t(lang, 'commands.admin.starboard.ignorechannel.noLongerIgnored', { channelId }));
          }
        }

        case 'ignorerole': {
          if (!args[1]) return void await message.reply(t(lang, 'commands.admin.starboard.ignorerole.usage', { prefix }));
          const roleMention = args[1].match(/^<@&(\d{17,19})>$/);
          let roleId: string;
          if (roleMention) roleId = roleMention[1];
          else if (/^\d{17,19}$/.test(args[1])) roleId = args[1];
          else return void await message.reply(t(lang, 'commands.admin.starboard.ignorerole.invalidRole'));

          if (!settings.starboard) settings.starboard = {};
          if (!settings.starboard.ignoredRoles) settings.starboard.ignoredRoles = [];

          const idx = settings.starboard.ignoredRoles.indexOf(roleId);
          if (idx === -1) {
            settings.starboard.ignoredRoles.push(roleId);
            settings.markModified('starboard');
            await settings.save();
            settingsCache.invalidate(guild.id);
            return void await message.reply(t(lang, 'commands.admin.starboard.ignorerole.nowExcluded', { roleId }));
          } else {
            settings.starboard.ignoredRoles.splice(idx, 1);
            settings.markModified('starboard');
            await settings.save();
            settingsCache.invalidate(guild.id);
            return void await message.reply(t(lang, 'commands.admin.starboard.ignorerole.canStarAgain', { roleId }));
          }
        }

        case 'settings':
        case 'config':
        case 'info': {
          const sb = settings.starboard || {};
          const embed = new EmbedBuilder()
            .setTitle(t(lang, 'commands.admin.starboard.settings.title'))
            .setColor(0xf1c40f)
            .addFields(
              { name: t(lang, 'commands.admin.starboard.settings.status'), value: sb.enabled ? t(lang, 'commands.admin.starboard.settings.enabled') : t(lang, 'commands.admin.starboard.settings.disabled'), inline: true },
              { name: t(lang, 'commands.admin.starboard.settings.channel'), value: sb.channelId ? `<#${sb.channelId}>` : t(lang, 'commands.admin.starboard.settings.notSet'), inline: true },
              { name: t(lang, 'commands.admin.starboard.settings.threshold'), value: t(lang, 'commands.admin.starboard.settings.thresholdReactions', { threshold: sb.threshold ?? 3 }), inline: true },
              { name: t(lang, 'commands.admin.starboard.settings.emoji'), value: sb.emoji ?? '⭐', inline: true },
              { name: t(lang, 'commands.admin.starboard.settings.selfStar'), value: sb.selfStarEnabled ? t(lang, 'commands.admin.starboard.settings.allowed') : t(lang, 'commands.admin.starboard.settings.notAllowed'), inline: true },
              { name: t(lang, 'commands.admin.starboard.settings.ignoreBots'), value: sb.ignoreBots !== false ? t(lang, 'commands.admin.starboard.settings.yes') : t(lang, 'commands.admin.starboard.settings.no'), inline: true },
              {
                name: t(lang, 'commands.admin.starboard.settings.ignoredChannels'),
                value: sb.ignoredChannels?.length > 0
                  ? sb.ignoredChannels.map((id: string) => `<#${id}>`).join(', ')
                  : t(lang, 'commands.admin.starboard.settings.none'),
              },
              {
                name: t(lang, 'commands.admin.starboard.settings.ignoredRoles'),
                value: sb.ignoredRoles?.length > 0
                  ? sb.ignoredRoles.map((id: string) => `<@&${id}>`).join(', ')
                  : t(lang, 'commands.admin.starboard.settings.none'),
              },
            )
            .setTimestamp(new Date());
          return void await message.reply({ embeds: [embed] });
        }

        case 'leaderboard':
        case 'lb': {
          const entries = await StarboardMessage.find({ guildId: guild.id, starCount: { $gt: 0 } })
            .sort({ starCount: -1 })
            .limit(10)
            .lean();

          if (entries.length === 0) {
            return void await message.reply(t(lang, 'commands.admin.starboard.leaderboard.none'));
          }

          const lines = entries.map((e: any, i: number) => {
            const emoji = getStarEmoji(e.starCount);
            return `**${i + 1}.** ${emoji} **${e.starCount}** - <@${e.authorId}> in <#${e.channelId}>\n[Jump to message](https://fluxer.app/channels/${guild.id}/${e.channelId}/${e.messageId})`;
          });

          const embed = new EmbedBuilder()
            .setTitle(t(lang, 'commands.admin.starboard.leaderboard.title'))
            .setDescription(lines.join('\n\n'))
            .setColor(0xf1c40f)
            .setFooter({ text: t(lang, 'commands.admin.starboard.leaderboard.footer', { count: entries.length }) })
            .setTimestamp(new Date());
          return void await message.reply({ embeds: [embed] });
        }

        case 'top':
        case 'topusers': {
          const pipeline = await StarboardMessage.aggregate([
            { $match: { guildId: guild.id, starCount: { $gt: 0 } } },
            { $group: { _id: '$authorId', totalStars: { $sum: '$starCount' }, messageCount: { $sum: 1 } } },
            { $sort: { totalStars: -1 } },
            { $limit: 10 },
          ]);

          if (pipeline.length === 0) {
            return void await message.reply(t(lang, 'commands.admin.starboard.topusers.none'));
          }

          const lines = pipeline.map((e: any, i: number) => {
            const emoji = getStarEmoji(e.totalStars);
            return `**${i + 1}.** ${emoji} **${e.totalStars}** stars across **${e.messageCount}** message(s) - <@${e._id}>`;
          });

          const embed = new EmbedBuilder()
            .setTitle(t(lang, 'commands.admin.starboard.topusers.title'))
            .setDescription(lines.join('\n'))
            .setColor(0xf1c40f)
            .setFooter({ text: t(lang, 'commands.admin.starboard.topusers.footer', { count: pipeline.length }) })
            .setTimestamp(new Date());
          return void await message.reply({ embeds: [embed] });
        }

        case 'stats': {
          const totalEntries = await StarboardMessage.countDocuments({ guildId: guild.id });
          const totalStarsResult = await StarboardMessage.aggregate([
            { $match: { guildId: guild.id } },
            { $group: { _id: null, total: { $sum: '$starCount' } } },
          ]);
          const totalStars = totalStarsResult[0]?.total ?? 0;
          const postedCount = await StarboardMessage.countDocuments({ guildId: guild.id, starboardMessageId: { $ne: null } });

          const embed = new EmbedBuilder()
            .setTitle(t(lang, 'commands.admin.starboard.stats.title'))
            .setColor(0xf1c40f)
            .addFields(
              { name: t(lang, 'commands.admin.starboard.stats.trackedMessages'), value: `${totalEntries}`, inline: true },
              { name: t(lang, 'commands.admin.starboard.stats.totalStars'), value: `${totalStars}`, inline: true },
              { name: t(lang, 'commands.admin.starboard.stats.postedToStarboard'), value: `${postedCount}`, inline: true },
            )
            .setTimestamp(new Date());
          return void await message.reply({ embeds: [embed] });
        }

        case 'force': {
          if (!args[1]) return void await message.reply(t(lang, 'commands.admin.starboard.force.usage', { prefix }));

          const sb = settings.starboard || {};
          if (!sb.channelId) return void await message.reply(t(lang, 'commands.admin.starboard.force.noStarboardChannel', { prefix }));

          let targetChannelId: string | null = null;
          let targetMessageId: string;

          const linkMatch = args[1].match(/channels\/(\d{17,19})\/(\d{17,19})\/(\d{17,19})$/);
          if (linkMatch) {
            targetChannelId = linkMatch[2];
            targetMessageId = linkMatch[3];
          } else if (/^\d{17,19}$/.test(args[1])) {
            targetMessageId = args[1];
            targetChannelId = args[2]?.match(/^<#(\d{17,19})>$/)?.[1] || args[2] || (message as any).channelId;
          } else {
            return void await message.reply(t(lang, 'commands.admin.starboard.force.invalidMessageLinkOrId'));
          }

          if (!targetChannelId) return void await message.reply(t(lang, 'commands.admin.starboard.force.couldNotDetermineChannel'));

          try {
            const { Routes } = await import('@fluxerjs/types');
            const msgData = await client.rest.get(Routes.channelMessage(targetChannelId, targetMessageId)) as any;
            if (!msgData?.id) return void await message.reply(t(lang, 'commands.admin.starboard.force.couldNotFetchMessage'));

            const content = msgData.content?.length > 1024
              ? msgData.content.substring(0, 1021) + '...'
              : (msgData.content || '*(no text content)*');

            const starEmoji = getStarEmoji(sb.threshold ?? 3);
            const starColor = getStarColor(sb.threshold ?? 3);

            const starEmbed = new EmbedBuilder()
              .setAuthor({
                name: msgData.author?.username ?? 'Unknown User',
                iconURL: msgData.author?.avatar
                  ? `https://fluxerusercontent.com/avatars/${msgData.author.id}/${msgData.author.avatar}.png`
                  : undefined,
              })
              .setDescription(content)
              .addFields(
                { name: 'Source', value: `[Jump to message](https://fluxer.app/channels/${guild.id}/${targetChannelId}/${targetMessageId})`, inline: true },
                { name: 'Channel', value: `<#${targetChannelId}>`, inline: true },
              )
              .setColor(starColor)
              .setFooter({ text: `${starEmoji} Manually added | ID: ${targetMessageId}` })
              .setTimestamp(new Date(msgData.timestamp ?? Date.now()));

            if (msgData.attachments?.length > 0) {
              const img = msgData.attachments.find((a: any) => a.content_type?.startsWith('image/'));
              if (img?.url) starEmbed.setImage(img.url);
            }

            const starboardMsg = await client.rest.post(Routes.channelMessages(sb.channelId), {
              body: {
                content: `${starEmoji} **Manually Added** | <#${targetChannelId}>`,
                embeds: [starEmbed.toJSON()],
              },
            }) as any;

            await StarboardMessage.findOneAndUpdate(
              { guildId: guild.id, messageId: targetMessageId },
              {
                $set: {
                  channelId: targetChannelId,
                  authorId: msgData.author?.id ?? 'unknown',
                  starboardMessageId: starboardMsg?.id ?? null,
                  starCount: sb.threshold ?? 3,
                },
                $setOnInsert: { reactors: [] },
              },
              { upsert: true, returnDocument: 'after' }
            );

            return void await message.reply(t(lang, 'commands.admin.starboard.force.forceAdded'));
          } catch (err: any) {
            return void await message.reply(t(lang, 'commands.admin.starboard.force.failed', { error: err.message || t(lang, 'commands.admin.starboard.force.unknownError') }));
          }
        }

        case 'remove':
        case 'delete': {
          if (!args[1]) return void await message.reply(t(lang, 'commands.admin.starboard.remove.usage', { prefix }));
          if (!/^\d{17,19}$/.test(args[1])) return void await message.reply(t(lang, 'commands.admin.starboard.remove.invalidMessageId'));

          const entry = await StarboardMessage.findOne({ guildId: guild.id, messageId: args[1] });
          if (!entry) return void await message.reply(t(lang, 'commands.admin.starboard.remove.notInStarboard'));

          if (entry.starboardMessageId && settings.starboard?.channelId) {
            try {
              const { Routes } = await import('@fluxerjs/types');
              await client.rest.delete(Routes.channelMessage(settings.starboard.channelId, entry.starboardMessageId));
            } catch { }
          }

          await StarboardMessage.deleteOne({ _id: entry._id });
          return void await message.reply(t(lang, 'commands.admin.starboard.remove.done'));
        }

        default:
          return void await message.reply(t(lang, 'commands.admin.starboard.unknownSubcommand', { prefix }));
      }
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !starboard (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !starboard: ${error.message || error}`);
        const cached: any = await settingsCache.get(guild.id).catch(() => null);
        const lang = normalizeLocale(cached?.language);
        message.reply(t(lang, 'commands.admin.starboard.errors.generic')).catch(() => { });
      }
    }
  }
};

export default command;
