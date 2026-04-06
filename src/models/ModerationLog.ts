import { Schema, model, Document, Model } from 'mongoose';
import type { IModerationLog, ModerationAction } from '../types';

export interface ModerationLogDocument extends IModerationLog, Document {}

export interface ModerationLogModel extends Model<ModerationLogDocument> {
  logAction(data: Partial<IModerationLog>): Promise<ModerationLogDocument>;
  getGuildLogs(
    guildId: string,
    options?: {
      limit?: number;
      skip?: number;
      action?: ModerationAction;
      userId?: string;
      targetId?: string;
    },
  ): Promise<IModerationLog[]>;
  getUserHistory(guildId: string, targetId: string, limit?: number): Promise<IModerationLog[]>;
  getWarningCount(guildId: string, targetId: string): Promise<number>;
  getGuildStats(guildId: string, days?: number): Promise<{ total: number; byAction: Record<string, number> }>;
  getCase(guildId: string, caseNumber: number): Promise<IModerationLog | null>;
  cleanupOld(guildId: string, retentionDays?: number): Promise<number>;
}

const moderationLogSchema = new Schema<ModerationLogDocument, ModerationLogModel>({
  guildId: {
    type: String,
    required: true,
    index: true,
  },

  userId: {
    type: String,
    required: true,
    index: true,
  },

  targetId: {
    type: String,
    required: true,
    index: true,
  },

  action: {
    type: String,
    required: true,
    enum: [
      'ban',
      'unban',
      'kick',
      'mute',
      'unmute',
      'warn',
      'unwarn',
      'clearwarn',
      'slowmode',
      'unlock',
      'purge',
      'softban',
      'tempban',
      'tempmute',
      'timeout',
      'nickname',
      'role_add',
      'role_remove',
      'other',
    ],
  },

  reason: {
    type: String,
    default: 'No reason provided',
    maxlength: 1000,
  },

  duration: {
    type: Number,
    default: null,
    min: 0,
  },

  metadata: {
    roleId: { type: String },
    roleName: { type: String },
    messageCount: { type: Number },
    channelId: { type: String },
    channelName: { type: String },
    slowmodeSeconds: { type: Number },
    oldNickname: { type: String },
    newNickname: { type: String },
    warningId: { type: String },
    caseNumber: { type: Number },
  },

  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },

  viaDashboard: {
    type: Boolean,
    default: false,
  },
});

moderationLogSchema.index({ guildId: 1, timestamp: -1 });
moderationLogSchema.index({ guildId: 1, targetId: 1, timestamp: -1 });
moderationLogSchema.index({ guildId: 1, userId: 1, timestamp: -1 });
moderationLogSchema.index({ guildId: 1, action: 1, timestamp: -1 });

moderationLogSchema.statics.logAction = async function (data: Partial<IModerationLog>) {
  const lastLog = await this.findOne({ guildId: data.guildId })
    .sort({ 'metadata.caseNumber': -1 })
    .select('metadata.caseNumber');

  const caseNumber = (lastLog?.metadata?.caseNumber || 0) + 1;

  return this.create({
    ...data,
    metadata: {
      ...data.metadata,
      caseNumber,
    },
  });
};

moderationLogSchema.statics.getGuildLogs = async function (
  guildId: string,
  options: { limit?: number; skip?: number; action?: ModerationAction; userId?: string; targetId?: string } = {},
) {
  const { limit = 50, skip = 0, action, userId, targetId } = options;

  const query: Record<string, unknown> = { guildId };
  if (action) query.action = action;
  if (userId) query.userId = userId;
  if (targetId) query.targetId = targetId;

  return this.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean();
};

moderationLogSchema.statics.getUserHistory = async function (guildId: string, targetId: string, limit = 20) {
  return this.find({ guildId, targetId }).sort({ timestamp: -1 }).limit(limit).lean();
};

moderationLogSchema.statics.getWarningCount = async function (guildId: string, targetId: string) {
  const warnings = await this.countDocuments({ guildId, targetId, action: 'warn' });
  const unwarns = await this.countDocuments({ guildId, targetId, action: 'unwarn' });
  return Math.max(0, warnings - unwarns);
};

moderationLogSchema.statics.getGuildStats = async function (guildId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stats = await this.aggregate([
    { $match: { guildId, timestamp: { $gte: since } } },
    { $group: { _id: '$action', count: { $sum: 1 } } },
  ]);

  const result: { total: number; byAction: Record<string, number> } = {
    total: 0,
    byAction: {},
  };

  for (const stat of stats) {
    result.byAction[stat._id] = stat.count;
    result.total += stat.count;
  }

  return result;
};

moderationLogSchema.statics.getCase = async function (guildId: string, caseNumber: number) {
  return this.findOne({ guildId, 'metadata.caseNumber': caseNumber }).lean();
};

moderationLogSchema.statics.cleanupOld = async function (guildId: string, retentionDays = 90) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({ guildId, timestamp: { $lt: cutoff } });
  return result.deletedCount;
};

export default model<ModerationLogDocument, ModerationLogModel>('ModerationLog', moderationLogSchema);
