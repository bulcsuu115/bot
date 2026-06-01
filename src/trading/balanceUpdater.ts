import { Wallet } from '../database/models/Wallet';
import { solanaService } from '../services/solana';
import { logger } from '../utils/logger';

const UPDATE_INTERVAL = 60000;

export class BalanceUpdater {
  private interval: NodeJS.Timeout | null = null;

  start(): void {
    logger.info('Balance updater started');
    this.updateAll();
    this.interval = setInterval(() => this.updateAll(), UPDATE_INTERVAL);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async updateAll(): Promise<void> {
    try {
      const wallets = await Wallet.find({});
      if (wallets.length === 0) return;

      const solPrice = await solanaService.getSolPrice();
      if (solPrice === null) {
        logger.warn('Failed to fetch SOL price, skipping balance update');
        return;
      }

      for (const w of wallets) {
        try {
          const solBalance = await solanaService.getSolBalance(w.publicKey);
          const usdValue = solBalance * solPrice;

          await Wallet.updateOne(
            { _id: w._id },
            { $set: { solBalance, usdValue: Math.round(usdValue * 100) / 100, lastUpdated: new Date() } }
          );
        } catch (err) {
          logger.error({ walletId: w._id.toString(), publicKey: w.publicKey, error: err }, 'Failed to update wallet balance');
        }
      }
    } catch (error) {
      logger.error({ error }, 'Balance updater cycle failed');
    }
  }
}

export const balanceUpdater = new BalanceUpdater();
