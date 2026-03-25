// id ont know if this works or not

import type { BotEvent } from '../types';
import settingsCache from '../utils/settingsCache';
import { logServerEvent } from '../utils/logger';
import isNetworkError from '../utils/isNetworkError';
import * as roleQueue from '../utils/roleQueue';

// test

const event: BotEvent = {
  name: 'messageReactionRemove',

  async execute(...args: any[]) {
    const client = args[args.length - 1];
    const [reaction, user] = args;
    try {
      if (!reaction.guildId) return;
      if (user.bot) return;

      const guild = client.guilds.get(reaction.guildId);
      if (!guild) return;

      const settings: any = await settingsCache.get(guild.id);
      if (!settings) return;

      const emojiDisplay = reaction.emoji.id
        ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
        : reaction.emoji.name;

      await logServerEvent(
        guild,
        'Reaction Removed',
        0x95a5a6,
        [
          { name: 'User',    value: `<@${user.id}>`, inline: true },
          { name: 'Emoji',   value: emojiDisplay, inline: true },
          { name: 'Channel', value: `<#${reaction.channelId}>`, inline: true },
        ],
        client,
        {
          description: `[Jump to message](https://fluxer.app/channels/${reaction.guildId}/${reaction.channelId}/${reaction.messageId})`,
          footer: `Message ID: ${reaction.messageId}`,
          eventType: 'reaction_remove',
        }
      ).catch(() => {});

      const reactionRoles = settings.reactionRoles;
      if (!reactionRoles || reactionRoles.length === 0) return;

      const reactionConfig = reactionRoles.find(
        (rr: any) => rr.messageId === reaction.messageId && rr.channelId === reaction.channelId
      );
      if (!reactionConfig) return;

      const emojiIdentifier = reaction.emoji.id
        ? `${reaction.emoji.name}:${reaction.emoji.id}`
        : reaction.emoji.name;

      const roleMapping = reactionConfig.roles.find(
        (r: any) => r.emoji === emojiIdentifier
      );
      if (!roleMapping) return;

      let member = guild.members?.get(user.id);
      if (!member) {
        try {
          member = await guild.fetchMember(user.id);
        } catch (error: any) {
          if (error?.code === 'MEMBER_NOT_FOUND' || error?.cause?.code === 'UNKNOWN_MEMBER') return;
          console.error('Failed to fetch member:', error);
          return;
        }
      }
      if (!member) return;

      const role = guild.roles?.get(roleMapping.roleId);

      try {
        if (roleMapping.removeRoleId) {
          try {
            await member.addRole(roleMapping.removeRoleId);
          } catch (err: any) {
            if (isNetworkError(err)) {
              roleQueue.enqueue(guild.id, user.id, roleMapping.removeRoleId, 'add');
            } else {
              console.error(`Failed to re-add switched role: ${err.message}`);
            }
          }
        }

        const rolesToRemove: string[] = roleMapping.roleIds?.length ? roleMapping.roleIds : [roleMapping.roleId];
        for (const rid of rolesToRemove) {
          try {
            await member.removeRole(rid);
          } catch (error: any) {
            if (isNetworkError(error)) {
              roleQueue.enqueue(guild.id, user.id, rid, 'remove');
            } else {
              console.error(`Failed to remove reaction role ${rid}: ${error.message}`);
            }
          }
        }
      } catch (error: any) {
        if (isNetworkError(error)) {
          roleQueue.enqueue(guild.id, user.id, roleMapping.roleId, 'remove');
        } else {
          console.error(`Failed to remove reaction role: ${error.message}`);
        }
        return;
      }

      if (settings.reactionRoleDMEnabled) {
        const roleName = role ? role.name : roleMapping.roleId;
        let dmMsg = `The **${roleName}** role has been removed in **${guild.name}**.`;
        if (roleMapping.removeRoleId) {
          const restoredRole = guild.roles?.get(roleMapping.removeRoleId);
          const restoredName = restoredRole?.name || roleMapping.removeRoleId;
          dmMsg = `Your role has been switched back from **${roleName}** to **${restoredName}** in **${guild.name}**.`;
        }
        user.send(dmMsg).catch(() => {});
      }

    } catch (error) {
      console.error('Error in messageReactionRemove event:', error);
    }
  }
};

export default event;
