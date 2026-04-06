import { Router, type RequestHandler } from 'express';
import type { Client } from '@erinjs/core';
import type CommandHandler from '../../handlers/CommandHandler';
import type { AuthRequest } from '../middleware/auth';

export function createBotRouter(client: Client, commandHandler: CommandHandler, requireOwner: RequestHandler): Router {
  const router = Router();

  async function getGuildCount(): Promise<number> {
    if (typeof (client as any).fetchTotalGuildCount === 'function') {
      return (client as any).fetchTotalGuildCount();
    }
    return client.guilds.size;
  }

  router.get('/info', async (req: AuthRequest, res) => {
    const base = {
      id: client.user?.id || null,
      username: client.user?.username || null,
      avatar: (client.user as any)?.avatar || null,
      uptime: process.uptime(),
      readyAt: client.readyAt?.toISOString() || null,
    };

    if (req.isOwner) {
      const guildCount = await getGuildCount();
      res.json({
        ...base,
        guilds: guildCount,
        memoryMB: +(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
      });
    } else {
      res.json(base);
    }
  });
  router.get('/commands', (_req, res) => {
    const categories = commandHandler.getCommandsByCategory();
    const result: Record<
      string,
      Array<{ name: string; description: string | string[]; usage?: string; permissions?: string[] }>
    > = {};

    for (const [category, commands] of Object.entries(categories)) {
      result[category] = commands.map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        usage: cmd.usage,
        permissions: cmd.permissions,
      }));
    }

    res.json(result);
  });

  router.get('/guilds', requireOwner, async (_req, res) => {
    res.json({ count: await getGuildCount() });
  });

  return router;
}
