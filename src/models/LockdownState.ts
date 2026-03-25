import { Schema, model, Document, Model } from 'mongoose';
import type { ILockdownState, IChannelOverwriteSnapshot } from '../types';

export interface LockdownStateDocument extends ILockdownState, Document {}

export interface LockdownStateModel extends Model<LockdownStateDocument> {
  getOrCreate(guildId: string): Promise<LockdownStateDocument>;
}

const channelOverwriteSnapshotSchema = new Schema<IChannelOverwriteSnapshot>({
  channelId:     { type: String, required: true },
  roleId:        { type: String, default: null },
  previousAllow: { type: String, default: '0' },
  previousDeny:  { type: String, default: '0' },
  hadOverwrite:  { type: Boolean, default: false },
}, { _id: false });

const lockdownStateSchema = new Schema<LockdownStateDocument, LockdownStateModel>({
  guildId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  active:              { type: Boolean, default: false },
  lockedBy:            { type: String, default: null },
  lockedAt:            { type: Date, default: null },
  channelSnapshots:    { type: [channelOverwriteSnapshotSchema], default: [] },
  invitesWereDisabled: { type: Boolean, default: false },
}, {
  timestamps: true,
});

lockdownStateSchema.statics.getOrCreate = async function (guildId: string) {
  let state = await this.findOne({ guildId });
  if (!state) {
    state = await this.create({ guildId });
  }
  return state;
};

export default model<LockdownStateDocument, LockdownStateModel>('LockdownState', lockdownStateSchema);
