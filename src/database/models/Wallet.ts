import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  telegramId: number;
  label: string;
  publicKey: string;
  encryptedPrivateKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  telegramId: { type: Number, required: true },
  label: { type: String, default: 'main' },
  publicKey: { type: String, required: true },
  encryptedPrivateKey: { type: String, required: true },
}, { timestamps: true });

WalletSchema.index({ telegramId: 1 });

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
