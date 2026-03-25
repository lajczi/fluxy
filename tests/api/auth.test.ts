import express from 'express';
import request from 'supertest';

jest.mock('../../src/config', () => ({
  __esModule: true,
  default: {
    api: { adminToken: 'test-admin-token' },
    ownerId: 'owner123',
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

import { createAuthMiddleware } from '../../src/api/middleware/auth';

function createApp() {
  const client = { user: { id: 'bot1' } } as any;
  const { authenticate, requireOwner } = createAuthMiddleware(client);

  const app = express();
  app.use(express.json());

  app.get('/public', (_req, res) => res.json({ ok: true }));

  app.get('/protected', authenticate, (req: any, res) => {
    res.json({ userId: req.userId, isOwner: req.isOwner });
  });

  app.get('/owner-only', authenticate, requireOwner, (_req, res) => {
    res.json({ access: 'granted' });
  });

  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authenticate middleware', () => {
  test('rejects requests without Authorization header', async () => {
    const app = createApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Missing or invalid authorization');
  });

  test('rejects requests with non-Bearer auth', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  test('accepts admin token and sets isOwner=true', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer test-admin-token');
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('owner123');
    expect(res.body.isOwner).toBe(true);
  });

  test('validates Fluxer OAuth token via API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'user456' }),
    });

    const app = createApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid-oauth-token');
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user456');
    expect(res.body.isOwner).toBe(false);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.fluxer.app/users/@me',
      expect.objectContaining({
        headers: { Authorization: 'Bearer valid-oauth-token' },
      })
    );
  });

  test('rejects invalid OAuth token', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const app = createApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid or expired token');
  });

  test('rejects when Fluxer API is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

    const app = createApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer some-token');
    expect(res.status).toBe(401);
  });

  test('sets isOwner=true when OAuth userId matches ownerId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'owner123' }),
    });

    const app = createApp();
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer owner-oauth-token');
    expect(res.status).toBe(200);
    expect(res.body.isOwner).toBe(true);
  });

  test('caches validated OAuth tokens (second call skips fetch)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'cached-user' }),
    });

    const app = createApp();
    await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer cacheable-token');
    await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer cacheable-token');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('requireOwner middleware', () => {
  test('allows owner access', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/owner-only')
      .set('Authorization', 'Bearer test-admin-token');
    expect(res.status).toBe(200);
    expect(res.body.access).toBe('granted');
  });

  test('blocks non-owner access with 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'regular-user' }),
    });

    const app = createApp();
    const res = await request(app)
      .get('/owner-only')
      .set('Authorization', 'Bearer regular-user-token');
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('restricted to the bot owner');
  });
});
