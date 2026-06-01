import { LimitOrder } from '../database/models/LimitOrder';
import { solanaService } from '../services/solana';
import { swapEngine } from './swap';
import { logger } from '../utils/logger';

export class LimitOrderEngine {
  private checkInterval: NodeJS.Timeout | null = null;

  start(): void {
    this.checkInterval = setInterval(() => this.checkOrders(), 10000);
    logger.info('Limit order engine started');
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkOrders(): Promise<void> {
    const orders = await LimitOrder.find({ status: 'active' });

    for (const order of orders) {
      try {
        const price = await solanaService.getTokenPrice(order.mint);
        if (!price) continue;

        const triggerPrice = parseFloat(order.triggerPrice);

        if (order.type === 'buy' && price <= triggerPrice) {
          await this.fillOrder(order);
        } else if (order.type === 'sell' && price >= triggerPrice) {
          await this.fillOrder(order);
        }
      } catch (error) {
        logger.error({ error, orderId: order._id }, 'Error checking limit order');
      }
    }
  }

  private async fillOrder(order: any): Promise<void> {
    const amount = parseFloat(order.amount);

    let result: { success: boolean; signature?: string; error?: string };
    if (order.type === 'buy') {
      result = await swapEngine.buyToken(order.telegramId, order.walletId.toString(), order.mint, amount);
    } else {
      result = await swapEngine.sellToken(order.telegramId, order.walletId.toString(), order.mint, amount);
    }

    if (result.success) {
      order.status = 'filled';
      order.filledAmount = order.amount;
      order.filledAt = new Date();
      await order.save();
      logger.info({ orderId: order._id, signature: result.signature }, 'Limit order filled');
    }
  }

  async createOrder(
    telegramId: number,
    walletId: string,
    mint: string,
    type: 'buy' | 'sell',
    triggerPrice: string,
    amount: string
  ): Promise<string> {
    const order = await LimitOrder.create({
      telegramId,
      walletId,
      mint,
      type,
      triggerPrice,
      amount,
    });
    logger.info({ telegramId, mint, type, triggerPrice, amount }, 'Limit order created');
    return order._id.toString();
  }

  async cancelOrder(orderId: string, telegramId: number): Promise<boolean> {
    const result = await LimitOrder.updateOne(
      { _id: orderId, telegramId, status: 'active' },
      { status: 'cancelled' }
    );
    return result.modifiedCount > 0;
  }

  async getOrders(telegramId: number, status?: string): Promise<any[]> {
    const filter: any = { telegramId };
    if (status) filter.status = status;
    return LimitOrder.find(filter).sort({ createdAt: -1 });
  }
}

export const limitOrderEngine = new LimitOrderEngine();
