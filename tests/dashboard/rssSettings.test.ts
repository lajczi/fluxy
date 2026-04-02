import {
  buildRssSavePayload,
  RSS_MAX_FEEDS,
  RSS_MAX_INTERVAL_MINUTES,
  RSS_MAX_ITEMS_PER_POLL,
  RSS_MIN_INTERVAL_MINUTES,
  RSS_MIN_ITEMS_PER_POLL,
  type RssFeedPayload,
} from '../../dashboard/src/lib/rssSettings';

function makeFeed(overrides: Partial<RssFeedPayload> = {}): RssFeedPayload {
  return {
    id: 'feed-1',
    name: ' Fluxy News ',
    sourceType: 'rss',
    url: ' https://example.com/feed.xml ',
    route: null,
    channelId: '12345678901234567',
    mentionRoleId: '22345678901234567',
    enabled: true,
    maxItemsPerPoll: 3,
    includeSummary: true,
    includeImage: true,
    format: 'embed',
    ...overrides,
  };
}

describe('buildRssSavePayload', () => {
  test('returns normalized payload shape and clamps numeric values', () => {
    const result = buildRssSavePayload({
      enabled: true,
      pollIntervalMinutes: RSS_MAX_INTERVAL_MINUTES + 999,
      feeds: [
        makeFeed({
          name: '  ',
          maxItemsPerPoll: RSS_MAX_ITEMS_PER_POLL + 99,
          mentionRoleId: '',
          format: 'text',
        }),
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.pollIntervalMinutes).toBe(RSS_MAX_INTERVAL_MINUTES);
    expect(result.payload.feeds).toHaveLength(1);
    expect(result.payload.feeds[0]).toMatchObject({
      name: null,
      url: 'https://example.com/feed.xml',
      mentionRoleId: null,
      maxItemsPerPoll: RSS_MAX_ITEMS_PER_POLL,
      format: 'text',
    });
  });

  test('rejects payload when feed channel is missing', () => {
    const result = buildRssSavePayload({
      enabled: true,
      pollIntervalMinutes: 15,
      feeds: [makeFeed({ channelId: '' })],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('destination channel');
  });

  test('rejects payload when rss source URL is missing', () => {
    const result = buildRssSavePayload({
      enabled: true,
      pollIntervalMinutes: 15,
      feeds: [makeFeed({ sourceType: 'rss', url: '   ' })],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('valid source');
  });

  test('rejects payload when rsshub route is invalid', () => {
    const result = buildRssSavePayload({
      enabled: true,
      pollIntervalMinutes: 15,
      feeds: [makeFeed({ sourceType: 'rsshub', url: null, route: 'github/issue/user/repo' })],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('valid source');
  });

  test('truncates feed list to max allowed and clamps minimums', () => {
    const manyFeeds = Array.from({ length: RSS_MAX_FEEDS + 3 }, (_, idx) =>
      makeFeed({ id: `feed-${idx + 1}`, maxItemsPerPoll: 0 }),
    );

    const result = buildRssSavePayload({
      enabled: false,
      pollIntervalMinutes: 1,
      feeds: manyFeeds,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.pollIntervalMinutes).toBe(RSS_MIN_INTERVAL_MINUTES);
    expect(result.payload.feeds).toHaveLength(RSS_MAX_FEEDS);
    expect(result.payload.feeds[0].maxItemsPerPoll).toBe(RSS_MIN_ITEMS_PER_POLL);
  });
});
