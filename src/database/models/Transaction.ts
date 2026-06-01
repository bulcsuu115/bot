import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  telegramId: number;
  walletId: mongoose.Types.ObjectId;
  type: 'buy' | 'sell' | 'transfer' | 'create_token';
  mint: string;
  amount: string;
  priceUsd?: string;
  txSignature?: string;
  status: 'pending' | 'confirmed' | 'failed';
  slippageBps: number;
  createdAt: Date;
  confirmedAt?: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  telegramId: { type: Number, required: true },
  walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
  type: { type: String, enum: ['buy', 'sell', 'transfer', 'create_token'], required: true },
  mint: { type: String, required: true },
  amount: { type: String, required: true },
  priceUsd: { type: String },
  txSignature: { type: String },
  status: { type: String, enum: ['pending', 'confirmed', 'failed'], default: 'pending' },
  slippageBps: { type: Number, default: 500 },
  confirmedAt: { type: Date },
}, { timestamps: true });

TransactionSchema.index({ telegramId: 1, createdAt: -1 });
TransactionSchema.index({ walletId: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
