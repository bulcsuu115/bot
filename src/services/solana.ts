import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export class SolanaService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(config.solanaRpcUrl, 'confirmed');
  }

  getConnection(): Connection {
    return this.connection;
  }

  async getSolBalance(publicKey: string): Promise<number> {
    try {
      const pk = new PublicKey(publicKey);
      const balance = await this.connection.getBalance(pk);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      logger.error({ error, publicKey }, 'Failed to get SOL balance');
      throw error;
    }
  }

  async getTokenBalance(publicKey: string, mint: string): Promise<{ amount: bigint; decimals: number } | null> {
    try {
      const owner = new PublicKey(publicKey);
      const mintPubkey = new PublicKey(mint);
      const ata = await getAssociatedTokenAddress(mintPubkey, owner);
      const account = await getAccount(this.connection, ata);
      return { amount: account.amount, decimals: 0 };
    } catch {
      return null;
    }
  }

  async getTokenInfo(mint: string): Promise<{ symbol: string; name: string; decimals: number } | null> {
    try {
      const pk = new PublicKey(mint);
      const accountInfo = await this.connection.getParsedAccountInfo(pk);
      const data = accountInfo.value?.data;
      if (data && typeof data === 'object' && 'parsed' in data) {
        const parsed = data.parsed.info;
        return {
          symbol: parsed.symbol || '',
          name: parsed.name || '',
          decimals: parsed.decimals || 0,
        };
      }
      return null;
    } catch (error) {
      logger.error({ error, mint }, 'Failed to get token info');
      return null;
    }
  }

  async getTokenPrice(mint: string): Promise<number | null> {
    try {
      const response = await fetch(
        `https://api.jup.ag/price/v2?ids=${mint}`
      );
      const data = await response.json() as { data?: Record<string, { price: string }> };
      if (data.data?.[mint]) {
        return parseFloat(data.data[mint].price);
      }
      return null;
    } catch {
      return null;
    }
  }

  async confirmTransaction(signature: string): Promise<boolean> {
    try {
      const result = await this.connection.confirmTransaction(signature, 'confirmed');
      return !result.value.err;
    } catch (error) {
      logger.error({ error, signature }, 'Transaction confirmation failed');
      return false;
    }
  }
}

export const solanaService = new SolanaService();
