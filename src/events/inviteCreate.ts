import type { BotEvent } from '../types';
import { logServerEvent } from '../utils/logger';

const event: BotEvent = {
  name: 'inviteCreate',

  async execute(invite: any, client: any) {
    try {
      const guildId = invite.guildId ?? invite.guild?.id;
      if (!guildId) return;

      const guild = client.guilds.get(guildId);
      if (!guild) return;

      const fields: { name: string; value: string; inline?: boolean }[] = [
        { name: 'Code', value: invite.code ?? 'Unknown', inline: true },
        { name: 'Channel', value: invite.channelId ? `<#${invite.channelId}>` : 'Unknown', inline: true },
      ];

      if (invite.inviter) {
        fields.push({ name: 'Created By', value: `<@${invite.inviter.id}> (${invite.inviter.username ?? invite.inviter.id})`, inline: true });
      }

      if (invite.maxAge !== null) {
        const expiry = invite.maxAge === 0 ? 'Never' : `${invite.maxAge} seconds`;
        fields.push({ name: 'Expires', value: expiry, inline: true });
      }

      if (invite.maxUses !== null) {
        fields.push({ name: 'Max Uses', value: invite.maxUses === 0 ? 'Unlimited' : String(invite.maxUses), inline: true });
      }

      await logServerEvent(
        guild,
        'Invite Created',
        0x2ecc71,
        fields,
        client,
        { footer: `Invite Code: ${invite.code ?? 'unknown'}`, eventType: 'invite_create' }
      );
    } catch (error) {
      console.error('Error in inviteCreate event:', error);
    }
  }
};

export default event;
