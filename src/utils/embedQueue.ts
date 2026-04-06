import type { Client } from '@erinjs/core';
import isNetworkError from './isNetworkError';

const RETRY_INTERVAL = 30_000;
const MAX_AGE        = 60 * 60_000;
const MAX_SIZE       = 500;

interface EmbedQueueEntry {
  guildId: string;
  channelId: string;
  embed: unknown;
  addedAt: number;
}

let queue: EmbedQueueEntry[] = [];
let _client: Client | null = null;

export function enqueue(guildId: string, channelId: string, embed: unknown): void {
  if (queue.length >= MAX_SIZE) {
    queue.shift();
    console.warn('[embed-queue] Queue full - oldest entry dropped');
  }
  queue.push({ guildId, channelId, embed, addedAt: Date.now() });
  console.log(`[embed-queue] Queued embed for channel ${channelId} in guild ${guildId} (${queue.length} pending)`);
}

async function processQueue(): Promise<void> {
  if (!_client || queue.length === 0) return;

  const remaining: EmbedQueueEntry[] = [];

  for (const entry of queue) {

    if (Date.now() - entry.addedAt > MAX_AGE) {
      console.log(`[embed-queue] Dropping stale embed for channel ${entry.channelId}`);
      continue;
    }

    try {
      const guild = _client.guilds.get(entry.guildId);
      if (!guild) { remaining.push(entry); continue; }

      let channel = guild.channels?.get(entry.channelId) as any;
      if (!channel) {
        try { channel = await _client.channels.fetch(entry.channelId); } catch {}
      }
      if (!channel) { remaining.push(entry); continue; }

      await channel.send({ embeds: [entry.embed] });
      console.log(`[embed-queue] Sent queued embed to channel ${entry.channelId}`);
    } catch (err) {
      if (isNetworkError(err)) {
        remaining.push(entry);
      } else {
        console.warn(`[embed-queue] Permanent error for ${entry.channelId}, dropping: ${(err as any).code || (err as Error).message}`);
      }
    }
  }

  queue = remaining;
}

export function start(clientInstance: Client): void {
  _client = clientInstance;
  setInterval(processQueue, RETRY_INTERVAL);
}
