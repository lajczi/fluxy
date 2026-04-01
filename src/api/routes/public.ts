import { Router } from 'express';
import type { Client } from '@fluxerjs/core';

async function getGuildCount(client: any): Promise<number> {
  if (typeof client.fetchTotalGuildCount === 'function') {
    try {
      return await client.fetchTotalGuildCount();
    } catch {}
  }
  return client.guilds?.size || 0;
}

export function createPublicRouter(client: Client): Router {
  const router = Router();

  router.get('/status', async (_req, res) => {
    const c: any = client;
    const ws = c?._ws || c?.ws;
    const wsPing = ws?.ping ?? null;
    const hasReadySession = Boolean(client.readyAt);
    const hasBotUser = Boolean(client.user);
    const online = hasBotUser && hasReadySession;
    const guilds = await getGuildCount(c);
    const gateway =
      wsPing === null || wsPing === undefined
        ? (online ? 'connected' : 'disconnected')
        : 'connected';

    const payload = {
      status: online ? 'online' : 'degraded',
      online,
      gateway,
      wsPing,
      readyAt: client.readyAt?.toISOString() || null,
      uptime: Math.floor(process.uptime()),
      guilds,
      timestamp: Date.now(),
      dashboard: 'online',
    };

    res.status(online ? 200 : 503).json(payload);
  });

  return router;
}

