import UserSettings from '../models/UserSettings';
import Warning from '../models/Warning';
import ModerationLog from '../models/ModerationLog';
import Ticket from '../models/Ticket';
import GlobalBan from '../models/GlobalBan';
import GuildSettings from '../models/GuildSettings';
import Stat from '../models/Stat';

export interface UserDataExport {
  userId: string;
  exportedAt: string;
  userSettings: Record<string, unknown> | null;
  warnings: Array<Record<string, unknown>>;
  moderationLogs: {
    asTarget: Array<Record<string, unknown>>;
    asModerator: Array<Record<string, unknown>>;
  };
  tickets: {
    opened: Array<Record<string, unknown>>;
    participated: Array<Record<string, unknown>>;
    messagesAuthored: number;
  };
  globalBan: Record<string, unknown> | null;
  commandUsage: number;
  guildSettingsReferences: Array<{ guildId: string; field: string }>;
}

export async function collectUserData(userId: string): Promise<UserDataExport> {
  const [
    userSettings,
    warnings,
    logsAsTarget,
    logsAsModerator,
    ticketsOpened,
    ticketsParticipated,
    globalBan,
    commandUsageCount,
    guildSettingsRefs,
  ] = await Promise.all([
    UserSettings.findOne({ userId }).lean(),
    Warning.find({ userId }).lean(),
    ModerationLog.find({ targetId: userId }).sort({ timestamp: -1 }).lean(),
    ModerationLog.find({ userId }).sort({ timestamp: -1 }).lean(),
    Ticket.find({ openedBy: userId }).lean(),
    Ticket.find({ participants: userId, openedBy: { $ne: userId } }).select('-transcript').lean(),
    GlobalBan.findOne({ userId }).lean(),
    Stat.countDocuments({ 'additionalData.userId': userId }),
    GuildSettings.find({ lockdownAllowedUsers: userId }).select('guildId').lean(),
  ]);

  const allTicketsWithMessages = await Ticket.find({
    'transcript.authorId': userId,
  }).select('transcript').lean();

  let messagesAuthored = 0;
  for (const t of allTicketsWithMessages) {
    messagesAuthored += (t as any).transcript.filter((m: any) => m.authorId === userId).length;
  }

  const ticketsOpenedClean = ticketsOpened.map((t: any) => {
    const { transcript, ...rest } = t;
    return { ...rest, transcriptMessageCount: transcript?.length ?? 0 };
  });

  return {
    userId,
    exportedAt: new Date().toISOString(),
    userSettings: userSettings ? { prefix: (userSettings as any).prefix, createdAt: (userSettings as any).createdAt } : null,
    warnings: warnings.map((w: any) => ({
      guildId: w.guildId,
      warnings: w.warnings,
    })),
    moderationLogs: {
      asTarget: logsAsTarget.map((l: any) => ({
        guildId: l.guildId,
        action: l.action,
        reason: l.reason,
        moderatorId: l.userId,
        timestamp: l.timestamp,
        metadata: l.metadata,
      })),
      asModerator: logsAsModerator.map((l: any) => ({
        guildId: l.guildId,
        action: l.action,
        reason: l.reason,
        targetId: l.targetId,
        timestamp: l.timestamp,
      })),
    },
    tickets: {
      opened: ticketsOpenedClean,
      participated: ticketsParticipated as any[],
      messagesAuthored,
    },
    globalBan: globalBan ? {
      reason: (globalBan as any).reason,
      evidence: (globalBan as any).evidence,
      addedAt: (globalBan as any).addedAt,
    } : null,
    commandUsage: commandUsageCount,
    guildSettingsReferences: guildSettingsRefs.map((g: any) => ({
      guildId: g.guildId,
      field: 'lockdownAllowedUsers',
    })),
  };
}

export interface DeleteResult {
  userSettings: boolean;
  warnings: number;
  moderationLogsAnonymized: number;
  ticketMessagesAnonymized: number;
  commandUsage: number;
  guildSettingsReferences: number;
}

export async function deleteUserData(userId: string): Promise<DeleteResult> {
  const result: DeleteResult = {
    userSettings: false,
    warnings: 0,
    moderationLogsAnonymized: 0,
    ticketMessagesAnonymized: 0,
    commandUsage: 0,
    guildSettingsReferences: 0,
  };

  const userSettingsResult = await UserSettings.deleteOne({ userId });
  result.userSettings = userSettingsResult.deletedCount > 0;

  const warningsResult = await Warning.deleteMany({ userId });
  result.warnings = warningsResult.deletedCount;

  const logsAsTarget = await ModerationLog.updateMany(
    { targetId: userId },
    { $set: { targetId: '[deleted]' } },
  );
  const logsAsMod = await ModerationLog.updateMany(
    { userId },
    { $set: { userId: '[deleted]' } },
  );
  result.moderationLogsAnonymized = (logsAsTarget.modifiedCount || 0) + (logsAsMod.modifiedCount || 0);

  await Ticket.updateMany(
    { 'transcript.authorId': userId },
    { $set: { 'transcript.$[msg].authorId': '[deleted]', 'transcript.$[msg].authorName': 'Deleted User', 'transcript.$[msg].avatarURL': null } },
    { arrayFilters: [{ 'msg.authorId': userId }] },
  );

  await Ticket.updateMany({ openedBy: userId }, { $set: { openedBy: '[deleted]' } });
  await Ticket.updateMany({ closedBy: userId }, { $set: { closedBy: '[deleted]' } });
  await Ticket.updateMany({ claimedBy: userId }, { $set: { claimedBy: '[deleted]' } });
  await Ticket.updateMany(
    { participants: userId },
    { $pull: { participants: userId } },
  );
  result.ticketMessagesAnonymized = 1;

  const statsResult = await Stat.deleteMany({ 'additionalData.userId': userId });
  result.commandUsage = statsResult.deletedCount;

  const guildSettingsResult = await GuildSettings.updateMany(
    { lockdownAllowedUsers: userId },
    { $pull: { lockdownAllowedUsers: userId } },
  );
  result.guildSettingsReferences = guildSettingsResult.modifiedCount || 0;

  return result;
}
