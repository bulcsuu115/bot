import mongoose, { Schema, Document } from 'mongoose';

export interface ICopyTrade extends Document {
  telegramId: number;
  walletId: mongoose.Types.ObjectId;
  targetWallet: string;
  maxBuySol: string;
  minBuySol: string;
  isActive: boolean;
  createdAt: Date;
}

const CopyTradeSchema = new Schema<ICopyTrade>({
  telegramId: { type: Number, required: true },
  walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
  targetWallet: { type: String, required: true },
  maxBuySol: { type: String, default: '1.0' },
  minBuySol: { type: String, default: '0.01' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const CopyTrade = mongoose.model<ICopyTrade>('CopyTrade', CopyTradeSchema);
