import mongoose, { Schema, Document } from 'mongoose';

export interface ILimitOrder extends Document {
  telegramId: number;
  walletId: mongoose.Types.ObjectId;
  mint: string;
  type: 'buy' | 'sell';
  triggerPrice: string;
  amount: string;
  filledAmount: string;
  status: 'active' | 'filled' | 'cancelled' | 'expired';
  createdAt: Date;
  filledAt?: Date;
}

const LimitOrderSchema = new Schema<ILimitOrder>({
  telegramId: { type: Number, required: true },
  walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
  mint: { type: String, required: true },
  type: { type: String, enum: ['buy', 'sell'], required: true },
  triggerPrice: { type: String, required: true },
  amount: { type: String, required: true },
  filledAmount: { type: String, default: '0' },
  status: { type: String, enum: ['active', 'filled', 'cancelled', 'expired'], default: 'active' },
  filledAt: { type: Date },
}, { timestamps: true });

LimitOrderSchema.index({ telegramId: 1, status: 1 });

export const LimitOrder = mongoose.model<ILimitOrder>('LimitOrder', LimitOrderSchema);
