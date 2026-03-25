import { Schema, model, Document, Model } from 'mongoose';

export interface IGlobalBan {
  userId: string;
  reason: string;
  evidence: string | null;
  addedBy: string;
  addedAt: Date;
}

export interface GlobalBanDocument extends IGlobalBan, Document {}

export interface GlobalBanModel extends Model<GlobalBanDocument> {
  isGlobalBanned(userId: string): Promise<GlobalBanDocument | null>;
  addBan(data: Omit<IGlobalBan, 'addedAt'>): Promise<GlobalBanDocument>;
  removeBan(userId: string): Promise<boolean>;
  listBans(options?: { limit?: number; skip?: number }): Promise<GlobalBanDocument[]>;
}

const globalBanSchema = new Schema<GlobalBanDocument, GlobalBanModel>({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  reason: {
    type: String,
    required: true,
  },
  evidence: {
    type: String,
    default: null,
  },
  addedBy: {
    type: String,
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

globalBanSchema.statics.isGlobalBanned = async function (userId: string) {
  return this.findOne({ userId }).lean();
};

globalBanSchema.statics.addBan = async function (data: Omit<IGlobalBan, 'addedAt'>) {
  return this.findOneAndUpdate(
    { userId: data.userId },
    { $set: { ...data, addedAt: new Date() } },
    { returnDocument: 'after', upsert: true },
  );
};

globalBanSchema.statics.removeBan = async function (userId: string) {
  const result = await this.deleteOne({ userId });
  return result.deletedCount > 0;
};

globalBanSchema.statics.listBans = async function (options?: { limit?: number; skip?: number }) {
  const limit = options?.limit ?? 25;
  const skip = options?.skip ?? 0;
  return this.find().sort({ addedAt: -1 }).skip(skip).limit(limit).lean();
};

const GlobalBan = model<GlobalBanDocument, GlobalBanModel>('GlobalBan', globalBanSchema);
export default GlobalBan;
