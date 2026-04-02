import { Schema, model, Document } from 'mongoose';
import { RSS_MAX_SEEN_ITEM_IDS } from '../utils/rssDefaults';

export interface IRssFeedState {
  guildId: string;
  feedId: string;
  seenItemIds: string[];
  etag: string | null;
  lastModified: string | null;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
}

export interface RssFeedStateDocument extends IRssFeedState, Document {}

const rssFeedStateSchema = new Schema<RssFeedStateDocument>(
  {
    guildId: { type: String, required: true, index: true },
    feedId: { type: String, required: true },
    seenItemIds: {
      type: [String],
      default: [],
      validate: {
        validator: function (v: string[]) {
          return v.length <= RSS_MAX_SEEN_ITEM_IDS;
        },
        message: `seenItemIds cannot exceed ${RSS_MAX_SEEN_ITEM_IDS}`,
      },
    },
    etag: { type: String, default: null },
    lastModified: { type: String, default: null },
    lastCheckedAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    consecutiveFailures: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  },
);

rssFeedStateSchema.index({ guildId: 1, feedId: 1 }, { unique: true });

export default model<RssFeedStateDocument>('RssFeedState', rssFeedStateSchema);
