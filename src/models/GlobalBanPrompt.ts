import { Schema, model, Document, Model } from 'mongoose';

export interface IGlobalBanPrompt {
  messageId: string;
  channelId: string;
  guildId: string;
  bannedUserId: string;
  banReason: string;
  status: 'pending' | 'applied' | 'declined';
  decidedBy?: string;
  decidedAt?: Date;
  createdAt: Date;
}

export interface GlobalBanPromptDocument extends IGlobalBanPrompt, Document {}

export interface GlobalBanPromptModel extends Model<GlobalBanPromptDocument> {
  guildDeclinedBan(guildId: string, bannedUserId: string): Promise<boolean>;
}

const schema = new Schema<GlobalBanPromptDocument, GlobalBanPromptModel>({
  messageId: { type: String, required: true, unique: true, index: true },
  channelId: { type: String, required: true },
  guildId: { type: String, required: true, index: true },
  bannedUserId: { type: String, required: true, index: true },
  banReason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'applied', 'declined'], default: 'pending' },
  decidedBy: { type: String, default: null },
  decidedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

schema.index({ guildId: 1, bannedUserId: 1 });

schema.statics.guildDeclinedBan = async function (guildId: string, bannedUserId: string): Promise<boolean> {
  const doc = await this.findOne({ guildId, bannedUserId, status: 'declined' }).sort({ createdAt: -1 }).lean();
  return !!doc;
};

export default model<GlobalBanPromptDocument, GlobalBanPromptModel>('GlobalBanPrompt', schema);
