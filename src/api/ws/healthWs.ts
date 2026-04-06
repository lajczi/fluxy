import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type { Client } from '@erinjs/core';
import pidusage from 'pidusage';
import os from 'os';
import { verifyWsToken } from '../middleware/wsAuth';

const BROADCAST_INTERVAL_MS = 5000;

let wss: WebSocketServer | null = null;
let broadcastTimer: ReturnType<typeof setInterval> | null = null;

export interface HealthMetrics {
  timestamp: number;
  uptime: number;
  online: boolean;
  wsPing: number | null;
  cpu: number;
  memoryMB: number;
  memoryTotalMB: number;
  rssMB: number;
  hostUsedMemoryMB: number;
  hostTotalMemoryMB: number;
  loadAvg: number[];
}

async function collectMetrics(client: Client): Promise<HealthMetrics> {
  let cpu = 0;
  try {
    const usage = await pidusage(process.pid);
    cpu = +usage.cpu.toFixed(1);
  } catch {}

  const mem = process.memoryUsage();
  const ws = (client as any)._ws || (client as any).ws;
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  return {
    timestamp: Date.now(),
    uptime: process.uptime(),
    online: !!client.user,
    wsPing: ws?.ping ?? null,
    cpu,
    memoryMB: +(mem.heapUsed / 1024 / 1024).toFixed(1),
    memoryTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(1),
    rssMB: +(mem.rss / 1024 / 1024).toFixed(1),
    hostUsedMemoryMB: +((totalMem - freeMem) / 1024 / 1024).toFixed(0),
    hostTotalMemoryMB: +(totalMem / 1024 / 1024).toFixed(0),
    loadAvg: os.loadavg(),
  };
}

function broadcast(data: string): void {
  if (!wss) return;
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

export function setupHealthWebSocket(httpServer: HttpServer, client: Client): void {
  wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/health',
    verifyClient: async ({ req }, done) => {
      const userId = await verifyWsToken(req, true /* owner-only */);
      done(!!userId);
    },
  });

  wss.on('connection', async (ws) => {
    try {
      const metrics = await collectMetrics(client);
      ws.send(JSON.stringify(metrics));
    } catch {}

    ws.on('error', () => {});
  });

  broadcastTimer = setInterval(async () => {
    if (!wss || wss.clients.size === 0) return;
    try {
      const metrics = await collectMetrics(client);
      broadcast(JSON.stringify(metrics));
    } catch {}
  }, BROADCAST_INTERVAL_MS);
}

export function teardownHealthWebSocket(): void {
  if (broadcastTimer) {
    clearInterval(broadcastTimer);
    broadcastTimer = null;
  }
  if (wss) {
    for (const ws of wss.clients) ws.close();
    wss.close();
    wss = null;
  }
}
