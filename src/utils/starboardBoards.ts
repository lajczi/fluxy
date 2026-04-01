import type { IStarboardBoard } from '../types';

function normalizeBoard(raw: any): IStarboardBoard {
  return {
    enabled: Boolean(raw?.enabled),
    channelId: raw?.channelId ?? null,
    threshold: typeof raw?.threshold === 'number' ? raw.threshold : 3,
    emoji: typeof raw?.emoji === 'string' ? raw.emoji : '⭐',
    selfStarEnabled: Boolean(raw?.selfStarEnabled),
    ignoreBots: raw?.ignoreBots === false ? false : true,
    ignoredChannels: Array.isArray(raw?.ignoredChannels) ? raw.ignoredChannels : [],
    ignoredRoles: Array.isArray(raw?.ignoredRoles) ? raw.ignoredRoles : [],
  };
}

export function getStarboards(settings: any): IStarboardBoard[] {
  const boards: IStarboardBoard[] = [];
  const rawArray = Array.isArray(settings?.starboards) ? settings.starboards : [];
  for (const entry of rawArray) boards.push(normalizeBoard(entry));

  if (boards.length === 0 && settings?.starboard) {
    boards.push(normalizeBoard(settings.starboard));
  }

  const unique = new Map<string, IStarboardBoard>();
  for (const board of boards) {
    if (!board.channelId) continue;
    if (!unique.has(board.channelId)) unique.set(board.channelId, board);
  }

  return Array.from(unique.values()).slice(0, 3);
}

export function getActiveStarboards(settings: any): IStarboardBoard[] {
  return getStarboards(settings).filter(b => b.enabled && b.channelId);
}

export function getStarEmoji(count: number): string {
  if (count >= 25) return '💫';
  if (count >= 10) return '🌟';
  return '⭐';
}

export function getStarColor(count: number): number {
  if (count >= 25) return 0xe74c3c;
  if (count >= 10) return 0xe67e22;
  return 0xf1c40f;
}
