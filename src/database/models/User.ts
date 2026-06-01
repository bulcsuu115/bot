import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  defaultSlippage: number;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String },
  defaultSlippage: { type: Number, default: 500 },
  isAdmin: { type: Boolean, default: false },
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
