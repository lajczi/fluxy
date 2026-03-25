import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import { canManageRole } from '../../utils/permissions';
import isNetworkError from '../../utils/isNetworkError';
import { Routes } from '@fluxerjs/types';

async function resolveChannel(arg: string, guild: any, client: any): Promise<any> {
  const idMatch = /^<#(\d+)>$/.exec(arg) || /^(\d+)$/.exec(arg);
  if (idMatch) {
    const id = idMatch[1];
    let ch = guild.channels.get(id);
    if (!ch) {
      try { ch = await client.channels.resolve(id); } catch { }
    }
    return ch || null;
  }

  const name = arg.replace(/^#/, '').toLowerCase();
  for (const ch of guild.channels.values()) {
    if (ch.name && ch.name.toLowerCase() === name) return ch;
  }
  return null;
}

function parseRoleId(str: string): string | null {
  const match = /^<@&(\d+)>$/.exec(str) || /^(\d+)$/.exec(str);
  return match ? match[1] : null;
}

function normalizeEmoji(str: string): string {
  const mention = /^<a?:(\w+):(\d+)>$/.exec(str);
  if (mention) return `${mention[1]}:${mention[2]}`;
  const colon = /^a?:(\w+):(\d+)$/.exec(str);
  if (colon) return `${colon[1]}:${colon[2]}`;
  return str.replace(/[\uFE00-\uFE0F\u200D]/g, '').trim();
}

function isUnicodeEmoji(str: string): boolean {
  const stripped = str.replace(/[\uFE00-\uFE0F\u200D]/g, '').trim();
  return stripped.length > 0 && !/^[\x20-\x7E]+$/.test(stripped);
}

async function safeResolveEmoji(client: any, emojiArg: string, guildId: string): Promise<string | null> {
  try {
    const resolved = await (client as any).resolveEmoji(emojiArg, guildId);
    return normalizeEmoji(resolved);
  } catch {}
  if (isUnicodeEmoji(emojiArg)) {
    return normalizeEmoji(emojiArg);
  }
  const normalized = normalizeEmoji(emojiArg);
  if (normalized !== emojiArg) return normalized;
  return null;
}

function stripBrackets(s: string): string {
  return s.replace(/^<|>$/g, '');
}

function extractRawText(content: string, skipTokens: number): string {
  let idx = 0;
  for (let i = 0; i < skipTokens; i++) {
    while (idx < content.length && content[idx] === ' ') idx++;
    while (idx < content.length && content[idx] !== ' ' && content[idx] !== '\n') idx++;
  }
  if (idx < content.length && content[idx] === ' ') idx++;
  return content.slice(idx).trim();
}

function usageEmbed(prefix: string) {
  return {
    title: 'Reaction Role Commands',
    color: 0x5865F2,
    fields: [
      { name: `${prefix}rr post <#channel> [text]`, value: 'Bot posts a reaction role panel in the channel', inline: false },
      { name: `${prefix}rr add <#channel> <messageId> <emoji> <@role>`, value: 'Map an emoji to a role on a message\nPaste the emoji directly or use a shortcode - find emojis at [getemoji.com](https://getemoji.com)', inline: false },
      { name: `${prefix}rr addmulti <#channel> <messageId> <emoji> <@role1> <@role2> ...`, value: 'Map an emoji to **multiple roles** at once (up to 10)', inline: false },
      { name: `${prefix}rr remove <#channel> <messageId> <emoji>`, value: 'Remove an emoji-role mapping', inline: false },
      { name: `${prefix}rr edit <#channel> <messageId> [new text]`, value: 'Edit the text of an existing reaction role panel', inline: false },
      { name: `${prefix}rr clear <messageId>`, value: 'Remove all reaction roles from a message and reset it to 0/20', inline: false },
      { name: `${prefix}rr list`, value: 'List all configured reaction role panels', inline: false },
      { name: `${prefix}rr dm <on|off>`, value: 'Toggle DM notifications when roles are assigned/removed', inline: false },
      { name: `${prefix}rr switch <#channel> <messageId> <emoji> <@removeRole> <@addRole>`, value: 'Map an emoji to switch roles: removes one role and adds another', inline: false },
    ],
    footer: { text: 'Tip: Copy emoji characters directly from getemoji.com - shortcodes like :white_check_mark: also work' }
  };
}

const command: Command = {
  name: 'reactionrole',
  description: 'Create panels where users react with an emoji to get a role - run !rr with no args to see subcommand help',
  usage: '<post|add|remove|edit|clear|list|dm>',
  category: 'admin',
  aliases: ['rr'],
  permissions: ['ManageGuild'],

  async execute(message, args, client, prefix = '!') {
    const subcommand = args[0]?.toLowerCase();

    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) {
      guild = await client.guilds.fetch((message as any).guildId);
    }
    if (!guild) return void await message.reply('This command can only be used in a server.');

    if (!subcommand) {
      return void await message.reply({ embeds: [usageEmbed(prefix)] });
    }

    if (subcommand === 'post') {
      const channelArg = args[1];
      const text = channelArg ? extractRawText(message.content, 3) : '';

      if (!channelArg) {
        return void await message.reply(`Usage: \`${prefix}rr post <#channel> [message text]\``);
      }

      const channel = await resolveChannel(channelArg, guild, client);
      if (!channel) return void await message.reply('Channel not found. Mention it, use its ID, or type its name.');

      const description = text || 'React below to get a role';

      try {
        const posted = await channel.send({
          embeds: [{
            description,
            color: 0x5865F2,
          }]
        });

        const settings: any = await GuildSettings.getOrCreate(guild.id);
        const exists = settings.reactionRoles.find((rr: any) => rr.messageId === posted.id);
        if (!exists) {
          settings.reactionRoles.push({ messageId: posted.id, channelId: channel.id, roles: [] });
          await settings.save();
          settingsCache.invalidate(guild.id);
        }

        return void await message.reply(
          `Panel posted in <#${channel.id}>.\n` +
          `Message ID: \`${posted.id}\`\n\n` +
          `To add roles to this panel, use:\n` +
          `\`${prefix}rr add #${channel.name} ${posted.id} <emoji> <@role>\`\n\n` +
          `**Example:** \`${prefix}rr add #${channel.name} ${posted.id}  @Member\``
        );
      } catch (err: any) {
        if (isNetworkError(err)) {
          console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !rr post (ECONNRESET)`);
        } else {
          console.error(`[${guild?.name || 'Unknown Server'}] Error in !rr post: ${err.message || err}`);
          message.reply('Failed to post the panel. Check that I have permission to send messages there.').catch(() => { });
        }
        return;
      }
    }

    if (subcommand === 'add') {
      const [, channelArg, rawMessageId, emojiArg, roleArg] = args;
      const messageId = rawMessageId ? stripBrackets(rawMessageId) : rawMessageId;

      if (!channelArg || !messageId || !emojiArg || !roleArg) {
        return void await message.reply(`Usage: \`${prefix}rr add <#channel> <messageId> <emoji> <@role>\``);
      }

      let roleId = parseRoleId(roleArg);
      if (!roleId) {
        try { roleId = await guild.resolveRoleId(roleArg); } catch { }
      }
      if (!roleId) return void await message.reply('Invalid role. Mention a role, provide its ID, or type the role name.');

      const emoji = await safeResolveEmoji(client, emojiArg, guild.id);
      if (!emoji) {
        return void await message.reply('Invalid emoji. Use the emoji directly (paste it), a shortcode (`:white_check_mark:`), or a custom server emoji (`<:name:id>`).');
      }

      const channel = await resolveChannel(channelArg, guild, client);
      if (!channel) return void await message.reply('Channel not found.');

      let targetMessage: any;
      try {
        targetMessage = await channel.messages.fetch(messageId);
      } catch {
        return void await message.reply('Message not found in that channel. Double-check the message ID and channel.');
      }

      let role = guild.roles?.get(roleId);
      if (!role) {
        try { await guild.fetchRoles(); role = guild.roles?.get(roleId); } catch { }
      }
      if (!role) {
        try { role = await guild.fetchRole(roleId); } catch { }
      }
      if (!role) return void await message.reply('Role not found. Make sure the role exists and the bot can see it.');

      let commandMember = guild.members?.get(message.author.id);
      if (!commandMember) {
        try { commandMember = await guild.fetchMember(message.author.id); } catch { }
      }
      if (commandMember) {
        const check = canManageRole(commandMember, role, guild);
        if (!check.allowed) return void await message.reply(check.reason || 'You cannot manage that role.');
      }

      let hierarchyWarning = '';
      const botUserId = client.user?.id;
      let botMember = botUserId ? guild.members?.get(botUserId) : null;
      if (!botMember && botUserId) {
        try { botMember = await guild.fetchMember(botUserId); } catch { }
      }
      if (botMember) {
        let freshRoles: Map<string, number> | null = null;
        try {
          const rolesData = await client.rest.get(Routes.guildRoles(guild.id)) as any[];
          if (Array.isArray(rolesData)) {
            freshRoles = new Map(rolesData.map((r: any) => [r.id, r.position ?? 0]));
          }
        } catch { }

        const botRoleIds = botMember.roles?.roleIds ?? [];
        const getPos = (id: string) => freshRoles?.get(id) ?? guild.roles?.get(id)?.position ?? 0;
        const botHighestPos = botRoleIds.length > 0
          ? Math.max(0, ...botRoleIds.map((id: string) => getPos(id)))
          : 0;
        const targetPos = getPos(roleId);
        if (targetPos >= botHighestPos) {
          hierarchyWarning = `\n\nMy role is currently below **${role.name}** - users won't receive this role until you move my role above it in **Server Settings > Roles**.`;
        }
      }

      try {
        await targetMessage.react(emojiArg);
      } catch {
        return void await message.reply(
          `I couldn't add the ${emojiArg} reaction to that message. ` +
          `Check that the emoji is valid and I have **Add Reactions** permission in <#${channel.id}>.`
        );
      }

      try {
        const settings: any = await GuildSettings.getOrCreate(guild.id);
        const entry = settings.reactionRoles.find((rr: any) => rr.messageId === messageId && rr.channelId === channel.id);

        if (entry) {
          if (entry.roles.length >= 20) {
            return void await message.reply('This panel already has the maximum of 20 emoji-role pairs.');
          }
          if (entry.roles.some((r: any) => r.emoji === emoji)) {
            return void await message.reply(`${emojiArg} is already mapped on that message.`);
          }
          entry.roles.push({ emoji, roleId });
        } else {
          settings.reactionRoles.push({ messageId, channelId: channel.id, roles: [{ emoji, roleId }] });
        }

        settings.markModified('reactionRoles');
        await settings.save();
        settingsCache.invalidate(guild.id);
      } catch (err: any) {
        if (isNetworkError(err)) {
          console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !rr add (ECONNRESET)`);
        } else {
          console.error(`[${guild?.name || 'Unknown Server'}] Error in !rr add: ${err.message || err}`);
          message.reply('Failed to save the reaction role. Please try again.').catch(() => { });
        }
        return;
      }

      return void await message.reply(`Done! ${emojiArg} is now mapped to <@&${roleId}>.${hierarchyWarning}`);
    }

    if (subcommand === 'edit') {
      const channelArg = args[1];
      const messageId = args[2] ? stripBrackets(args[2]) : args[2];
      const newText = (channelArg && messageId) ? extractRawText(message.content, 4) : '';

      if (!channelArg || !messageId) {
        return void await message.reply(`Usage: \`${prefix}rr edit <#channel> <messageId> [new text]\`\nLeave text empty to be prompted for it.`);
      }

      const channel = await resolveChannel(channelArg, guild, client);
      if (!channel) return void await message.reply('Channel not found. Mention it, use its ID, or type its name.');

      const settings: any = await GuildSettings.getOrCreate(guild.id);
      const entry = settings.reactionRoles.find((rr: any) => rr.messageId === messageId && rr.channelId === channel.id);
      if (!entry) {
        return void await message.reply(`No reaction role panel found for that message. Use \`${prefix}rr list\` to see configured panels.`);
      }

      let targetMessage: any;
      try {
        targetMessage = await channel.messages.fetch(messageId);
      } catch {
        return void await message.reply('Message not found in that channel. Double-check the message ID and channel.');
      }

      if (!newText) {
        return void await message.reply(
          'Please provide the new text for the panel.\n' +
          `Usage: \`${prefix}rr edit #${channel.name} ${messageId} Your new panel text here\`\n\n` +
          'Tip: You can use markdown formatting like **bold**, *italic*, __underline__, and ~~strikethrough~~.'
        );
      }

      try {
        await targetMessage.edit({
          embeds: [{
            description: newText,
            color: 0x5865F2,
          }]
        });

        return void await message.reply(`Panel updated in <#${channel.id}>.`);
      } catch (err: any) {
        if (isNetworkError(err)) {
          console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !rr edit (ECONNRESET)`);
        } else {
          console.error(`[${guild?.name || 'Unknown Server'}] Error in !rr edit: ${err.message || err}`);
          message.reply('Failed to edit the panel. Make sure the message belongs to me.').catch(() => { });
        }
        return;
      }
    }

    if (subcommand === 'remove') {
      const [, channelArg, rawMessageId, emojiArg] = args;
      const messageId = rawMessageId ? stripBrackets(rawMessageId) : rawMessageId;

      if (!channelArg || !messageId || !emojiArg) {
        return void await message.reply(`Usage: \`${prefix}rr remove <#channel> <messageId> <emoji>\``);
      }

      const channel = await resolveChannel(channelArg, guild, client);
      if (!channel) return void await message.reply('Channel not found.');

      const emoji = await safeResolveEmoji(client, emojiArg, guild.id);
      if (!emoji) {
        return void await message.reply('Invalid emoji. Use the emoji directly (paste it), a shortcode (`:white_check_mark:`), or a custom server emoji (`<:name:id>`).');
      }

      try {
        const settings: any = await GuildSettings.getOrCreate(guild.id);
        const entry = settings.reactionRoles.find((rr: any) => rr.messageId === messageId && rr.channelId === channel.id);

        if (!entry) return void await message.reply('No reaction roles configured for that message.');

        const before = entry.roles.length;
        entry.roles = entry.roles.filter((r: any) => r.emoji !== emoji);

        if (entry.roles.length === before) {
          return void await message.reply(`No mapping found for ${emojiArg} on that message.`);
        }

        if (entry.roles.length === 0) {
          settings.reactionRoles = settings.reactionRoles.filter((rr: any) => rr.messageId !== messageId);
        }

        settings.markModified('reactionRoles');
        await settings.save();
        settingsCache.invalidate(guild.id);
      } catch (err: any) {
        if (isNetworkError(err)) {
          console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !rr remove (ECONNRESET)`);
        } else {
          console.error(`[${guild?.name || 'Unknown Server'}] Error in !rr remove: ${err.message || err}`);
          message.reply('Failed to update the reaction role. Please try again.').catch(() => { });
        }
        return;
      }

      try {
        const targetMessage = await channel.messages.fetch(messageId).catch(() => null);
        if (targetMessage) {
          await targetMessage.removeReaction(emojiArg).catch(() => { });
        }
      } catch { }

      return void await message.reply(`Removed the ${emojiArg} mapping.`);
    }

    if (subcommand === 'clear') {
      let messageId: string | undefined, channelId: string | undefined;

      if (args[1] && /^\d{17,19}$/.test(stripBrackets(args[1])) && !args[2]) {
        messageId = stripBrackets(args[1]);
      } else {
        const channelArg = args[1];
        messageId = args[2] ? stripBrackets(args[2]) : args[2];
        if (!channelArg || !messageId) {
          return void await message.reply(`Usage: \`${prefix}rr clear <messageId>\``);
        }
        const ch = await resolveChannel(channelArg, guild, client);
        if (!ch) return void await message.reply('Channel not found.');
        channelId = ch.id;
      }

      let count = 0;

      try {
        const settings: any = await GuildSettings.getOrCreate(guild.id);

        let entry: any;
        if (channelId) {
          entry = settings.reactionRoles.find((rr: any) => rr.messageId === messageId && rr.channelId === channelId);
        } else {
          entry = settings.reactionRoles.find((rr: any) => rr.messageId === messageId);
          if (entry) channelId = entry.channelId;
        }

        if (!entry) return void await message.reply(`No reaction roles found for that message ID. Use \`${prefix}rr list\` to see configured panels.`);

        count = entry.roles.length;
        settings.reactionRoles = settings.reactionRoles.filter((rr: any) => rr.messageId !== messageId);
        settings.markModified('reactionRoles');
        await settings.save();
        settingsCache.invalidate(guild.id);
      } catch (err: any) {
        if (isNetworkError(err)) {
          console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !rr clear (ECONNRESET)`);
        } else {
          console.error(`[${guild?.name || 'Unknown Server'}] Error in !rr clear: ${err.message || err}`);
          message.reply('Failed to clear reaction roles. Please try again.').catch(() => { });
        }
        return;
      }

      try {
        const targetChannel = channelId
          ? (guild.channels?.get(channelId) || await resolveChannel(channelId, guild, client))
          : null;
        if (targetChannel && messageId) {
          const targetMessage = await targetChannel.messages.fetch(messageId).catch(() => null);
          if (targetMessage) await targetMessage.removeAllReactions().catch(() => { });
        }
      } catch { }

      return void await message.reply(`Cleared ${count} reaction role(s) from that message. You can now re-add up to 20.`);
    }

    if (subcommand === 'list') {
      try {
        const settings: any = await GuildSettings.getOrCreate(guild.id);
        const reactionRoles = settings.reactionRoles;

        if (!reactionRoles || reactionRoles.length === 0) {
          return void await message.reply('No reaction role panels configured in this server.');
        }

        const fields = reactionRoles.map((rr: any, i: number) => ({
          name: `Panel ${i + 1} - <#${rr.channelId}> | \`${rr.messageId}\``,
          value: rr.roles.length > 0
            ? rr.roles.map((r: any) => {
              if (r.removeRoleId) {
                return `${r.emoji} → remove <@&${r.removeRoleId}>, add <@&${r.roleId}>`;
              }
              return `${r.emoji} → <@&${r.roleId}>`;
            }).join('\n')
            : '_No emoji mappings yet_',
          inline: false
        }));

        const dmStatus = settings.reactionRoleDMEnabled ? 'On' : 'Off';

        return void await message.reply({
          embeds: [{
            title: 'Reaction Role Panels',
            color: 0x5865F2,
            fields,
            footer: { text: `DM Notifications: ${dmStatus} - use "${prefix}rr dm on/off" to toggle` }
          }]
        });
      } catch (err: any) {
        if (isNetworkError(err)) {
          console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !rr list (ECONNRESET)`);
        } else {
          console.error(`[${guild?.name || 'Unknown Server'}] Error in !rr list: ${err.message || err}`);
          message.reply('Failed to retrieve reaction roles. Please try again.').catch(() => { });
        }
        return;
      }
    }

    if (subcommand === 'dm') {
      const toggle = args[1]?.toLowerCase();
      if (!toggle || !['on', 'off'].includes(toggle)) {
        return void await message.reply(`Usage: \`${prefix}rr dm <on|off>\``);
      }

      try {
        await (GuildSettings as any).updateSetting(guild.id, 'reactionRoleDMEnabled', toggle === 'on');
        settingsCache.invalidate(guild.id);
        return void await message.reply(`DM notifications for reaction roles are now **${toggle}**.`);
      } catch (err: any) {
        if (isNetworkError(err)) {
          console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !rr dm (ECONNRESET)`);
        } else {
          console.error(`[${guild?.name || 'Unknown Server'}] Error in !rr dm: ${err.message || err}`);
          message.reply('Failed to update DM setting. Please try again.').catch(() => { });
        }
        return;
      }
    }

    if (subcommand === 'switch') {
      const [, channelArg, rawMessageId, emojiArg, removeRoleArg, addRoleArg] = args;
      const messageId = rawMessageId ? stripBrackets(rawMessageId) : rawMessageId;

      if (!channelArg || !messageId || !emojiArg || !removeRoleArg || !addRoleArg) {
        return void await message.reply(
          `Usage: \`${prefix}rr switch <#channel> <messageId> <emoji> <@removeRole> <@addRole>\`\n` +
          `When a user reacts, the bot will **remove** the first role and **add** the second.`
        );
      }

      let removeRoleId = parseRoleId(removeRoleArg);
      if (!removeRoleId) {
        try { removeRoleId = await guild.resolveRoleId(removeRoleArg); } catch { }
      }
      let addRoleId = parseRoleId(addRoleArg);
      if (!addRoleId) {
        try { addRoleId = await guild.resolveRoleId(addRoleArg); } catch { }
      }
      if (!removeRoleId) return void await message.reply('Invalid remove role. Mention a role, provide its ID, or type the role name.');
      if (!addRoleId) return void await message.reply('Invalid add role. Mention a role, provide its ID, or type the role name.');

      const emoji = await safeResolveEmoji(client, emojiArg, guild.id);
      if (!emoji) {
        return void await message.reply('Invalid emoji. Use the emoji directly (paste it), a shortcode (`:white_check_mark:`), or a custom server emoji (`<:name:id>`).');
      }

      const channel = await resolveChannel(channelArg, guild, client);
      if (!channel) return void await message.reply('Channel not found.');

      let targetMessage: any;
      try {
        targetMessage = await channel.messages.fetch(messageId);
      } catch {
        return void await message.reply('Message not found in that channel.');
      }

      let addRole = guild.roles?.get(addRoleId);
      let removeRole = guild.roles?.get(removeRoleId);
      if (!addRole || !removeRole) {
        try { await guild.fetchRoles(); } catch { }
        if (!addRole) addRole = guild.roles?.get(addRoleId);
        if (!removeRole) removeRole = guild.roles?.get(removeRoleId);
      }
      if (!addRole) { try { addRole = await guild.fetchRole(addRoleId); } catch { } }
      if (!addRole) return void await message.reply('Add-role not found. Make sure the role exists and the bot can see it.');
      if (!removeRole) { try { removeRole = await guild.fetchRole(removeRoleId); } catch { } }
      if (!removeRole) return void await message.reply('Remove-role not found. Make sure the role exists and the bot can see it.');

      let commandMember = guild.members?.get(message.author.id);
      if (!commandMember) { try { commandMember = await guild.fetchMember(message.author.id); } catch { } }
      if (commandMember) {
        const check1 = canManageRole(commandMember, addRole, guild);
        if (!check1.allowed) return void await message.reply(check1.reason || 'You cannot manage the add-role.');
        const check2 = canManageRole(commandMember, removeRole, guild);
        if (!check2.allowed) return void await message.reply(check2.reason || 'You cannot manage the remove-role.');
      }

      try {
        await targetMessage.react(emojiArg);
      } catch {
        return void await message.reply(
          `I couldn't add the ${emojiArg} reaction to that message. ` +
          `Check that the emoji is valid and I have **Add Reactions** permission in <#${channel.id}>.`
        );
      }

      try {
        const settings: any = await GuildSettings.getOrCreate(guild.id);
        const entry = settings.reactionRoles.find((rr: any) => rr.messageId === messageId && rr.channelId === channel.id);

        const roleEntry = { emoji, roleId: addRoleId, removeRoleId };

        if (entry) {
          if (entry.roles.length >= 20) {
            return void await message.reply('This panel already has the maximum of 20 emoji-role pairs.');
          }
          if (entry.roles.some((r: any) => r.emoji === emoji)) {
            return void await message.reply(`${emojiArg} is already mapped on that message. Remove it first with \`${prefix}rr remove\`.`);
          }
          entry.roles.push(roleEntry);
        } else {
          settings.reactionRoles.push({ messageId, channelId: channel.id, roles: [roleEntry] });
        }

        settings.markModified('reactionRoles');
        await settings.save();
        settingsCache.invalidate(guild.id);
      } catch (err: any) {
        if (isNetworkError(err)) {
          console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !rr switch (ECONNRESET)`);
        } else {
          console.error(`[${guild?.name || 'Unknown Server'}] Error in !rr switch: ${err.message || err}`);
          message.reply('Failed to save the reaction role switch. Please try again.').catch(() => { });
        }
        return;
      }

      return void await message.reply(
        `Switch mapped: ${emojiArg} → remove **${removeRole.name}**, add **${addRole.name}** on that message.`
      );
    }

    if (subcommand === 'addmulti') {
      const [, channelArg, rawMessageId, emojiArg, ...roleArgs] = args;
      const messageId = rawMessageId ? stripBrackets(rawMessageId) : rawMessageId;

      if (!channelArg || !messageId || !emojiArg || roleArgs.length < 2) {
        return void await message.reply(`Usage: \`${prefix}rr addmulti <#channel> <messageId> <emoji> <@role1> <@role2> ...\`\nAssign **multiple roles** with one reaction (minimum 2 roles, max 10).`);
      }

      if (roleArgs.length > 10) {
        return void await message.reply('Maximum of 10 roles per emoji.');
      }

      const resolvedRoleIds: string[] = [];
      for (const roleArg of roleArgs) {
        let roleId = parseRoleId(roleArg);
        if (!roleId) {
          try { roleId = await guild.resolveRoleId(roleArg); } catch {}
        }
        if (!roleId) return void await message.reply(`Invalid role: \`${roleArg}\`. Mention a role, provide its ID, or type the role name.`);
        if (resolvedRoleIds.includes(roleId)) return void await message.reply(`Duplicate role: <@&${roleId}>.`);
        resolvedRoleIds.push(roleId);
      }

      const emoji = await safeResolveEmoji(client, emojiArg, guild.id);
      if (!emoji) {
        return void await message.reply('Invalid emoji. Use the emoji directly (paste it), a shortcode (`:white_check_mark:`), or a custom server emoji (`<:name:id>`).');
      }

      const channel = await resolveChannel(channelArg, guild, client);
      if (!channel) return void await message.reply('Channel not found.');

      let targetMessage: any;
      try {
        targetMessage = await channel.messages.fetch(messageId);
      } catch {
        return void await message.reply('Message not found in that channel. Double-check the message ID and channel.');
      }

      const roleNames: string[] = [];
      for (const roleId of resolvedRoleIds) {
        let role = guild.roles?.get(roleId);
        if (!role) {
          try { await guild.fetchRoles(); role = guild.roles?.get(roleId); } catch {}
        }
        if (!role) {
          try { role = await guild.fetchRole(roleId); } catch {}
        }
        if (!role) return void await message.reply(`Role not found: \`${roleId}\`. Make sure the role exists and the bot can see it.`);

        let commandMember = guild.members?.get(message.author.id);
        if (!commandMember) { try { commandMember = await guild.fetchMember(message.author.id); } catch {} }
        if (commandMember) {
          const check = canManageRole(commandMember, role, guild);
          if (!check.allowed) return void await message.reply(check.reason || `You cannot manage the role **${role.name}**.`);
        }
        roleNames.push(role.name);
      }

      try {
        await targetMessage.react(emojiArg);
      } catch {
        return void await message.reply(
          `I couldn't add the ${emojiArg} reaction to that message. ` +
          `Check that the emoji is valid and I have **Add Reactions** permission in <#${channel.id}>.`
        );
      }

      try {
        const settings: any = await GuildSettings.getOrCreate(guild.id);
        const entry = settings.reactionRoles.find((rr: any) => rr.messageId === messageId && rr.channelId === channel.id);

        const roleEntry = { emoji, roleId: resolvedRoleIds[0], roleIds: resolvedRoleIds, removeRoleId: null };

        if (entry) {
          if (entry.roles.length >= 20) {
            return void await message.reply('This panel already has the maximum of 20 emoji-role pairs.');
          }
          if (entry.roles.some((r: any) => r.emoji === emoji)) {
            return void await message.reply(`${emojiArg} is already mapped on that message. Remove it first with \`${prefix}rr remove\`.`);
          }
          entry.roles.push(roleEntry);
        } else {
          settings.reactionRoles.push({ messageId, channelId: channel.id, roles: [roleEntry] });
        }

        settings.markModified('reactionRoles');
        await settings.save();
        settingsCache.invalidate(guild.id);
      } catch (err: any) {
        if (isNetworkError(err)) {
          console.warn(`[${guild?.name || 'Unknown Server'}] Fluxer API unreachable during !rr addmulti (ECONNRESET)`);
        } else {
          console.error(`[${guild?.name || 'Unknown Server'}] Error in !rr addmulti: ${err.message || err}`);
          message.reply('Failed to save the reaction role. Please try again.').catch(() => {});
        }
        return;
      }

      const roleList = resolvedRoleIds.map((id: string) => `<@&${id}>`).join(', ');
      return void await message.reply(`Done! ${emojiArg} is now mapped to **${resolvedRoleIds.length} roles**: ${roleList}.`);
    }

    return void await message.reply({ embeds: [usageEmbed(prefix)] });
  }
};

export default command;
