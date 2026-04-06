import * as memberCounter from './memberCounter';

async function fetchGuildMemberCount(guild: any): Promise<number> {
  const cached = memberCounter.get(guild.id);
  if (cached !== null && cached !== undefined) return cached;

  const count = await memberCounter.fetchAndSetMemberCount(guild.id, guild.client);
  return count ?? 0;
}

export interface WorkerStats {
  guilds: number;
  members: number;
  memory: number;
  uptime: number;
}

export async function getWorkerStats(client: any): Promise<WorkerStats> {
  const guilds = client.guilds?.size ?? 0;
  const guildArr = [...(client.guilds?.values() ?? [])];

  const CONCURRENCY = 10;
  let members = 0;
  for (let i = 0; i < guildArr.length; i += CONCURRENCY) {
    const batch = guildArr.slice(i, i + CONCURRENCY);
    const counts = await Promise.allSettled(batch.map((g: any) => fetchGuildMemberCount(g)));
    for (const result of counts) {
      if (result.status === 'fulfilled') members += result.value;
    }
  }

  return {
    guilds,
    members,
    memory: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10,
    uptime: Math.floor(process.uptime()),
  };
}
