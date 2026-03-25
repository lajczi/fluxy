import type { Command } from '../../types';
import { PermissionFlags, EmbedBuilder } from '@fluxerjs/core';
import { Routes } from '@fluxerjs/types';
import config from '../../config';
import LockdownState from '../../models/LockdownState';
import GuildSettings from '../../models/GuildSettings';
import { logModAction } from '../../utils/logger';
import isNetworkError from '../../utils/isNetworkError';

const TEXT_CHANNEL_TYPES = [0];

const LOCKDOWN_DENY_BITS = BigInt(PermissionFlags.SendMessages) | BigInt(PermissionFlags.AddReactions);

const MAX_RETRIES = 2;
const PROGRESS_INTERVAL = 10;


async function handleConfig(message: any, args: string[], guild: any, settings: any, prefix = '!') {
  const action = args[0]?.toLowerCase();

  if (!action) {
    return showConfig(message, guild, settings, prefix);
  }

  const isOwner = config.ownerId && message.author.id === config.ownerId;
  const isGuildOwner = guild.ownerId && String(guild.ownerId) === String(message.author.id);
  if (!isOwner && !isGuildOwner) {
    let member = guild.members?.get(message.author.id);
    if (!member) {
      try { member = await guild.fetchMember(message.author.id); } catch {}
    }
    const hasAdmin = member?.permissions?.has(PermissionFlags.Administrator);
    if (!hasAdmin) {
      return message.reply('Only **Administrators** or the server owner can change lockdown configuration.');
    }
  }

  const mention = args[1];
  if (!mention) {
    return message.reply(`Please mention a role or user. Example: \`${prefix}lockdown config ${action} @Role\``);
  }

  const roleMatch = mention.match(/^<@&(\d+)>$/) || (action === 'addrole' || action === 'removerole' ? mention.match(/^(\d{17,20})$/) : null);
  const userMatch = mention.match(/^<@!?(\d+)>$/) || (action === 'allow' || action === 'deny' ? mention.match(/^(\d{17,20})$/) : null);

  switch (action) {
    case 'addrole': {
      if (!roleMatch) return message.reply(`Please mention a valid role. Example: \`${prefix}lockdown config addrole @Member\``);
      const roleId = roleMatch[1];
      if (roleId === guild.id) return message.reply('The @everyone role is always included in lockdown by default.');
      if (settings.lockdownRoles.includes(roleId)) return message.reply('That role is already in the lockdown target list.');
      settings.lockdownRoles.push(roleId);
      settings.markModified('lockdownRoles');
      await settings.save();
      return message.reply(`Added <@&${roleId}> to lockdown target roles. This role will now be locked down alongside @everyone.`);
    }
    case 'removerole': {
      if (!roleMatch) return message.reply(`Please mention a valid role. Example: \`${prefix}lockdown config removerole @Member\``);
      const roleId = roleMatch[1];
      const idx = settings.lockdownRoles.indexOf(roleId);
      if (idx === -1) return message.reply('That role is not in the lockdown target list.');
      settings.lockdownRoles.splice(idx, 1);
      settings.markModified('lockdownRoles');
      await settings.save();
      return message.reply(`Removed <@&${roleId}> from lockdown target roles.`);
    }
    case 'allow': {
      if (roleMatch) {
        const roleId = roleMatch[1];
        if (settings.lockdownAllowedRoles.includes(roleId)) return message.reply('That role already has lockdown permission.');
        settings.lockdownAllowedRoles.push(roleId);
        settings.markModified('lockdownAllowedRoles');
        await settings.save();
        return message.reply(`<@&${roleId}> can now use the \`${prefix}lockdown\` command.`);
      }
      if (userMatch) {
        const userId = userMatch[1];
        if (settings.lockdownAllowedUsers.includes(userId)) return message.reply('That user already has lockdown permission.');
        settings.lockdownAllowedUsers.push(userId);
        settings.markModified('lockdownAllowedUsers');
        await settings.save();
        return message.reply(`<@${userId}> can now use the \`${prefix}lockdown\` command.`);
      }
      return message.reply(`Please mention a role or user. Example: \`${prefix}lockdown config allow @Moderator\``);
    }
    case 'deny': {
      if (roleMatch) {
        const roleId = roleMatch[1];
        const idx = settings.lockdownAllowedRoles.indexOf(roleId);
        if (idx === -1) return message.reply('That role does not have lockdown permission.');
        settings.lockdownAllowedRoles.splice(idx, 1);
        settings.markModified('lockdownAllowedRoles');
        await settings.save();
        return message.reply(`<@&${roleId}> can no longer use the \`${prefix}lockdown\` command.`);
      }
      if (userMatch) {
        const userId = userMatch[1];
        const idx = settings.lockdownAllowedUsers.indexOf(userId);
        if (idx === -1) return message.reply('That user does not have lockdown permission.');
        settings.lockdownAllowedUsers.splice(idx, 1);
        settings.markModified('lockdownAllowedUsers');
        await settings.save();
        return message.reply(`<@${userId}> can no longer use the \`${prefix}lockdown\` command.`);
      }
      return message.reply(`Please mention a role or user. Example: \`${prefix}lockdown config deny @Moderator\``);
    }
    default:
      return message.reply(
        '**Lockdown config commands:**\n' +
        `\`${prefix}lockdown config\` - view current settings\n` +
        `\`${prefix}lockdown config addrole @Role\` - add a role to lock during lockdown\n` +
        `\`${prefix}lockdown config removerole @Role\` - remove a role from lockdown targets\n` +
        `\`${prefix}lockdown config allow @Role/@User\` - grant lockdown command access\n` +
        `\`${prefix}lockdown config deny @Role/@User\` - revoke lockdown command access`
      );
  }
}

async function showConfig(message: any, guild: any, settings: any, prefix = '!') {
  const targetRoles = settings.lockdownRoles.length
    ? settings.lockdownRoles.map((id: string) => `<@&${id}>`).join(', ')
    : 'None (only @everyone)';

  const allowedRoles = settings.lockdownAllowedRoles.length
    ? settings.lockdownAllowedRoles.map((id: string) => `<@&${id}>`).join(', ')
    : 'None';

  const allowedUsers = settings.lockdownAllowedUsers.length
    ? settings.lockdownAllowedUsers.map((id: string) => `<@${id}>`).join(', ')
    : 'None';

  const embed = new EmbedBuilder()
    .setTitle('Lockdown Configuration')
    .setColor(0x3498db)
    .addFields(
      { name: 'Roles Locked During Lockdown', value: `@everyone + ${targetRoles}`, inline: false },
      { name: 'Allowed Roles', value: allowedRoles, inline: true },
      { name: 'Allowed Users', value: allowedUsers, inline: true },
    )
    .setDescription(
      '**Commands:**\n' +
      `\`${prefix}lockdown config addrole @Role\` - add a role to lock\n` +
      `\`${prefix}lockdown config removerole @Role\` - remove a role\n` +
      `\`${prefix}lockdown config allow @Role/@User\` - grant access\n` +
      `\`${prefix}lockdown config deny @Role/@User\` - revoke access`
    )
    .setTimestamp(new Date());

  return message.reply({ embeds: [embed] });
}


function getLockdownRoleIds(guild: any, settings: any): string[] {
  const roleIds = [guild.id];
  for (const id of settings.lockdownRoles) {
    if (!roleIds.includes(id)) roleIds.push(id);
  }
  return roleIds;
}

async function lockServer(message: any, guild: any, state: any, settings: any, client: any, prefix = '!') {
  const roleIds = getLockdownRoleIds(guild, settings);

  let channels: any[];
  try {
    channels = await guild.fetchChannels();
  } catch (fetchErr) {
    console.warn(`[lockdown] guild.fetchChannels() failed for ${guild.name}: ${(fetchErr as Error).message}`);
    channels = [];
  }

  if (channels.length === 0) {
    try {
      const raw = await client.rest.get(Routes.guildChannels(guild.id)) as any[];
      if (Array.isArray(raw) && raw.length > 0) {
        channels = raw;
        console.log(`[lockdown] Used raw REST fallback for ${guild.name}: ${raw.length} channels`);
      }
    } catch (restErr) {
      console.warn(`[lockdown] REST channel fetch also failed for ${guild.name}: ${(restErr as Error).message}`);
    }
  }

  if (channels.length === 0) {
    channels = [...guild.channels.values()];
  }

  const textChannels = channels.filter((ch: any) => TEXT_CHANNEL_TYPES.includes(ch.type));

  if (textChannels.length === 0) {
    return message.reply(
      'No text channels found to lock down. This usually means the bot could not fetch channels from the Fluxer API.\n' +
      'Check that the bot has **View Channels** permission and try again in a moment.'
    );
  }

  const roleCount = roleIds.length;
  const roleLabel = roleCount === 1 ? '@everyone' : `@everyone + ${roleCount - 1} role(s)`;
  const statusMsg = await message.reply(`Locking down **${textChannels.length}** text channel(s) for ${roleLabel}... This may take a moment.`);

  const snapshots: any[] = [];
  let locked = 0;
  let failed = 0;
  let overwriteCount = 0;

  for (const channel of textChannels) {
    for (const roleId of roleIds) {
      const existing = channel.permissionOverwrites.find((o: any) => o.id === roleId && o.type === 0);

      snapshots.push({
        channelId: channel.id,
        roleId,
        previousAllow: existing ? existing.allow : '0',
        previousDeny: existing ? existing.deny : '0',
        hadOverwrite: !!existing,
      });

      const existingDeny = BigInt(existing?.deny || '0');
      const existingAllow = BigInt(existing?.allow || '0');
      const newDeny = existingDeny | LOCKDOWN_DENY_BITS;
      const newAllow = existingAllow & ~LOCKDOWN_DENY_BITS;

      let success = false;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          await channel.editPermission(roleId, {
            type: 0,
            allow: String(newAllow),
            deny: String(newDeny),
          });
          success = true;
          break;
        } catch (err: any) {
          if (err.name === 'RateLimitError' && attempt < MAX_RETRIES) {
            const delay = (err.retryAfter ?? 1) * 1000;
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          if (isNetworkError(err) && attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
          if (!isNetworkError(err)) {
            console.error(`[${guild.name}] Failed to lock channel #${channel.name} (${channel.id}) for role ${roleId}: ${err.message || err}`);
          }
          break;
        }
      }

      if (success) locked++;
      else failed++;

      overwriteCount++;

      if (overwriteCount % PROGRESS_INTERVAL === 0) {
        try {
          await statusMsg.edit(`Locking... ${overwriteCount} overwrites applied (${locked} locked, ${failed} failed)`);
        } catch {}
      }
    }
  }

  let invitesDisabled = false;
  try {
    const guildData = await client.rest.get(Routes.guild(guild.id)) as any;
    const features: string[] = guildData?.features || [];
    const alreadyDisabled = features.includes('INVITES_DISABLED');
    state.invitesWereDisabled = alreadyDisabled;

    if (!alreadyDisabled) {
      await client.rest.patch(Routes.guild(guild.id), {
        body: { features: [...features, 'INVITES_DISABLED'] },
      });
      invitesDisabled = true;
    }
  } catch (err: any) {
    console.warn(`[lockdown] Failed to disable invites for ${guild.name}: ${err.message}`);
  }

  state.active = true;
  state.lockedBy = message.author.id;
  state.lockedAt = new Date();
  state.channelSnapshots = snapshots;
  await state.save();

  const embed = new EmbedBuilder()
    .setTitle('Server Lockdown Activated')
    .setColor(0xe74c3c)
    .setDescription(
      `All text channels have been locked. Members can no longer send messages or add reactions.` +
      (invitesDisabled ? ` Server invites have been temporarily disabled.` : '') +
      `\n\nUse \`${prefix}lockdown\` again to unlock the server.`
    )
    .addFields(
      { name: 'Overwrites Applied', value: `${locked}`, inline: true },
      { name: 'Failed', value: `${failed}`, inline: true },
      { name: 'Locked By', value: `<@${message.author.id}>`, inline: true },
      { name: 'Invites', value: invitesDisabled ? 'Disabled' : (state.invitesWereDisabled ? 'Already disabled' : 'Could not disable'), inline: true },
      { name: 'Roles Locked', value: roleIds.map((id: string) => id === guild.id ? '@everyone' : `<@&${id}>`).join(', '), inline: false },
    )
    .setTimestamp(new Date());

  try {
    await statusMsg.edit({ content: null, embeds: [embed] });
  } catch {
    await message.reply({ embeds: [embed] }).catch(() => {});
  }

  await logModAction(guild, message.author, null, 'lockdown', `Server lockdown activated - ${locked} overwrite(s) across ${textChannels.length} channel(s)`, { client }).catch(() => {});
}

async function unlockServer(message: any, guild: any, state: any, settings: any, client: any) {
  let channels: any[];
  try {
    channels = await guild.fetchChannels();
  } catch {
    channels = [];
  }
  if (channels.length === 0) {
    try {
      const raw = await client.rest.get(Routes.guildChannels(guild.id)) as any[];
      if (Array.isArray(raw) && raw.length > 0) channels = raw;
    } catch {}
  }
  if (channels.length === 0) {
    channels = [...guild.channels.values()];
  }

  const statusMsg = await message.reply(`Unlocking **${state.channelSnapshots.length}** overwrite(s)... This may take a moment.`);

  let unlocked = 0;
  let failed = 0;

  for (const snapshot of state.channelSnapshots) {
    const roleId = snapshot.roleId || guild.id;
    const channel = channels.find((ch: any) => ch.id === snapshot.channelId) || guild.channels.get(snapshot.channelId);
    if (!channel) {
      failed++;
      continue;
    }

    let success = false;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (!snapshot.hadOverwrite) {
          try {
            await channel.deletePermission(roleId);
          } catch (delErr: any) {
            if (delErr.code !== 10003 && delErr.statusCode !== 404) throw delErr;
          }
        } else {
          await channel.editPermission(roleId, {
            type: 0,
            allow: snapshot.previousAllow,
            deny: snapshot.previousDeny,
          });
        }
        success = true;
        break;
      } catch (err: any) {
        if (err.name === 'RateLimitError' && attempt < MAX_RETRIES) {
          const delay = (err.retryAfter ?? 1) * 1000;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (isNetworkError(err) && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        if (!isNetworkError(err)) {
          console.error(`[${guild.name}] Failed to unlock channel #${channel.name} (${channel.id}) for role ${roleId}: ${err.message || err}`);
        }
        break;
      }
    }

    if (success) unlocked++;
    else failed++;
  }

  let invitesRestored = false;
  if (!state.invitesWereDisabled) {
    try {
      const guildData = await client.rest.get(Routes.guild(guild.id)) as any;
      const features: string[] = guildData?.features || [];
      if (features.includes('INVITES_DISABLED')) {
        await client.rest.patch(Routes.guild(guild.id), {
          body: { features: features.filter((f: string) => f !== 'INVITES_DISABLED') },
        });
        invitesRestored = true;
      }
    } catch (err: any) {
      console.warn(`[lockdown] Failed to re-enable invites for ${guild.name}: ${err.message}`);
    }
  }

  state.active = false;
  state.lockedBy = null;
  state.lockedAt = null;
  state.channelSnapshots = [];
  state.invitesWereDisabled = false;
  await state.save();

  const embed = new EmbedBuilder()
    .setTitle('Server Lockdown Lifted')
    .setColor(0x2ecc71)
    .setDescription(
      `All text channels have been unlocked. Normal permissions have been restored.` +
      (invitesRestored ? ` Server invites have been re-enabled.` : '') +
      `\n\nThe server is now operating normally.`
    )
    .addFields(
      { name: 'Overwrites Restored', value: `${unlocked}`, inline: true },
      { name: 'Failed', value: `${failed}`, inline: true },
      { name: 'Unlocked By', value: `<@${message.author.id}>`, inline: true },
    )
    .setTimestamp(new Date());

  try {
    await statusMsg.edit({ content: null, embeds: [embed] });
  } catch {
    await message.reply({ embeds: [embed] }).catch(() => {});
  }

  await logModAction(guild, message.author, null, 'lockdown', `Server lockdown lifted - ${unlocked} overwrite(s) restored`, { client }).catch(() => {});
}

async function handleRemoteLock(message: any, targetGuildId: string, client: any) {
  try {
    if (!/^\d{17,20}$/.test(targetGuildId)) {
      return message.reply('Invalid server ID. Please provide a valid numeric server ID.');
    }

    const state = await LockdownState.getOrCreate(targetGuildId);
    if (state.active) {
      return message.reply(`Server \`${targetGuildId}\` is already in lockdown.`);
    }

    let guild = client.guilds.get(targetGuildId);
    if (!guild) {
      try {
        guild = await client.guilds.fetch(targetGuildId);
      } catch {
        return message.reply(`Could not find server \`${targetGuildId}\`. Make sure the bot is still in that server.`);
      }
    }

    const settings = await GuildSettings.getOrCreate(targetGuildId);

    await message.reply(`Locking down **${guild.name}** (\`${guild.id}\`)...`);

    await lockServer(message, guild, state, settings, client);

  } catch (error: any) {
    if (isNetworkError(error)) {
      console.warn(`Fluxer API unreachable during DM !lockdown start (ECONNRESET)`);
      message.reply('The Fluxer API is having connectivity issues. Please try again shortly.').catch(() => {});
    } else {
      console.error(`Error in DM !lockdown start: ${error.message || error}`);
      message.reply(`An error occurred: \`${error.message || error}\``).catch(() => {});
    }
  }
}

async function handleRemoteUnlock(message: any, targetGuildId: string, client: any) {
  try {
    if (!/^\d{17,20}$/.test(targetGuildId)) {
      return message.reply('Invalid server ID. Please provide a valid numeric server ID.');
    }

    const state = await LockdownState.getOrCreate(targetGuildId);
    if (!state.active) {
      return message.reply(`Server \`${targetGuildId}\` does not have an active lockdown.`);
    }

    let guild = client.guilds.get(targetGuildId);
    if (!guild) {
      try {
        guild = await client.guilds.fetch(targetGuildId);
      } catch {
        return message.reply(`Could not find server \`${targetGuildId}\`. Make sure the bot is still in that server.`);
      }
    }

    const settings = await GuildSettings.getOrCreate(targetGuildId);

    await message.reply(`Unlocking **${guild.name}** (\`${guild.id}\`)...`);

    await unlockServer(message, guild, state, settings, client);

  } catch (error: any) {
    if (isNetworkError(error)) {
      console.warn(`Fluxer API unreachable during DM !lockdown end (ECONNRESET)`);
      message.reply('The Fluxer API is having connectivity issues. Please try again shortly.').catch(() => {});
    } else {
      console.error(`Error in DM !lockdown end: ${error.message || error}`);
      message.reply(`An error occurred: \`${error.message || error}\``).catch(() => {});
    }
  }
}

const command: Command = {
  name: 'lockdown',
  description: 'Lock down the entire server by denying SendMessages and AddReactions for @everyone (and configured roles) in all text channels. Run again to unlock.',
  usage: '[config]',
  category: 'admin',
  allowDM: true,
  cooldown: 10,

  async execute(message, args, client, prefix = '!') {
    const isOwner = config.ownerId && message.author.id === config.ownerId;

    if (!(message as any).guild && !(message as any).guildId) {
      if (!isOwner) {
        return void await message.reply('This command can only be used in a server.');
      }

      const sub = args[0]?.toLowerCase();
      const targetGuildId = args[1]?.trim();

      if (sub === 'start' && targetGuildId) {
        return handleRemoteLock(message, targetGuildId, client);
      }

      if (sub === 'end' && targetGuildId) {
        return handleRemoteUnlock(message, targetGuildId, client);
      }

      return void await message.reply(
        `**DM usage:**\n` +
        `\`${prefix}lockdown start <server ID>\` - lock down a server\n` +
        `\`${prefix}lockdown end <server ID>\` - lift a lockdown`
      );
    }

    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) {
      guild = await client.guilds.fetch((message as any).guildId);
    }
    if (!guild) {
      return void await message.reply('This command can only be used in a server.');
    }

    const settings: any = await GuildSettings.getOrCreate(guild.id);

    if (!isOwner) {
      let member = guild.members?.get(message.author.id);
      if (!member) {
        try { member = await guild.fetchMember(message.author.id); } catch {}
      }
      if (!member) {
        return void await message.reply('Could not fetch your member data.');
      }
      const hasAdmin = member.permissions?.has(PermissionFlags.Administrator);
      const isGuildOwner = guild.ownerId && String(guild.ownerId) === String(message.author.id);
      const isAllowedUser = (settings?.lockdownAllowedUsers ?? []).includes(message.author.id);
      const memberRoles = member.roles?.cache?.map((r: any) => r.id)
        ?? member.roles?.roleIds
        ?? (typeof member.roles?.map === 'function' ? member.roles.map((r: any) => typeof r === 'string' ? r : r.id) : []);
      const isAllowedRole = (settings?.lockdownAllowedRoles ?? []).some((r: string) => memberRoles.includes(r));

      if (!hasAdmin && !isGuildOwner && !isAllowedUser && !isAllowedRole) {
        return void await message.reply('You need **Administrator** permission or an authorized lockdown role to use this command.');
      }
    }

    const sub = args[0]?.toLowerCase();
    if (sub === 'config') {
      return handleConfig(message, args.slice(1), guild, settings, prefix);
    }

    try {
      const state = await LockdownState.getOrCreate(guild.id);

      if (state.active) {
        await unlockServer(message, guild, state, settings, client);
      } else {
        await lockServer(message, guild, state, settings, client, prefix);
      }
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !lockdown (ECONNRESET)`);
        message.reply('The Fluxer API is having connectivity issues. Please try again shortly.').catch(() => {});
      } else {
        console.error(`[${guildName}] Error in !lockdown: ${error.message || error}`);
        message.reply('An error occurred while executing the lockdown command.').catch(() => {});
      }
    }
  }
};

export default command;
