import { Schema, model, Document, Model } from 'mongoose';

export interface IUserSettings {
  userId: string;
  prefix: string | null;
}

export interface UserSettingsDocument extends IUserSettings, Document {}

export interface UserSettingsModel extends Model<UserSettingsDocument> {
  getPrefix(userId: string): Promise<string | null>;
  setPrefix(userId: string, prefix: string | null): Promise<UserSettingsDocument>;
}

const userSettingsSchema = new Schema<UserSettingsDocument, UserSettingsModel>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    prefix: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

// In-memory cache to avoid hitting DB on every message
const prefixCache = new Map<string, { value: string | null; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE = 2000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of prefixCache) {
    if (v.expiresAt <= now) prefixCache.delete(k);
  }
}, 60 * 1000).unref();

userSettingsSchema.statics.getPrefix = async function (userId: string): Promise<string | null> {
  const cached = prefixCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const doc = await this.findOne({ userId }).lean();
  const value = doc?.prefix ?? null;

  if (prefixCache.size >= MAX_CACHE) {
    const oldest = prefixCache.keys().next().value;
    if (oldest) prefixCache.delete(oldest);
  }
  prefixCache.set(userId, { value, expiresAt: Date.now() + CACHE_TTL });

  return value;
};

userSettingsSchema.statics.setPrefix = async function (userId: string, prefix: string | null) {
  prefixCache.delete(userId);
  return this.findOneAndUpdate({ userId }, { prefix }, { returnDocument: 'after', upsert: true });
};

export default model<UserSettingsDocument, UserSettingsModel>('UserSettings', userSettingsSchema);
