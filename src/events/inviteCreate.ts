import type { BotEvent } from '../types';
import { logServerEvent } from '../utils/logger';

const recentInviteLog = new Map<string, number>();
const DEDUPE_MS = 120_000;

function dedupeKey(guildId: string, code: string): string {
  return `${guildId}:${code}`;
}

function shouldEmitLog(guildId: string, code: string): boolean {
  const k = dedupeKey(guildId, code);
  const now = Date.now();
  for (const [key, t] of recentInviteLog) {
    if (now - t > DEDUPE_MS) recentInviteLog.delete(key);
  }
  if (recentInviteLog.has(k)) return false;
  recentInviteLog.set(k, now);
  return true;
}

export type InviteLogMeta = { synthetic?: boolean };

export async function logInviteCreateFromInvite(
  invite: any,
  client: any,
  meta?: InviteLogMeta
): Promise<void> {
  const guildId = invite.guild?.id ?? invite.guildId;
  if (!guildId) return;

  const code = invite.code ?? 'unknown';
  if (!shouldEmitLog(String(guildId), String(code))) return;

  const guild = client.guilds.get(guildId);
  if (!guild) return;

  const channelId = invite.channel?.id ?? invite.channelId;
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Code', value: String(code), inline: true },
    { name: 'Channel', value: channelId ? `<#${channelId}>` : 'Unknown', inline: true },
  ];

  if (meta?.synthetic) {
    fields.push({ name: 'Source', value: 'Poll (gateway payload was empty or unreliable)', inline: false });
  }

  if (invite.inviter) {
    fields.push({
      name: 'Created By',
      value: `<@${invite.inviter.id}> (${invite.inviter.username ?? invite.inviter.id})`,
      inline: true,
    });
  }

  if (invite.maxAge !== null && invite.maxAge !== undefined) {
    const expiry = invite.maxAge === 0 ? 'Never' : `${invite.maxAge} seconds`;
    fields.push({ name: 'Expires', value: expiry, inline: true });
  }

  if (invite.maxUses !== null && invite.maxUses !== undefined) {
    fields.push({
      name: 'Max Uses',
      value: invite.maxUses === 0 ? 'Unlimited' : String(invite.maxUses),
      inline: true,
    });
  }

  await logServerEvent(
    guild,
    'Invite Created',
    0x2ecc71,
    fields,
    client,
    { footer: `Invite Code: ${code}`, eventType: 'invite_create' }
  );
}

const event: BotEvent = {
  name: 'inviteCreate',

  async execute(invite: any, client: any) {
    try {
      await logInviteCreateFromInvite(invite, client);
    } catch (error) {
      console.error('Error in inviteCreate event:', error);
    }
  },
};

export default event;
