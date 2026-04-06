import { Routes } from '@erinjs/types';

const counts = new Map<string, number>();

export function set(guildId: string, count: number): void {
  counts.set(guildId, count);
}

export async function fetchAndSetMemberCount(guildId: string, client: any): Promise<number | null> {
  try {
    const guildData: any = await client.rest.get(Routes.guild(guildId));
    const count = guildData?.member_count;
    if (typeof count === 'number' && count > 0) {
      counts.set(guildId, count);
      return count;
    }
  } catch {}

  try {
    let total = 0;
    let lastId: string | undefined;
    while (true) {
      const qs = `?limit=1000${lastId ? `&after=${lastId}` : ''}`;
      const list: any = await client.rest.get(Routes.guildMembers(guildId) + qs, { auth: true });
      const arr = Array.isArray(list) ? list : [];
      total += arr.length;
      if (arr.length < 1000) break;
      lastId = arr[arr.length - 1]?.user?.id;
      if (!lastId) break;
    }
    counts.set(guildId, total);
    return total;
  } catch {
    return null;
  }
}

export function get(guildId: string): number | null {
  return counts.get(guildId) ?? null;
}

export function increment(guildId: string): number {
  const n = (counts.get(guildId) ?? 0) + 1;
  counts.set(guildId, n);
  return n;
}

export function decrement(guildId: string): number {
  const n = Math.max(0, (counts.get(guildId) ?? 1) - 1);
  counts.set(guildId, n);
  return n;
}
