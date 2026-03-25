import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { verifyWsToken } from '../middleware/wsAuth';

let wss: WebSocketServer | null = null;

const clientSubscriptions = new WeakMap<WebSocket, Set<string>>();

export interface SettingsEvent {
  event: 'settings_updated';
  guildId: string;
  timestamp: number;
}

export function broadcastSettingsUpdate(guildId: string): void {
  if (!wss || wss.clients.size === 0) return;

  const payload: SettingsEvent = {
    event: 'settings_updated',
    guildId,
    timestamp: Date.now(),
  };

  const data = JSON.stringify(payload);
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      const subs = clientSubscriptions.get(ws);
      if (subs && subs.has(guildId)) {
        ws.send(data);
      }
    }
  }
}

export function setupSettingsWebSocket(httpServer: HttpServer): void {
  wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/settings',
    verifyClient: async ({ req }, done) => {
      const userId = await verifyWsToken(req, false /* any authenticated user */);
      done(!!userId);
    },
  });

  wss.on('connection', (ws) => {
    clientSubscriptions.set(ws, new Set());

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.subscribe && typeof msg.subscribe === 'string') {
          if (!/^\d{17,20}$/.test(msg.subscribe)) return;
          const subs = clientSubscriptions.get(ws);
          if (subs && subs.size < 50) { // cap subscriptions per client
            subs.add(msg.subscribe);
          }
        }
        if (msg.unsubscribe && typeof msg.unsubscribe === 'string') {
          const subs = clientSubscriptions.get(ws);
          subs?.delete(msg.unsubscribe);
        }
      } catch { /* ignore malformed messages */ }
    });

    ws.on('close', () => {
      clientSubscriptions.delete(ws);
    });

    ws.on('error', () => {});
  });
}

export function teardownSettingsWebSocket(): void {
  if (wss) {
    for (const ws of wss.clients) ws.close();
    wss.close();
    wss = null;
  }
}
