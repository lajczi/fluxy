import type { Client } from '@fluxerjs/core';
import { Routes } from '@fluxerjs/core';
import isNetworkError from './isNetworkError';

const RETRY_INTERVAL = 15_000;
const MAX_AGE        = 10 * 60_000;
const MAX_SIZE       = 200;

interface DeleteQueueEntry {
  channelId: string;
  messageId: string;
  addedAt: number;
}

let queue: DeleteQueueEntry[] = [];
let _client: Client | null = null;

export function enqueue(channelId: string, messageId: string): void {
  const exists = queue.some(
    e => e.channelId === channelId && e.messageId === messageId,
  );
  if (exists) return;

  if (queue.length >= MAX_SIZE) {
    queue.shift();
    console.warn('[delete-queue] Queue full - oldest entry dropped');
  }

  queue.push({ channelId, messageId, addedAt: Date.now() });
  console.log(`[delete-queue] Queued delete for message ${messageId} in channel ${channelId} (${queue.length} pending)`);
}

async function processQueue(): Promise<void> {
  if (!_client || queue.length === 0) return;

  const remaining: DeleteQueueEntry[] = [];

  for (const entry of queue) {
    if (Date.now() - entry.addedAt > MAX_AGE) {
      console.log(`[delete-queue] Dropping stale delete for message ${entry.messageId}`);
      continue;
    }

    try {
      await _client.rest.delete(Routes.channelMessage(entry.channelId, entry.messageId));
      console.log(`[delete-queue] Deleted message ${entry.messageId} in channel ${entry.channelId}`);
    } catch (err: any) {
      if (isNetworkError(err)) {
        remaining.push(entry);
      } else {
        // 404 = already deleted, 403 = no perms
        if (err.status !== 404) {
          console.warn(`[delete-queue] Permanent error deleting message ${entry.messageId}, dropping: ${err.message}`);
        }
      }
    }
  }

  queue = remaining;
}

export function start(clientInstance: Client): void {
  _client = clientInstance;
  setInterval(processQueue, RETRY_INTERVAL);
}
