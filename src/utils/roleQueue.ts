import fs from 'fs';
import path from 'path';
import type { Client } from '@fluxerjs/core';
import isNetworkError from './isNetworkError';

const QUEUE_FILE     = path.join(__dirname, '../../data/role-queue.json');
const RETRY_INTERVAL = 60_000;
const MAX_AGE        = 24 * 60 * 60 * 1000;
const MAX_SIZE       = 500;

interface RoleQueueEntry {
  guildId: string;
  userId: string;
  roleId: string;
  operation: 'add' | 'remove';
  addedAt: number;
}

let queue: RoleQueueEntry[] = [];
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
    console.error('[role-queue] Failed to save queue:', err.message);
  }
}

export function enqueue(guildId: string, userId: string, roleId: string, operation: 'add' | 'remove' = 'add'): void {
  const exists = queue.some(
    e => e.guildId === guildId && e.userId === userId && e.roleId === roleId && e.operation === operation,
  );
  if (exists) return;

  if (queue.length >= MAX_SIZE) {
    queue.shift();
    console.warn('[role-queue] Queue full - oldest entry dropped');
  }

  queue.push({ guildId, userId, roleId, operation, addedAt: Date.now() });
  saveQueue();
  console.log(`[role-queue] Queued ${operation} ${roleId} for user ${userId} in guild ${guildId} (${queue.length} pending)`);
}

async function processQueue(): Promise<void> {
  if (!_client || queue.length === 0) return;

  const remaining: RoleQueueEntry[] = [];

  for (const entry of queue) {
    if (Date.now() - entry.addedAt > MAX_AGE) {
      console.log(`[role-queue] Dropping stale entry for user ${entry.userId} in guild ${entry.guildId}`);
      continue;
    }

    try {
      const guild = _client.guilds.get(entry.guildId);
      if (!guild) {
        remaining.push(entry);
        continue;
      }

      let member = (guild as any).members?.get(entry.userId);
      if (!member) {
        try {
          member = await (guild as any).fetchMember(entry.userId);
        } catch {
          console.log(`[role-queue] User ${entry.userId} no longer in ${guild.name}, dropping`);
          continue;
        }
      }
      if (!member) continue;

      if (entry.operation === 'remove') {
        await member.removeRole(entry.roleId);
        console.log(`[role-queue] Removed role ${entry.roleId} from ${entry.userId} in ${guild.name}`);
      } else {
        await member.addRole(entry.roleId);
        console.log(`[role-queue] Assigned role ${entry.roleId} to ${entry.userId} in ${guild.name}`);
      }

    } catch (err) {
      if (isNetworkError(err)) {
        remaining.push(entry);
      } else {
        console.warn(`[role-queue] Permanent error for user ${entry.userId} in guild ${entry.guildId}, dropping: ${(err as Error).message}`);
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
    console.log(`[role-queue] Loaded ${queue.length} pending role operation(s) from disk`);
    setTimeout(processQueue, 10_000);
  }

  setInterval(processQueue, RETRY_INTERVAL);
}
