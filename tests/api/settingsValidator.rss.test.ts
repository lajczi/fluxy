import { validateSettingsUpdate } from '../../src/api/middleware/settingsValidator';

const CHANNEL_ID = '12345678901234567';
const ROLE_ID = '22345678901234567';

function makeRssFeed(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'feed-1',
    name: 'Fluxy Updates',
    sourceType: 'rss',
    url: 'https://example.com/feed.xml',
    route: null,
    channelId: CHANNEL_ID,
    mentionRoleId: ROLE_ID,
    enabled: true,
    maxItemsPerPoll: 3,
    includeSummary: true,
    includeImage: true,
    format: 'embed',
    ...overrides,
  };
}

describe('validateSettingsUpdate rss validation', () => {
  test('accepts valid rss URL feed payload', () => {
    const result = validateSettingsUpdate({
      rss: {
        enabled: true,
        pollIntervalMinutes: 15,
        feeds: [makeRssFeed()],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect((result.sanitized.rss as any).feeds).toHaveLength(1);
  });

  test('accepts valid rsshub route feed payload', () => {
    const result = validateSettingsUpdate({
      rss: {
        enabled: true,
        pollIntervalMinutes: 15,
        feeds: [
          makeRssFeed({
            sourceType: 'rsshub',
            url: null,
            route: '/github/issue/user/repo',
          }),
        ],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects invalid rss URL', () => {
    const result = validateSettingsUpdate({
      rss: {
        enabled: true,
        pollIntervalMinutes: 15,
        feeds: [makeRssFeed({ url: 'ftp://example.com/feed.xml' })],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('rss.feeds[].url must be a valid http(s) URL');
  });

  test('rejects rsshub route without leading slash', () => {
    const result = validateSettingsUpdate({
      rss: {
        enabled: true,
        pollIntervalMinutes: 15,
        feeds: [
          makeRssFeed({
            sourceType: 'rsshub',
            url: null,
            route: 'github/issue/user/repo',
          }),
        ],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('rss.feeds[].route must start with / for rsshub sources');
  });

  test('rejects too many feeds in rss payload', () => {
    const feeds = Array.from({ length: 6 }, (_, idx) => makeRssFeed({ id: `feed-${idx + 1}` }));
    const result = validateSettingsUpdate({
      rss: {
        enabled: true,
        pollIntervalMinutes: 15,
        feeds,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('rss.feeds can contain at most 5 feeds');
  });

  test('rejects poll interval below minimum', () => {
    const result = validateSettingsUpdate({
      rss: {
        enabled: true,
        pollIntervalMinutes: 9,
        feeds: [makeRssFeed()],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('rss.pollIntervalMinutes must be between 10 and 1440');
  });
});
