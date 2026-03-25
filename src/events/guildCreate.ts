import type { BotEvent } from '../types';
import GuildSettings from '../models/GuildSettings';
import * as memberCounter from '../utils/memberCounter';
import log from '../utils/consoleLogger';

let botReady = false;
let startupGuildCount = 0;
let readyAt = 0;
const STARTUP_BURST_MS = 30000;

const initQueue: Array<{ guild: any; client: any }> = [];
const GUILD_INIT_INTERVAL_MS = 750;
let initTimer: ReturnType<typeof setInterval> | null = null;

function processNextGuildInit(): void {
  if (initQueue.length === 0) return;
  const { guild, client } = initQueue.shift()!;
  (async () => {
    try {
      const count = await memberCounter.fetchAndSetMemberCount(guild.id, client);
      if (count === null) {
        log.warn('Guild', `Member count init failed for ${guild.name || guild.id} (will show 1 on first join)`);
      }

      await (GuildSettings as any).getOrCreate(guild.id);
    } catch (error: any) {
      log.error('Guild', `Init failed for ${guild.name || guild.id}: ${error.message}`);
    }
  })();
}

function scheduleGuildInit(guild: any, client: any): void {
  initQueue.push({ guild, client });
  if (!initTimer) {
    initTimer = setInterval(() => {
      processNextGuildInit();
      if (initQueue.length === 0 && initTimer) {
        clearInterval(initTimer);
        initTimer = null;
      }
    }, GUILD_INIT_INTERVAL_MS);
  }
}

let _readyClient: any = null;

export function markReady(client?: any): void {
  if (!botReady) {
    botReady = true;
    readyAt = Date.now();
    if (client) _readyClient = client;
    if (startupGuildCount > 0) {
      log.info('Guilds', `Processed ${startupGuildCount} guild(s) from gateway`);
    }
    setTimeout(() => {
      const c = _readyClient;
      if (c?.guilds?.size) {
        const n = c.guilds.size;
        log.info('Guilds', `Starting init for ${n} guild(s) (throttled)`);
        for (const guild of c.guilds.values()) {
          initQueue.push({ guild, client: c });
        }
        if (!initTimer) {
          initTimer = setInterval(() => {
            processNextGuildInit();
            if (initQueue.length === 0 && initTimer) {
              clearInterval(initTimer);
              initTimer = null;
            }
          }, GUILD_INIT_INTERVAL_MS);
        }
      }
    }, STARTUP_BURST_MS);
  }
}

const event: BotEvent & { markReady: typeof markReady } = {
  name: 'guildCreate',
  markReady,

  async execute(guild: any, client: any) {
    await Promise.resolve();
    if (!botReady) {
      startupGuildCount++;
      return;
    }
    if (Date.now() - readyAt < STARTUP_BURST_MS) {
      return;
    }
    log.ok('Guild', `Joined new guild: ${guild.name} (${guild.id})`);
    scheduleGuildInit(guild, client);
  }
};

export default event;
