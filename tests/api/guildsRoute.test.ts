import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { Routes } from '@erinjs/types';

import { createGuildsRouter } from '../../src/api/routes/guilds';

function createApp(client: any) {
  const app = express();
  app.use(express.json());
  const requireGuildAccess: RequestHandler = (_req, _res, next) => next();
  app.use('/api/guilds', createGuildsRouter(client, requireGuildAccess));
  return app;
}

describe('guilds route hydration', () => {
  test('GET /:id refreshes channels and roles from REST when cache is partial', async () => {
    const restGet = jest.fn(async (path: string) => {
      if (path === Routes.guildChannels('g1')) {
        return [
          { id: 'cat-main', name: 'Main', type: 4, parent_id: null, position: 0 },
          { id: 'c-rules', name: 'rules', type: 0, parent_id: 'cat-main', position: 0 },
          { id: 'c-welcome', name: 'welcome', type: 0, parent_id: null, position: 1 },
        ];
      }
      if (path === Routes.guildRoles('g1')) {
        return [
          { id: 'r-everyone', name: '@everyone', color: 0, position: 0 },
          { id: 'r-mod', name: 'Moderator', color: 1337, position: 10 },
          { id: 'r-helper', name: 'Helper', color: 4242, position: 5 },
        ];
      }
      if (path === '/guilds/g1/emojis') {
        return [];
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const cachedGuild = {
      id: 'g1',
      name: 'Guild One',
      icon: null,
      ownerId: 'owner-1',
      channels: new Map([['c-rules', { id: 'c-rules', name: 'rules', type: 0, parent_id: 'cat-main', position: 0 }]]),
      roles: new Map([['r-everyone', { id: 'r-everyone', name: '@everyone', color: 0, position: 0 }]]),
      emojis: new Map(),
    };

    const client = {
      guilds: new Map([['g1', cachedGuild]]),
      rest: { get: restGet },
    } as any;

    const app = createApp(client);
    const res = await request(app).get('/api/guilds/g1');

    expect(res.status).toBe(200);
    expect(res.body.channels.map((ch: any) => ch.id)).toEqual(['cat-main', 'c-rules', 'c-welcome']);
    expect(res.body.roles.map((role: any) => role.id)).toEqual(['r-everyone', 'r-mod', 'r-helper']);

    expect(restGet).toHaveBeenCalledWith(Routes.guildChannels('g1'));
    expect(restGet).toHaveBeenCalledWith(Routes.guildRoles('g1'));
  });

  test('GET /:id falls back to cached channels and roles if REST refresh fails', async () => {
    const restGet = jest.fn(async (path: string) => {
      if (path === Routes.guildChannels('g1') || path === Routes.guildRoles('g1') || path === '/guilds/g1/emojis') {
        throw new Error('temporary API failure');
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const cachedGuild = {
      id: 'g1',
      name: 'Guild One',
      icon: null,
      ownerId: 'owner-1',
      channels: new Map([
        ['c-rules', { id: 'c-rules', name: 'rules', type: 0, parent_id: 'cat-main', position: 0 }],
        ['c-welcome', { id: 'c-welcome', name: 'welcome', type: 0, parent_id: null, position: 1 }],
      ]),
      roles: new Map([
        ['r-everyone', { id: 'r-everyone', name: '@everyone', color: 0, position: 0 }],
        ['r-mod', { id: 'r-mod', name: 'Moderator', color: 1337, position: 10 }],
      ]),
      emojis: new Map(),
    };

    const client = {
      guilds: new Map([['g1', cachedGuild]]),
      rest: { get: restGet },
    } as any;

    const app = createApp(client);
    const res = await request(app).get('/api/guilds/g1');

    expect(res.status).toBe(200);
    expect(res.body.channels.map((ch: any) => ch.id)).toEqual(['c-rules', 'c-welcome']);
    expect(res.body.roles.map((role: any) => role.id)).toEqual(['r-everyone', 'r-mod']);
  });

  test('GET /:id falls back to the global client channel cache when the guild cache was emptied', async () => {
    const restGet = jest.fn(async (path: string) => {
      if (path === Routes.guildChannels('g1') || path === Routes.guildRoles('g1') || path === '/guilds/g1/emojis') {
        throw new Error('temporary API failure');
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const cachedGuild = {
      id: 'g1',
      name: 'Guild One',
      icon: null,
      ownerId: 'owner-1',
      channels: new Map(),
      roles: new Map([['r-everyone', { id: 'r-everyone', name: '@everyone', color: 0, position: 0 }]]),
      emojis: new Map(),
    };

    const client = {
      guilds: new Map([['g1', cachedGuild]]),
      channels: new Map([
        ['cat-main', { id: 'cat-main', name: 'Main', type: 4, guildId: 'g1', parent_id: null, position: 0 }],
        ['c-rules', { id: 'c-rules', name: 'rules', type: 0, guildId: 'g1', parent_id: 'cat-main', position: 0 }],
        ['c-other', { id: 'c-other', name: 'other', type: 0, guildId: 'g2', parent_id: null, position: 0 }],
      ]),
      rest: { get: restGet },
    } as any;

    const app = createApp(client);
    const res = await request(app).get('/api/guilds/g1');

    expect(res.status).toBe(200);
    expect(res.body.channels.map((ch: any) => ch.id)).toEqual(['cat-main', 'c-rules']);
  });
});
