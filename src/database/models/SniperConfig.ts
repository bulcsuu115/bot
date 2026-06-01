import mongoose, { Schema, Document } from 'mongoose';

export interface ISniperConfig extends Document {
  telegramId: number;
  walletId: mongoose.Types.ObjectId;
  mint?: string;
  buyAmountSol: string;
  slippageBps: number;
  isActive: boolean;
  createdAt: Date;
}

const SniperConfigSchema = new Schema<ISniperConfig>({
  telegramId: { type: Number, required: true },
  walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
  mint: { type: String },
  buyAmountSol: { type: String, default: '0.1' },
  slippageBps: { type: Number, default: 2500 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const SniperConfig = mongoose.model<ISniperConfig>('SniperConfig', SniperConfigSchema);
