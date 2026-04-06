/**
node build/shardManager.js
TOTAL_SHARDS=4 node build/shardManager.js
SHARDS_PER_WORKER=2 node build/shardManager.js
 */

import { fork, type ChildProcess } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// ANSI helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bRed: '\x1b[91m',
  bGreen: '\x1b[92m',
  bYellow: '\x1b[93m',
  bCyan: '\x1b[96m',
};

function timestamp(): string {
  const d = new Date();
  return `${c.gray}${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}${c.reset}`;
}

function log(level: string, tag: string, msg: string): void {
  const colors: Record<string, string> = {
    info: c.bCyan,
    ok: c.bGreen,
    warn: c.bYellow,
    error: c.bRed,
    fatal: `${c.bold}${c.bRed}`,
  };
  const labels: Record<string, string> = {
    info: 'INF',
    ok: ' OK',
    warn: 'WRN',
    error: 'ERR',
    fatal: 'FTL',
  };
  const color = colors[level] || c.bCyan;
  const label = labels[level] || 'INF';
  console.log(`${timestamp()} ${color}${label}${c.reset} ${c.blue}[${tag}]${c.reset} ${msg}`);
}

// Configuration
const SHARDS_PER_WORKER = parseInt(process.env.SHARDS_PER_WORKER || '1', 10);
const WORKER_SCRIPT = path.join(__dirname, 'index.js');
const RESPAWN_DELAY = 5000;
const MAX_RESPAWNS = 10;
const STABLE_THRESHOLD = 30 * 60 * 1000;

interface WorkerInfo {
  process: ChildProcess | null;
  shardIds: number[];
  respawnCount: number;
  lastSpawn: number;
  ready: boolean;
  readyShardIds: Set<number>;
}

const workers: Map<number, WorkerInfo> = new Map();
let totalShards = 0;
let isShuttingDown = false;

// DM dedupe
const processedDMIds = new Map<string, number>();
const DM_DEDUPE_TTL = 15_000;

function pruneProcessedDMs(): void {
  const now = Date.now();
  if (processedDMIds.size < 200) return;
  for (const [id, t] of [...processedDMIds]) {
    if (now - t > DM_DEDUPE_TTL) processedDMIds.delete(id);
  }
}

async function getRecommendedShards(): Promise<number> {
  const token = process.env.TOKEN;
  if (!token) {
    log('fatal', 'Manager', 'TOKEN env var is required');
    process.exit(1);
  }

  const explicit = process.env.TOTAL_SHARDS;
  if (explicit && explicit !== 'auto') {
    const count = parseInt(explicit, 10);
    if (count > 0) {
      log('info', 'Manager', `Using explicit shard count: ${count}`);
      return count;
    }
  }

  try {
    const res = await fetch('https://api.fluxer.app/v1/gateway/bot', {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as any;
    const shards = data?.shards ?? 1;
    const limit = data?.session_start_limit;
    log('info', 'Manager', `Gateway recommends ${shards} shard(s)`);
    if (limit) {
      log(
        'info',
        'Manager',
        `Session limit: ${limit.remaining}/${limit.total}, max_concurrency: ${limit.max_concurrency}`,
      );
    }
    return shards;
  } catch (err: any) {
    log('warn', 'Manager', `Failed to fetch gateway info: ${err.message}. Defaulting to 1 shard.`);
    return 1;
  }
}

function spawnWorker(workerId: number, shardIds: number[]): ChildProcess {
  const shardLabel = shardIds.length === 1 ? `shard ${shardIds[0]}` : `shards ${shardIds.join(',')}`;
  log('info', 'Manager', `Spawning worker ${workerId} (${shardLabel})`);

  const child = fork(WORKER_SCRIPT, [], {
    env: {
      ...process.env,
      SHARD_IDS: shardIds.join(','),
      TOTAL_SHARDS: String(totalShards),
      WORKER_ID: String(workerId),
      ...(workerId > 0 && process.env.SHARD_API_ALL !== 'true' ? { API_ENABLED: 'false' } : {}),
    },
    stdio: ['pipe', 'inherit', 'inherit', 'ipc'],
  });

  child.on('message', (msg: any) => handleWorkerMessage(workerId, msg));
  child.on('exit', (code, signal) => handleWorkerExit(workerId, code, signal));

  return child;
}

function handleWorkerMessage(workerId: number, msg: any): void {
  if (!msg || typeof msg !== 'object') return;

  switch (msg.type) {
    case 'shardReady': {
      const worker = workers.get(workerId);
      if (worker) {
        worker.readyShardIds.add(msg.shardId);
        worker.ready = worker.readyShardIds.size >= worker.shardIds.length;
      }
      log('ok', 'Manager', `Worker ${workerId} shard ${msg.shardId} ready`);
      break;
    }

    case 'requestGuildCount': {
      broadcastGuildCount(workerId, msg.requestId);
      break;
    }

    case 'requestEval': {
      broadcastEval(workerId, msg.requestId, msg.script);
      break;
    }

    case 'requestShardInfo': {
      broadcastShardInfo(workerId, msg.requestId);
      break;
    }

    case 'requestStats': {
      broadcastStats(workerId, msg.requestId);
      break;
    }

    case 'requestDMProcess': {
      const messageId = msg.messageId;
      if (!messageId || typeof messageId !== 'string') break;
      const worker = workers.get(workerId);
      if (!worker?.process) break;
      const already = processedDMIds.has(messageId);
      if (!already) {
        processedDMIds.set(messageId, Date.now());
        pruneProcessedDMs();
      }
      worker.process.send({ type: 'dmProcessResponse', messageId, granted: !already });
      break;
    }

    case 'requestGuildIds': {
      broadcastGuildIds(workerId, msg.requestId);
      break;
    }

    case 'guildCountResponse': {
      break;
    }

    case 'shardInfoResponse': {
      break;
    }

    case 'statsResponse': {
      break;
    }

    case 'guildIdsResponse': {
      break;
    }

    case 'evalResponse': {
      break;
    }
  }
}

async function broadcastGuildCount(requestingWorkerId: number, requestId: string): Promise<void> {
  let total = 0;
  const promises: Promise<number>[] = [];

  for (const [, worker] of workers) {
    if (!worker.process || !worker.ready) continue;
    promises.push(
      new Promise<number>((resolve) => {
        const timeout = setTimeout(() => resolve(0), 5000);
        const handler = (msg: any) => {
          if (msg?.type === 'guildCountResponse' && msg.requestId === requestId) {
            clearTimeout(timeout);
            worker.process!.off('message', handler);
            resolve(msg.count || 0);
          }
        };
        worker.process!.on('message', handler);
        worker.process!.send({ type: 'requestGuildCount', requestId });
      }),
    );
  }

  const counts = await Promise.all(promises);
  total = counts.reduce((a, b) => a + b, 0);

  const requesting = workers.get(requestingWorkerId);
  if (requesting?.process) {
    requesting.process.send({ type: 'totalGuildCount', requestId, count: total });
  }
}

async function broadcastShardInfo(requestingWorkerId: number, requestId: string): Promise<void> {
  const infos: any[] = [];

  for (const [id, worker] of workers) {
    if (!worker.process || !worker.ready) {
      infos.push({
        workerId: id,
        shardIds: worker.shardIds,
        status: worker.process ? 'connecting' : 'offline',
        guilds: 0,
        memory: 0,
        uptime: 0,
        ping: null,
      });
      continue;
    }
    const info = await new Promise<any>((resolve) => {
      const timeout = setTimeout(
        () =>
          resolve({
            workerId: id,
            shardIds: worker.shardIds,
            status: 'timeout',
            guilds: 0,
            memory: 0,
            uptime: 0,
            ping: null,
          }),
        5000,
      );
      const handler = (msg: any) => {
        if (msg?.type === 'shardInfoResponse' && msg.requestId === requestId) {
          clearTimeout(timeout);
          worker.process!.off('message', handler);
          resolve({ ...msg.info, workerId: id });
        }
      };
      worker.process!.on('message', handler);
      worker.process!.send({ type: 'requestShardInfo', requestId });
    });
    infos.push(info);
  }

  const requesting = workers.get(requestingWorkerId);
  if (requesting?.process) {
    requesting.process.send({ type: 'allShardInfo', requestId, shards: infos });
  }
}

async function broadcastStats(requestingWorkerId: number, requestId: string): Promise<void> {
  let totalGuilds = 0;
  let totalMembers = 0;
  let totalMemory = 0;
  let minUptime = Infinity;

  for (const [, worker] of workers) {
    if (!worker.process || !worker.ready) continue;
    const stats = await new Promise<{ guilds: number; members: number; memory: number; uptime: number }>((resolve) => {
      const timeout = setTimeout(() => resolve({ guilds: 0, members: 0, memory: 0, uptime: 0 }), 30000);
      const handler = (msg: any) => {
        if (msg?.type === 'statsResponse' && msg.requestId === requestId) {
          clearTimeout(timeout);
          worker.process!.off('message', handler);
          resolve({
            guilds: msg.guilds ?? 0,
            members: msg.members ?? 0,
            memory: msg.memory ?? 0,
            uptime: msg.uptime ?? 0,
          });
        }
      };
      worker.process!.on('message', handler);
      worker.process!.send({ type: 'requestStats', requestId });
    });
    totalGuilds += stats.guilds;
    totalMembers += stats.members;
    totalMemory += stats.memory;
    if (stats.uptime > 0 && stats.uptime < minUptime) minUptime = stats.uptime;
  }

  const requesting = workers.get(requestingWorkerId);
  if (requesting?.process) {
    requesting.process.send({
      type: 'allStats',
      requestId,
      guilds: totalGuilds,
      members: totalMembers,
      memory: totalMemory,
      uptime: minUptime === Infinity ? 0 : minUptime,
    });
  }
}

async function broadcastGuildIds(requestingWorkerId: number, requestId: string): Promise<void> {
  const allGuildIds: string[] = [];

  for (const [, worker] of workers) {
    if (!worker.process || !worker.ready) continue;
    const ids = await new Promise<string[]>((resolve) => {
      const timeout = setTimeout(() => resolve([]), 5000);
      const handler = (msg: any) => {
        if (msg?.type === 'guildIdsResponse' && msg.requestId === requestId) {
          clearTimeout(timeout);
          worker.process!.off('message', handler);
          resolve(msg.guildIds || []);
        }
      };
      worker.process!.on('message', handler);
      worker.process!.send({ type: 'requestGuildIds', requestId });
    });
    allGuildIds.push(...ids);
  }

  const requesting = workers.get(requestingWorkerId);
  if (requesting?.process) {
    requesting.process.send({ type: 'allGuildIds', requestId, guildIds: allGuildIds });
  }
}

async function broadcastEval(requestingWorkerId: number, requestId: string, script: string): Promise<void> {
  const results: any[] = [];

  for (const [, worker] of workers) {
    if (!worker.process || !worker.ready) continue;
    const result = await new Promise<any>((resolve) => {
      const timeout = setTimeout(() => resolve({ error: 'timeout' }), 10000);
      const handler = (msg: any) => {
        if (msg?.type === 'evalResponse' && msg.requestId === requestId) {
          clearTimeout(timeout);
          worker.process!.off('message', handler);
          resolve(msg.result);
        }
      };
      worker.process!.on('message', handler);
      worker.process!.send({ type: 'requestEval', requestId, script });
    });
    results.push(result);
  }

  const requesting = workers.get(requestingWorkerId);
  if (requesting?.process) {
    requesting.process.send({ type: 'evalResults', requestId, results });
  }
}

function handleWorkerExit(workerId: number, code: number | null, signal: string | null): void {
  const worker = workers.get(workerId);
  if (!worker) return;

  worker.process = null;
  worker.ready = false;
  worker.readyShardIds.clear();

  if (isShuttingDown) {
    log('info', 'Manager', `Worker ${workerId} exited (shutdown)`);
    return;
  }

  const shardLabel =
    worker.shardIds.length === 1 ? `shard ${worker.shardIds[0]}` : `shards ${worker.shardIds.join(',')}`;
  log('warn', 'Manager', `Worker ${workerId} (${shardLabel}) exited with code ${code} signal ${signal}`);

  if (Date.now() - worker.lastSpawn > STABLE_THRESHOLD) {
    worker.respawnCount = 0;
  }

  if (worker.respawnCount >= MAX_RESPAWNS) {
    log('fatal', 'Manager', `Worker ${workerId} exceeded ${MAX_RESPAWNS} respawns. Not restarting.`);
    return;
  }

  worker.respawnCount++;
  const delay = RESPAWN_DELAY * Math.min(worker.respawnCount, 5); // escalating delay

  log(
    'info',
    'Manager',
    `Respawning worker ${workerId} in ${delay}ms (attempt ${worker.respawnCount}/${MAX_RESPAWNS})`,
  );
  setTimeout(() => {
    if (isShuttingDown) return;
    worker.lastSpawn = Date.now();
    worker.process = spawnWorker(workerId, worker.shardIds);
  }, delay);
}

function waitForWorkerReady(wId: number): Promise<void> {
  return new Promise((resolve) => {
    const MAX_WAIT = 120_000;
    const timer = setTimeout(() => {
      log('warn', 'Manager', `Worker ${wId} did not become ready in ${MAX_WAIT / 1000}s, proceeding anyway`);
      resolve();
    }, MAX_WAIT);

    const check = () => {
      const w = workers.get(wId);
      if (w?.ready) {
        clearTimeout(timer);
        resolve();
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
}

// Main
async function main(): Promise<void> {
  console.log(`\n${c.bold}${c.bCyan}Fluxy Shard Manager${c.reset}  ${c.gray}v2.0.0${c.reset}\n`);

  totalShards = await getRecommendedShards();

  const workerCount = Math.ceil(totalShards / SHARDS_PER_WORKER);
  log(
    'info',
    'Manager',
    `Launching ${workerCount} worker(s) for ${totalShards} shard(s) (${SHARDS_PER_WORKER} per worker)`,
  );

  for (let w = 0; w < workerCount; w++) {
    const startShard = w * SHARDS_PER_WORKER;
    const endShard = Math.min(startShard + SHARDS_PER_WORKER, totalShards);
    const shardIds = Array.from({ length: endShard - startShard }, (_, i) => startShard + i);

    workers.set(w, {
      process: null,
      shardIds,
      respawnCount: 0,
      lastSpawn: Date.now(),
      ready: false,
      readyShardIds: new Set<number>(),
    });
  }

  for (const [wId, worker] of workers) {
    worker.lastSpawn = Date.now();
    worker.process = spawnWorker(wId, worker.shardIds);

    if (wId < workerCount - 1) {
      log('info', 'Manager', `Waiting for worker ${wId} to become ready before spawning next...`);
      await waitForWorkerReady(wId);
      const READY_BUFFER = 6000;
      log('info', 'Manager', `Worker ${wId} ready, waiting ${READY_BUFFER}ms buffer...`);
      await new Promise((r) => setTimeout(r, READY_BUFFER));
    }
  }

  log('ok', 'Manager', `All ${workerCount} workers spawned`);
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('info', 'Manager', `Received ${signal} - shutting down workers...`);

  const exitPromises: Promise<void>[] = [];

  for (const [id, worker] of workers) {
    if (!worker.process) continue;
    exitPromises.push(
      new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          log('warn', 'Manager', `Worker ${id} didn't exit in time, killing`);
          worker.process?.kill('SIGKILL');
          resolve();
        }, 10000);

        worker.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });

        worker.process!.kill(signal as NodeJS.Signals);
      }),
    );
  }

  await Promise.all(exitPromises);
  log('ok', 'Manager', 'All workers stopped. Exiting.');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  log('fatal', 'Manager', `Startup failed: ${err.message}`);
  process.exit(1);
});
