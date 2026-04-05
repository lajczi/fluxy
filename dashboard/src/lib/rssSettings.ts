export type RssSourceType = 'rss' | 'rsshub';

export interface RssFeedPayload {
  id: string;
  name: string | null;
  sourceType: RssSourceType;
  url: string | null;
  route: string | null;
  channelId: string;
  mentionRoleId: string | null;
  webhookId: string | null;
  webhookToken: string | null;
  webhookName: string | null;
  enabled: boolean;
  maxItemsPerPoll: number;
  includeSummary: boolean;
  includeImage: boolean;
  format: 'embed' | 'text';
}

export interface RssSettingsPayload {
  enabled: boolean;
  pollIntervalMinutes: number;
  feeds: RssFeedPayload[];
}

export const RSS_MIN_INTERVAL_MINUTES = 10;
export const RSS_MAX_INTERVAL_MINUTES = 1440;
export const RSS_MIN_ITEMS_PER_POLL = 1;
export const RSS_MAX_ITEMS_PER_POLL = 10;
export const RSS_MAX_FEEDS = 5;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeFeed(feed: RssFeedPayload): RssFeedPayload {
  const sourceType: RssSourceType = feed.sourceType === 'rsshub' ? 'rsshub' : 'rss';
  const format: 'embed' | 'text' = feed.format === 'text' ? 'text' : 'embed';
  const url = sourceType === 'rss' ? (feed.url || '').trim() : null;
  const route = sourceType === 'rsshub' ? (feed.route || '').trim() : null;

  return {
    ...feed,
    sourceType,
    name: feed.name?.trim() || null,
    url: url || null,
    route: route || null,
    channelId: (feed.channelId || '').trim(),
    mentionRoleId: feed.mentionRoleId || null,
    webhookId: typeof feed.webhookId === 'string' ? (feed.webhookId.trim() || null) : null,
    webhookToken: typeof feed.webhookToken === 'string' ? (feed.webhookToken.trim() || null) : null,
    webhookName: typeof feed.webhookName === 'string' ? (feed.webhookName.trim() || null) : null,
    maxItemsPerPoll: clampNumber(feed.maxItemsPerPoll, RSS_MIN_ITEMS_PER_POLL, RSS_MAX_ITEMS_PER_POLL),
    format,
  };
}

export function buildRssSavePayload(input: RssSettingsPayload):
  | { ok: true; payload: RssSettingsPayload }
  | { ok: false; error: string } {
  const feeds = input.feeds.slice(0, RSS_MAX_FEEDS).map(normalizeFeed);

  const hasInvalid = feeds.some((feed) => {
    if (!feed.channelId) return true;
    if (feed.sourceType === 'rss') return !feed.url;
    return !feed.route || !feed.route.startsWith('/');
  });

  if (hasInvalid) {
    return { ok: false, error: 'Every feed needs a destination channel and valid source.' };
  }

  return {
    ok: true,
    payload: {
      enabled: input.enabled,
      pollIntervalMinutes: clampNumber(
        input.pollIntervalMinutes,
        RSS_MIN_INTERVAL_MINUTES,
        RSS_MAX_INTERVAL_MINUTES,
      ),
      feeds,
    },
  };
}
