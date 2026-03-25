import { EmbedBuilder } from '@fluxerjs/core';
import type { Command } from '../../types';
import parseUserId from '../../utils/parseUserId';
import isNetworkError from '../../utils/isNetworkError';

const command: Command = {
  name: 'userinfo',
  description: 'Show profile info for a user \u2014 account age, server join date, roles, and timeout status. Leave blank for your own info',
  usage: '[@user or user ID]',
  category: 'info',
  cooldown: 5,

  async execute(message, args, client) {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) {
      guild = await client.guilds.fetch((message as any).guildId);
    }

    if (!guild) {
      return void await message.reply('This command can only be used in a server.');
    }

    try {
      let userId = (message as any).author.id;

      if (args[0]) {
        const parsedId = parseUserId(args[0]);
        if (!parsedId) {
          return void await message.reply('Please provide a valid user mention or ID.');
        }
        userId = parsedId;
      }

      let user: any;
      try {
        user = await client.users.fetch(userId);
      } catch {
        return void await message.reply('Could not find that user.');
      }

      let member: any = guild.members?.get(userId);
      if (!member) {
        try {
          member = await guild.fetchMember(userId);
        } catch {
          member = null;
        }
      }

      const createdAt = new Date(parseInt(user.id) / 4194304 + 1420070400000);
      const createdString = createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const embed = new EmbedBuilder()
        .setTitle(`User Information`)
        .setColor(member?.displayColor || 0x3498db)
        .setThumbnail(user.avatarURL?.() || null)
        .addFields(
          { name: 'Username', value: user.username, inline: true },
          { name: 'ID', value: user.id, inline: true },
          { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
          { name: 'Account Created', value: createdString, inline: true }
        )
        .setTimestamp(new Date())
        .setFooter({ text: `Requested by ${(message as any).author.username}` });

      if (member) {
        const joinedAt = member.joinedAt ? new Date(member.joinedAt) : null;
        const joinedString = joinedAt
          ? joinedAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          : 'Unknown';

        embed.addFields(
          { name: 'Joined Server', value: joinedString, inline: true }
        );

        if (member.roles && member.roles.cache) {
          const roles = member.roles.cache
            .filter((role: any) => role.id !== guild.id)
            .map((role: any) => `<@&${role.id}>`)
            .slice(0, 10)
            .join(', ');

          if (roles) {
            const totalRoles = member.roles.cache.size - 1;
            embed.addFields(
              {
                name: `Roles (${totalRoles})`,
                value: roles + (totalRoles > 10 ? '...' : ''),
                inline: false
              }
            );
          }
        }

        if (member.communicationDisabledUntil && member.communicationDisabledUntil > new Date()) {
          const timeoutEnd = new Date(member.communicationDisabledUntil);
          embed.addFields(
            { name: 'Timeout', value: `Until ${timeoutEnd.toLocaleString()}`, inline: true }
          );
        }

        if (member.nickname) {
          embed.addFields(
            { name: 'Nickname', value: member.nickname, inline: true }
          );
        }
      }

      await message.reply({ embeds: [embed] });

    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !userinfo (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !userinfo: ${error.message || error}`);
        message.reply('An error occurred while fetching user information.').catch(() => {});
      }
    }
  }
};

export default command;
