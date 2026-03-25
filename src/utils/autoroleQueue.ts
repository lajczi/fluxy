// i love fluxer api cant you tell, now im going to fucking kill myself 

import fs from 'fs';
import path from 'path';
import type { Client } from '@fluxerjs/core';
import isNetworkError from './isNetworkError';

const QUEUE_FILE      = path.join(__dirname, '../../data/autorole-queue.json');
const RETRY_INTERVAL  = 60_000;
const MAX_AGE         = 24 * 60 * 60 * 1000;

interface AutoroleQueueEntry {
  guildId: string;
  userId: string;
  roleId: string;
  addedAt: number;
}

let queue: AutoroleQueueEntry[] = [];
let _client: Client | null = null;

function loadQueue(): void {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      if (!Array.isArray(queue)) queue = [];
    }
  } catch {
    queue = [];
  }
}

function saveQueue(): void {
  try {
    fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  } catch (err: any) {
    console.error('[autorole-queue] Failed to save queue:', err.message);
  }
}

export function enqueue(guildId: string, userId: string, roleId: string): void {
  const exists = queue.some(
    e => e.guildId === guildId && e.userId === userId && e.roleId === roleId,
  );
  if (exists) return;

  queue.push({ guildId, userId, roleId, addedAt: Date.now() });
  saveQueue();
  console.log(`[autorole-queue] Queued ${roleId} for user ${userId} in guild ${guildId} (${queue.length} pending)`);
}

async function processQueue(): Promise<void> {
  if (!_client || queue.length === 0) return;

  const remaining: AutoroleQueueEntry[] = [];

  for (const entry of queue) {
    if (Date.now() - entry.addedAt > MAX_AGE) {
      console.log(`[autorole-queue] Dropping stale entry for user ${entry.userId} in guild ${entry.guildId}`);
      continue;
    }

    try {
      const guild = _client.guilds.get(entry.guildId);
      if (!guild) {
        remaining.push(entry); // bot may not have guild cached yet, and if they dont then something is wrong and im going to kill somone
        continue;
      }

      let member = (guild as any).members?.get(entry.userId);
      if (!member) {
        try {
          member = await (guild as any).fetchMember(entry.userId);
        } catch {
          console.log(`[autorole-queue] User ${entry.userId} no longer in ${guild.name}, dropping`);
          continue;
        }
      }
      if (!member) continue;

      await member.addRole(entry.roleId);
      console.log(`[autorole-queue] Assigned role ${entry.roleId} to ${entry.userId} in ${guild.name}`);

    } catch (err) {
      if (isNetworkError(err)) {
        // the API IS STILL DOWN FUCK OFFFFFFFFFFFFFFFFFFFFf I FUCKING HAT E THIS HGIT
        remaining.push(entry);
      } else {
        console.warn(`[autorole-queue] Permanent error for user ${entry.userId} in guild ${entry.guildId}, dropping: ${(err as Error).message}`);
      }
    }
  }

  queue = remaining;
  saveQueue();
}

export function start(clientInstance: Client): void {
  _client = clientInstance;
  loadQueue();

  if (queue.length > 0) {
    console.log(`[autorole-queue] Loaded ${queue.length} pending autorole assignment(s) from disk`);
    setTimeout(processQueue, 10_000);
  }

  setInterval(processQueue, RETRY_INTERVAL);
}
