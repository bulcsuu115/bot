import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  telegramId: number;
  label: string;
  publicKey: string;
  encryptedPrivateKey: string;
  solBalance: number;
  usdValue: number;
  lastUpdated: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  telegramId: { type: Number, required: true },
  label: { type: String, default: 'main' },
  publicKey: { type: String, required: true },
  encryptedPrivateKey: { type: String, required: true },
  solBalance: { type: Number, default: 0 },
  usdValue: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: null },
}, { timestamps: true });

WalletSchema.index({ telegramId: 1 });

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
