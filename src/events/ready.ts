// oh yea. im ready. are you ready? im ready to be ready. let me just get ready real quick and then we can get this ready party started. its gonna be so ready, you wont even believe how ready it is. im talking next level ready, like so ready it should be illegal. but its not, because im a responsible bot owner and i know how to be ready without breaking any laws. so get ready, because this bot is about to be the most ready thing youve ever seen. are you ready for it? because im ready to show you what ready really means. just kidding im not ready thanks for reading dickwad

import type { BotEvent } from '../types';
import * as autoroleQueue from '../utils/autoroleQueue';
import * as embedQueue from '../utils/embedQueue';
import * as roleQueue from '../utils/roleQueue';
import * as moderationQueue from '../utils/moderationQueue';
import * as messageDeleteQueue from '../utils/messageDeleteQueue';
import settingsCache from '../utils/settingsCache';
import GuildSettings from '../models/GuildSettings';
import log from '../utils/consoleLogger';
import rssPollerService from '../services/RssPollerService';
import guildCreate from './guildCreate';

async function warmSettingsCache(client: any): Promise<void> {
  const guildIds = [...(client.guilds?.keys() || [])];
  if (!guildIds.length) return;

  const start = Date.now();
  const BATCH_SIZE = 100;
  let loaded = 0;

  for (let i = 0; i < guildIds.length; i += BATCH_SIZE) {
    const batch = guildIds.slice(i, i + BATCH_SIZE);
    try {
      const docs = await GuildSettings.find({ guildId: { $in: batch } }).lean();
      for (const doc of docs) {
        settingsCache.set((doc as any).guildId, doc);
        loaded++;
      }
    } catch (err: any) {
      log.warn('Cache', `Warm batch failed: ${err.message}`);
    }
    if (i + BATCH_SIZE < guildIds.length) {
      await new Promise(r => setImmediate(r));
    }
  }

  log.ok('Cache', `Warmed ${loaded}/${guildIds.length} guild settings (${Date.now() - start}ms)`);
}

const HEARTBEAT_INTERVAL = 5 * 60 * 1000;

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function printStatus(client: any, startedAt: number): void {
  const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  const uptime = formatUptime(Date.now() - startedAt);
  const guilds = client.guilds?.size || 0;
  const cache = settingsCache.getStats();

  log.box('Fluxy', [
    { label: 'Status',     value: 'Online' },
    { label: 'Uptime',     value: uptime },
    { label: 'Guilds',     value: String(guilds) },
    { label: 'Memory',     value: `${memMB} MB` },
    { label: 'Cache',      value: `${(cache as any).validEntries}/${guilds} guilds cached` },
  ]);
}

async function updatePresence(client: any): Promise<void> {
  let guilds: number;
  if (typeof client.fetchTotalGuildCount === 'function') {
    guilds = await client.fetchTotalGuildCount();
  } else {
    guilds = client.guilds?.size || 0;
  }
  if (client._presenceRef?.custom_status) {
    client._presenceRef.custom_status.text = `Watching ${guilds} servers`;
  }
}

const event: BotEvent = {
  name: 'ready',
  once: true,

  execute(client: any) {
    guildCreate.markReady(client);

    const startedAt = Date.now();

    printStatus(client, startedAt);

    const DEFER_MS = 25000;
    setTimeout(() => {
      autoroleQueue.start(client);
      embedQueue.start(client);
      roleQueue.start(client);
      moderationQueue.start(client);
      messageDeleteQueue.start(client);
      rssPollerService.start(client);
      log.ok('Startup', `Queues started`);

      warmSettingsCache(client).catch((err: any) => {
        log.warn('Cache', `Warm failed: ${err.message}`);
      });

      updatePresence(client).catch(() => {});
    }, DEFER_MS);

    setInterval(() => {
      printStatus(client, startedAt);
      updatePresence(client).catch(() => {});
    }, HEARTBEAT_INTERVAL);
  }
};

export default event;
