import express, { type RequestHandler } from 'express';
import request from 'supertest';

const mockFetchFeed = jest.fn();
const mockGetOrCreate = jest.fn();
const mockRssStateFind = jest.fn();

jest.mock('../../src/config', () => ({
  __esModule: true,
  default: {
    rss: {
      fetchTimeoutMs: 7000,
      maxBodyBytes: 1024 * 1024,
      rsshubBaseUrl: 'https://rsshub.local',
      rsshubAccessKey: 'secret-key',
    },
  },
}));

jest.mock('../../src/utils/rssFeed', () => ({
  fetchFeed: (...args: any[]) => mockFetchFeed(...args),
}));

jest.mock('../../src/utils/settingsCache', () => ({
  __esModule: true,
  default: {
    getOrCreate: (...args: any[]) => mockGetOrCreate(...args),
  },
}));

jest.mock('../../src/models/RssFeedState', () => ({
  __esModule: true,
  default: {
    find: (...args: any[]) => mockRssStateFind(...args),
  },
}));

import { createGuildsRouter } from '../../src/api/routes/guilds';

function createApp() {
  const app = express();
  app.use(express.json());

  const client = {
    guilds: new Map(),
  } as any;

  const requireGuildAccess: RequestHandler = (_req, _res, next) => next();
  app.use('/api/guilds', createGuildsRouter(client, requireGuildAccess));

  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RSS routes', () => {
  test('POST /:id/rss/test rejects rss source without url', async () => {
    const app = createApp();

    const res = await request(app).post('/api/guilds/g1/rss/test').send({ sourceType: 'rss' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('url is required');
  });

  test('POST /:id/rss/test rejects rsshub source without route', async () => {
    const app = createApp();

    const res = await request(app).post('/api/guilds/g1/rss/test').send({ sourceType: 'rsshub' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('route is required');
  });

  test('POST /:id/rss/test returns feed preview and passes options to fetchFeed', async () => {
    const app = createApp();

    mockFetchFeed.mockResolvedValue({
      feedUrl: 'https://example.com/feed.xml',
      title: 'Fluxy News',
      link: 'https://example.com',
      description: 'latest updates',
      etag: null,
      lastModified: null,
      notModified: false,
      items: [
        {
          key: 'item-1',
          title: 'Release 2.0',
          link: 'https://example.com/releases/2',
          description: null,
          publishedAt: new Date('2026-03-20T00:00:00.000Z'),
          author: 'Fluxy Team',
          imageUrl: null,
        },
      ],
    });

    const res = await request(app)
      .post('/api/guilds/g1/rss/test')
      .send({ sourceType: 'rss', url: 'https://example.com/feed.xml' });

    expect(res.status).toBe(200);
    expect(res.body.guildId).toBe('g1');
    expect(res.body.itemCount).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      key: 'item-1',
      title: 'Release 2.0',
      link: 'https://example.com/releases/2',
      author: 'Fluxy Team',
    });

    expect(mockFetchFeed).toHaveBeenCalledWith(
      {
        sourceType: 'rss',
        url: 'https://example.com/feed.xml',
        route: null,
      },
      expect.any(Object),
    );

    const [, options] = mockFetchFeed.mock.calls[0];
    expect(options).toMatchObject({
      timeoutMs: 7000,
      maxBodyBytes: 1024 * 1024,
      rsshubBaseUrl: 'https://rsshub.local',
      rsshubAccessKey: 'secret-key',
    });
  });

  test('GET /:id/rss/status returns empty list when no feeds configured', async () => {
    const app = createApp();
    mockGetOrCreate.mockResolvedValue({
      guildId: 'g1',
      rss: {
        enabled: true,
        pollIntervalMinutes: 15,
        feeds: [],
      },
    });

    const res = await request(app).get('/api/guilds/g1/rss/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(mockRssStateFind).not.toHaveBeenCalled();
  });

  test('GET /:id/rss/status returns per-feed runtime status', async () => {
    const app = createApp();
    mockGetOrCreate.mockResolvedValue({
      guildId: 'g1',
      rss: {
        enabled: true,
        pollIntervalMinutes: 15,
        feeds: [
          {
            id: 'feed-1',
            name: 'Main Feed',
            sourceType: 'rss',
            channelId: '12345678901234567',
            enabled: true,
          },
          {
            id: 'feed-2',
            name: null,
            sourceType: 'rsshub',
            channelId: '22345678901234567',
            enabled: false,
          },
        ],
      },
    });

    const lean = jest.fn().mockResolvedValue([
      {
        guildId: 'g1',
        feedId: 'feed-1',
        lastCheckedAt: new Date('2026-04-01T00:00:00.000Z'),
        lastSuccessAt: new Date('2026-04-01T00:05:00.000Z'),
        lastError: null,
        consecutiveFailures: 0,
        seenItemIds: ['a', 'b', 'c'],
      },
    ]);
    mockRssStateFind.mockReturnValue({ lean });

    const res = await request(app).get('/api/guilds/g1/rss/status');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      feedId: 'feed-1',
      name: 'Main Feed',
      enabled: true,
      sourceType: 'rss',
      consecutiveFailures: 0,
      seenCount: 3,
    });
    expect(res.body[1]).toMatchObject({
      feedId: 'feed-2',
      enabled: false,
      sourceType: 'rsshub',
      consecutiveFailures: 0,
      seenCount: 0,
    });

    expect(mockRssStateFind).toHaveBeenCalledWith({
      guildId: 'g1',
      feedId: { $in: ['feed-1', 'feed-2'] },
    });
  });
});
