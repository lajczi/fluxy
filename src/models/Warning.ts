import { Schema, model, Document, Model } from 'mongoose';
import type { IWarning, IWarningEntry } from '../types';

export interface WarningDocument extends IWarning, Document {
  getActiveCount(): number;
  getActiveWarnings(): IWarningEntry[];
}

export interface WarningModel extends Model<WarningDocument> {
  getUserWarnings(guildId: string, userId: string): Promise<WarningDocument>;
  addWarning(guildId: string, userId: string, modId: string, reason: string): Promise<WarningDocument>;
  clearWarnings(guildId: string, userId: string): Promise<WarningDocument | null>;
}

const warningSchema = new Schema<WarningDocument, WarningModel>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  guildId: {
    type: String,
    required: true,
    index: true,
  },
  warnings: [
    {
      modId: { type: String, required: true },
      reason: { type: String, required: true },
      date: { type: Date, default: Date.now },
      active: { type: Boolean, default: true },
    },
  ],
});

warningSchema.index({ guildId: 1, userId: 1 });

warningSchema.statics.getUserWarnings = async function (guildId: string, userId: string) {
  let record = await this.findOne({ guildId, userId });
  if (!record) {
    record = await this.create({ guildId, userId, warnings: [] });
  }
  return record;
};

warningSchema.statics.addWarning = async function (guildId: string, userId: string, modId: string, reason: string) {
  let record = await this.findOne({ guildId, userId });

  if (!record) {
    record = await this.create({
      guildId,
      userId,
      warnings: [{ modId, reason }],
    });
  } else {
    record.warnings.push({ modId, reason, date: new Date(), active: true });
    await record.save();
  }

  return record;
};

warningSchema.statics.clearWarnings = async function (guildId: string, userId: string) {
  return this.findOneAndUpdate({ guildId, userId }, { warnings: [] }, { returnDocument: 'after', upsert: true });
};

warningSchema.methods.getActiveCount = function () {
  return this.warnings.filter((w: IWarningEntry) => w.active).length;
};

warningSchema.methods.getActiveWarnings = function () {
  return this.warnings.filter((w: IWarningEntry) => w.active);
};

export default model<WarningDocument, WarningModel>('Warning', warningSchema);
