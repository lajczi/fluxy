import { Schema, model, Document, Model } from 'mongoose';

export interface IStat {
  type: string;
  value: string;
  additionalData?: Record<string, unknown>;
  createdAt: Date;
}

export interface StatDocument extends IStat, Document {}

export type StatModel = Model<StatDocument>;

const statSchema = new Schema<StatDocument, StatModel>({
  type: {
    type: String,
    required: true,
    index: true,
  },
  value: {
    type: String,
    required: true,
  },
  additionalData: {
    type: Schema.Types.Mixed,
    default: null,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

statSchema.index({ type: 1, createdAt: -1 });

export default model<StatDocument, StatModel>('Stat', statSchema);
