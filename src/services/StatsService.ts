import Stat from '../models/Stat';

export class StatsService {
  async recordCommand(commandName: string, guildId?: string, userId?: string): Promise<void> {
    try {
      await Stat.create({
        type: 'command',
        value: commandName,
        additionalData: { guildId, userId },
      });
    } catch (err) {
      console.error('[StatsService] Failed to record command:', err);
    }
  }

  async recordGuildJoin(guildId: string, guildName: string): Promise<void> {
    try {
      await Stat.create({
        type: 'guild_join',
        value: guildId,
        additionalData: { guildName },
      });
    } catch (err) {
      console.error('[StatsService] Failed to record guild join:', err);
    }
  }

  async recordGuildLeave(guildId: string, guildName: string): Promise<void> {
    try {
      await Stat.create({
        type: 'guild_leave',
        value: guildId,
        additionalData: { guildName },
      });
    } catch (err) {
      console.error('[StatsService] Failed to record guild leave:', err);
    }
  }

  async getCommandCount(days = 30): Promise<number> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return Stat.countDocuments({ type: 'command', createdAt: { $gte: since } });
  }

  async getDailyCommandCounts(days = 30): Promise<Array<{ date: string; count: number }>> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const daily = await Stat.aggregate([
      { $match: { type: 'command', createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return daily.map((d) => ({ date: d._id, count: d.count }));
  }

  async getTopCommands(limit = 10): Promise<Array<{ command: string; count: number }>> {
    const top = await Stat.aggregate([
      { $match: { type: 'command' } },
      { $group: { _id: '$value', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    return top.map((t) => ({ command: t._id, count: t.count }));
  }

  async cleanup(retentionDays = 90): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await Stat.deleteMany({ createdAt: { $lt: cutoff } });
    return result.deletedCount;
  }
}

const statsService = new StatsService();
export default statsService;
