import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { Wallet } from '../database/models/Wallet';
import { User } from '../database/models/User';
import { encryptPrivateKey, decryptPrivateKey } from '../utils/encrypt';
import { logger } from '../utils/logger';

export interface WalletInfo {
  id: string;
  userId: string;
  telegramId: number;
  label: string;
  publicKey: string;
  createdAt: Date;
}

export class WalletManager {
  async ensureUser(telegramId: number, username?: string): Promise<void> {
    const exists = await User.findOne({ telegramId });
    if (!exists) {
      await User.create({ telegramId, username });
      logger.info({ telegramId }, 'New user created');
    }
  }

  async createWallet(telegramId: number, label = 'main'): Promise<WalletInfo> {
    await this.ensureUser(telegramId);
    const user = await User.findOne({ telegramId })!;

    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const privateKeyHex = Buffer.from(keypair.secretKey).toString('hex');
    const encryptedKey = encryptPrivateKey(privateKeyHex);

    const wallet = await Wallet.create({
      userId: user!._id,
      telegramId,
      label,
      publicKey,
      encryptedPrivateKey: encryptedKey,
    });

    logger.info({ telegramId, publicKey, label }, 'New wallet created');
    return {
      id: wallet._id.toString(),
      userId: user!._id.toString(),
      telegramId,
      label,
      publicKey,
      createdAt: wallet.createdAt,
    };
  }

  async importWallet(telegramId: number, privateKeyOrSeed: string, label = 'main'): Promise<WalletInfo> {
    await this.ensureUser(telegramId);
    const user = await User.findOne({ telegramId })!;

    let keypair: Keypair;
    try {
      const decoded = bs58.decode(privateKeyOrSeed);
      if (decoded.length === 64) {
        keypair = Keypair.fromSecretKey(decoded);
      } else if (decoded.length === 32) {
        keypair = Keypair.fromSeed(decoded);
      } else {
        throw new Error('Invalid private key length');
      }
    } catch {
      const hexMatch = privateKeyOrSeed.match(/^[0-9a-fA-F]+$/);
      if (hexMatch) {
        const secretKey = new Uint8Array(privateKeyOrSeed.length / 2);
        for (let i = 0; i < secretKey.length; i++) {
          secretKey[i] = parseInt(privateKeyOrSeed.substring(i * 2, i * 2 + 2), 16);
        }
        keypair = Keypair.fromSecretKey(secretKey);
      } else {
        const seed = new Uint8Array(32);
        const encoder = new TextEncoder();
        const hash = encoder.encode(privateKeyOrSeed).slice(0, 32);
        seed.set(hash);
        keypair = Keypair.fromSeed(seed);
      }
    }

    const publicKey = keypair.publicKey.toBase58();
    const privateKeyHex = Buffer.from(keypair.secretKey).toString('hex');
    const encryptedKey = encryptPrivateKey(privateKeyHex);

    const wallet = await Wallet.create({
      userId: user!._id,
      telegramId,
      label,
      publicKey,
      encryptedPrivateKey: encryptedKey,
    });

    logger.info({ telegramId, publicKey, label }, 'Wallet imported');
    return {
      id: wallet._id.toString(),
      userId: user!._id.toString(),
      telegramId,
      label,
      publicKey,
      createdAt: wallet.createdAt,
    };
  }

  async getWallets(telegramId: number): Promise<WalletInfo[]> {
    const wallets = await Wallet.find({ telegramId }).sort({ createdAt: 1 });
    return wallets.map((w) => ({
      id: w._id.toString(),
      userId: w.userId.toString(),
      telegramId: w.telegramId,
      label: w.label,
      publicKey: w.publicKey,
      createdAt: w.createdAt,
    }));
  }

  async getAllWallets(): Promise<{ id: string; telegramId: number; publicKey: string }[]> {
    const wallets = await Wallet.find({}).select('telegramId publicKey');
    return wallets.map((w) => ({ id: w._id.toString(), telegramId: w.telegramId, publicKey: w.publicKey }));
  }

  async getKeypairById(walletId: string): Promise<Keypair | null> {
    const w = await Wallet.findById(walletId).select('encryptedPrivateKey');
    if (!w) return null;
    const privateKeyHex = decryptPrivateKey(w.encryptedPrivateKey);
    const secretKey = new Uint8Array(privateKeyHex.length / 2);
    for (let i = 0; i < secretKey.length; i++) {
      secretKey[i] = parseInt(privateKeyHex.substring(i * 2, i * 2 + 2), 16);
    }
    return Keypair.fromSecretKey(secretKey);
  }

  async getWallet(walletId: string, telegramId: number): Promise<WalletInfo | null> {
    const w = await Wallet.findOne({ _id: walletId, telegramId });
    if (!w) return null;
    return {
      id: w._id.toString(),
      userId: w.userId.toString(),
      telegramId: w.telegramId,
      label: w.label,
      publicKey: w.publicKey,
      createdAt: w.createdAt,
    };
  }

  async getKeypair(walletId: string, telegramId: number): Promise<Keypair | null> {
    const w = await Wallet.findOne({ _id: walletId, telegramId }).select('encryptedPrivateKey');
    if (!w) return null;

    const privateKeyHex = decryptPrivateKey(w.encryptedPrivateKey);
    const secretKey = new Uint8Array(privateKeyHex.length / 2);
    for (let i = 0; i < secretKey.length; i++) {
      secretKey[i] = parseInt(privateKeyHex.substring(i * 2, i * 2 + 2), 16);
    }
    return Keypair.fromSecretKey(secretKey);
  }

  async exportPrivateKey(walletId: string, telegramId: number): Promise<string | null> {
    const w = await Wallet.findOne({ _id: walletId, telegramId }).select('encryptedPrivateKey');
    if (!w) return null;
    return decryptPrivateKey(w.encryptedPrivateKey);
  }

  async deleteWallet(walletId: string, telegramId: number): Promise<boolean> {
    const result = await Wallet.deleteOne({ _id: walletId, telegramId });
    return result.deletedCount > 0;
  }
}

export const walletManager = new WalletManager();
