import express from 'express';
import request from 'supertest';
import { apiLimiter, authLimiter, writeLimiter } from '../../src/api/middleware/rateLimit';

function createApp(limiter: any, maxRequests: number) {
  const app = express();
  app.use(limiter);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  app.post('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('apiLimiter - 100 requests per minute', () => {
  test('allows requests under the limit', async () => {
    const app = createApp(apiLimiter, 100);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('includes rate limit headers', async () => {
    const app = createApp(apiLimiter, 100);
    const res = await request(app).get('/test');
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  test('does not include legacy X-RateLimit headers', async () => {
    const app = createApp(apiLimiter, 100);
    const res = await request(app).get('/test');
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });
});

describe('authLimiter - 10 requests per minute', () => {
  test('allows requests under the limit', async () => {
    const app = createApp(authLimiter, 10);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  test('returns 429 after exceeding limit', async () => {
    const app = createApp(authLimiter, 10);
    for (let i = 0; i < 10; i++) {
      await request(app).get('/test');
    }
    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Too many auth requests');
  });
});

describe('writeLimiter - 30 requests per minute', () => {
  test('allows requests under the limit', async () => {
    const app = createApp(writeLimiter, 30);
    const res = await request(app).post('/test');
    expect(res.status).toBe(200);
  });

  test('returns 429 after exceeding limit', async () => {
    const app = createApp(writeLimiter, 30);
    // Exhaust the limit
    for (let i = 0; i < 30; i++) {
      await request(app).post('/test');
    }
    const res = await request(app).post('/test');
    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Too many write requests');
  });
});
