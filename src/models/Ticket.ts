import { Schema, model, Document, Model } from 'mongoose';
import type { ITicket } from '../types';

export interface TicketDocument extends ITicket, Document {}

export interface TicketModel extends Model<TicketDocument> {
  getNextNumber(guildId: string): Promise<number>;
}

const ticketSchema = new Schema<TicketDocument, TicketModel>(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, unique: true },
    openedBy: { type: String, required: true },
    ticketNumber: { type: Number, required: true },
    subject: { type: String, default: null },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    claimedBy: { type: String, default: null },
    claimedAt: { type: Date, default: null },
    closedBy: { type: String, default: null },
    closedAt: { type: Date, default: null },
    participants: { type: [String], default: [] },
    transcript: {
      type: [
        {
          authorId: String,
          authorName: String,
          avatarURL: String,
          content: String,
          attachments: [{ url: String, name: String }],
          timestamp: Date,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

ticketSchema.index({ guildId: 1, ticketNumber: 1 }, { unique: true });
ticketSchema.index({ guildId: 1, openedBy: 1, status: 1 });

ticketSchema.statics.getNextNumber = async function (guildId: string) {
  const last = await this.findOne({ guildId }).sort({ ticketNumber: -1 }).lean();
  return (last?.ticketNumber || 0) + 1;
};

export default model<TicketDocument, TicketModel>('Ticket', ticketSchema);
