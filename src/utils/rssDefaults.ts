export const RSS_MIN_POLL_INTERVAL_MINUTES = 10;
export const RSS_DEFAULT_POLL_INTERVAL_MINUTES = 15;
export const RSS_MAX_FEEDS_PER_GUILD = 5;
export const RSS_DEFAULT_ITEMS_PER_POLL = 3;
export const RSS_MAX_ITEMS_PER_POLL = 10;
export const RSS_MAX_SEEN_ITEM_IDS = 200;

export function clampPollIntervalMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return RSS_DEFAULT_POLL_INTERVAL_MINUTES;
  return Math.max(RSS_MIN_POLL_INTERVAL_MINUTES, Math.min(1440, Math.floor(minutes)));
}

export function clampItemsPerPoll(count: number): number {
  if (!Number.isFinite(count)) return RSS_DEFAULT_ITEMS_PER_POLL;
  return Math.max(1, Math.min(RSS_MAX_ITEMS_PER_POLL, Math.floor(count)));
}