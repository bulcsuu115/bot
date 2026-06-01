import { PublicKey } from '@solana/web3.js';
import { solanaService } from '../services/solana';
import { swapEngine } from './swap';
import { CopyTrade } from '../database/models/CopyTrade';
import { logger } from '../utils/logger';

export class CopyTradeEngine {
  private activeJobs: Map<string, NodeJS.Timeout> = new Map();

  start(copyTradeId: string, telegramId: number, walletId: string, targetWallet: string, maxBuySol: string): void {
    let lastSignatures: Set<string> = new Set();

    const interval = setInterval(async () => {
      try {
        const cfg = await CopyTrade.findOne({ _id: copyTradeId, isActive: true });
        if (!cfg) {
          this.stopByConfigId(copyTradeId);
          return;
        }

        const pubkey = new PublicKey(targetWallet);
        const sigs = await solanaService.getConnection().getSignaturesForAddress(pubkey, { limit: 5 });

        for (const sig of sigs) {
          if (lastSignatures.has(sig.signature)) continue;
          lastSignatures.add(sig.signature);

          const tx = await solanaService.getConnection().getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
          if (!tx || !tx.meta || tx.meta.err) continue;

          const preBalances = tx.meta.preBalances;
          const postBalances = tx.meta.postBalances;
          const solChange = (postBalances[0] - preBalances[0]) / 1e9;

          if (solChange < 0 && Math.abs(solChange) >= parseFloat(cfg.minBuySol) && Math.abs(solChange) <= parseFloat(maxBuySol)) {
            logger.info({ copyTradeId, targetWallet, solChange }, 'Copy trading: detected buy');
            await swapEngine.buyToken(telegramId, walletId, 'So11111111111111111111111111111111111111112', Math.abs(solChange));
          }
        }

        if (lastSignatures.size > 100) {
          lastSignatures = new Set([...lastSignatures].slice(-50));
        }
      } catch (error) {
        logger.error({ error, copyTradeId }, 'Copy trade check failed');
      }
    }, 5000);

    this.activeJobs.set(copyTradeId, interval);
    logger.info({ copyTradeId, targetWallet }, 'Copy trade started');
  }

  stopByConfigId(copyTradeId: string): void {
    const interval = this.activeJobs.get(copyTradeId);
    if (interval) {
      clearInterval(interval);
      this.activeJobs.delete(copyTradeId);
    }
    CopyTrade.updateOne({ _id: copyTradeId }, { isActive: false }).exec();
    logger.info({ copyTradeId }, 'Copy trade stopped');
  }
}

export const copyTradeEngine = new CopyTradeEngine();
