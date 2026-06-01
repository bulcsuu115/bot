import { SniperConfig } from '../database/models/SniperConfig';
import { swapEngine } from './swap';
import { logger } from '../utils/logger';

export class SniperEngine {
  private activeJobs: Map<string, NodeJS.Timeout> = new Map();

  start(configId: string, telegramId: number, walletId: string, mint: string, amountSol: string): void {
    const interval = setInterval(async () => {
      const cfg = await SniperConfig.findOne({ _id: configId, isActive: true });
      if (!cfg) {
        this.stopByConfigId(configId);
        return;
      }

      const result = await swapEngine.buyToken(telegramId, walletId, mint, parseFloat(amountSol), cfg.slippageBps);
      if (result.success) {
        logger.info({ configId, mint, signature: result.signature }, 'Sniper bought token');
      }
    }, 2000);

    this.activeJobs.set(configId, interval);
    logger.info({ configId, mint, amountSol }, 'Sniper started');
  }

  stopByConfigId(configId: string): void {
    const interval = this.activeJobs.get(configId);
    if (interval) {
      clearInterval(interval);
      this.activeJobs.delete(configId);
    }
    SniperConfig.updateOne({ _id: configId }, { isActive: false }).exec();
    logger.info({ configId }, 'Sniper stopped');
  }
}

export const sniperEngine = new SniperEngine();
