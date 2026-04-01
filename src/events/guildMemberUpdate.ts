import type { BotEvent } from '../types';
import { logServerEvent } from '../utils/logger';
import settingsCache from '../utils/settingsCache';
import * as memberCounter from '../utils/memberCounter';
import { generateWelcomeCard } from '../utils/welcomeCard';
import { EmbedBuilder } from '@fluxerjs/core';

const event: BotEvent = {
  name: 'guildMemberUpdate',

  async execute(...args: any[]) {
    const client = args[args.length - 1];
    const [oldMember, newMember] = args;
    try {
      const guild = newMember.guild;
      if (!guild) return;

      const toArray = (roles: any): string[] => {
        if (!roles) return [];
        if (Array.isArray(roles)) return roles;
        if (typeof roles.roleIds !== 'undefined') return Array.isArray(roles.roleIds) ? roles.roleIds : [];
        if (typeof roles.values === 'function') return [...roles.values()].map((r: any) => r.id ?? r);
        if (typeof roles.toArray === 'function') return roles.toArray().map((r: any) => r.id ?? r);
        return [];
      };

      const oldRoles = toArray(oldMember?.roles);
      const newRoles = toArray(newMember?.roles);

      const added = newRoles.filter((r: string) => !oldRoles.includes(r));
      const removed = oldRoles.filter((r: string) => !newRoles.includes(r));

      if (added.length === 0 && removed.length === 0) return;

      const fields: any[] = [];

      if (added.length > 0) {
        fields.push({
          name: 'Roles Added',
          value: added.map((id: string) => `<@&${id}>`).join(', '),
          inline: false
        });
      }

      if (removed.length > 0) {
        fields.push({
          name: 'Roles Removed',
          value: removed.map((id: string) => `<@&${id}>`).join(', '),
          inline: false
        });
      }

      const color = added.length > 0 && removed.length === 0
        ? 0x2ecc71
        : removed.length > 0 && added.length === 0
          ? 0xe74c3c
          : 0xf1c40f;

      await logServerEvent(
        guild,
        'Member Roles Updated',
        color,
        fields,
        client,
        {
          description: `<@${newMember.id}>'s roles were updated`,
          footer: `User ID: ${newMember.id}`,
          eventType: 'member_role_update',
        }
      );

      if (added.length > 0) {
        try {
          const settings: any = await settingsCache.get(guild.id);
          if (!settings) return;

          const wm = settings.welcomeMessage;
          if (!wm?.enabled || !wm.channelId || wm.trigger !== 'role') return;

          const triggerRoleId = wm.triggerRoleId || settings.autoroleId;
          if (!triggerRoleId || !added.includes(triggerRoleId)) return;

          let welcomeChannel: any;
          try {
            const channelsMap = guild.channels?.cache || guild.channels;
            welcomeChannel = channelsMap?.get(wm.channelId)
              ?? await guild.channels.fetch(wm.channelId).catch(() => null);
          } catch {
            welcomeChannel = null;
          }
          if (!welcomeChannel) return;

          const user = newMember.user;
          if (memberCounter.get(guild.id) === null) {
            await memberCounter.fetchAndSetMemberCount(guild.id, client);
          }
          const memberCount = memberCounter.get(guild.id) ?? 0;

          let roleName: string | null = null;
          if (wm.showRole) {
            const rid = wm.triggerRoleId || settings.autoroleId;
            if (rid) {
              const role = guild.roles?.get?.(rid);
              roleName = role?.name || null;
            }
          }

          const avatarURL = user?.displayAvatarURL?.({ size: 256, format: 'png' })
            ?? user?.avatarURL
            ?? '/assets/default-avatar.png';

          const sendOpts: any = {};
          let cardBuffer: Buffer | null = null;

          if (wm.imageEnabled !== false) {
            try {
              cardBuffer = await generateWelcomeCard({
                username:    newMember.displayName || user?.username || 'New Member',
                avatarURL,
                serverName:  guild.name,
                memberCount: memberCount || 0,
                card:        wm.card || {},
                roleName,
              });
              sendOpts.files = [{ name: 'welcome.png', data: cardBuffer }];
            } catch (err: any) {
              console.error(`[welcome] Card generation failed for ${newMember.id} in ${guild.name}: ${err.message}`);
            }
          }

          const replaceVars = (text: string) => text
            .replace(/\\n/g, '\n')
            .replace(/\{user\}/gi,   `<@${newMember.id}>`)
            .replace(/\{server\}/gi, guild.name)
            .replace(/\{count\}/gi,  String(memberCount || 0))
            .replace(/\{role\}/gi,   roleName || 'None');

          if (wm.message) {
            sendOpts.content = replaceVars(wm.message);
          } else {
            sendOpts.content = `Welcome to **${guild.name}**, <@${newMember.id}>!`;
          }

          if (wm.embed?.enabled) {
            const embConf = wm.embed;
            const embed = new EmbedBuilder();
            if (embConf.title) embed.setTitle(replaceVars(embConf.title));
            if (embConf.description) embed.setDescription(replaceVars(embConf.description));
            if (embConf.color) embed.setColor(parseInt(embConf.color.replace('#', ''), 16));
            if (embConf.footer) embed.setFooter({ text: replaceVars(embConf.footer) });
            if (embConf.thumbnail) {
              const iconURL = guild.iconURL?.({ size: 256 }) || null;
              if (iconURL) embed.setThumbnail(iconURL);
            }
            embed.setTimestamp(new Date());
            sendOpts.embeds = [embed];
          }

          if (sendOpts.content || sendOpts.files || sendOpts.embeds) {
            await welcomeChannel.send(sendOpts).catch((err: any) => {
              console.error(`[welcome] Failed to send role-triggered welcome in ${guild.name}: ${err.message}`);
            });
          }
        } catch (err: any) {
          console.error(`[guildMemberUpdate] welcome-on-role error: ${err.message}`);
        }
      }
    } catch (error) {
      console.error('Error in guildMemberUpdate event:', error);
    }
  }
};

export default event;
