import { VersionedTransaction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';
import { Transaction } from '../database/models/Transaction';
import { solanaService } from '../services/solana';
import { walletManager } from '../wallet/manager';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: null | { amount: string; feeBps: number };
  priceImpactPct: string;
  routePlan: Array<{ poolInfo: { label: string }; percent: number }>;
  contextSlot: number;
  timeTaken: number;
}

export class SwapEngine {
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps = 500
  ): Promise<QuoteResponse | null> {
    try {
      const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);
      const response = await axios.get(`${config.jupiterApiUrl}/quote`, {
        params: {
          inputMint,
          outputMint,
          amount: amountLamports,
          slippageBps,
          platformFeeBps: 0,
        },
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      logger.error({ error, inputMint, outputMint, amount }, 'Failed to get quote');
      return null;
    }
  }

  async executeSwap(
    keypair: Keypair,
    quoteResponse: QuoteResponse,
    swapMode: 'ExactIn' | 'ExactOut' = 'ExactIn'
  ): Promise<string | null> {
    try {
      const swapResponse = await axios.post(
        `${config.jupiterApiUrl}/swap`,
        {
          quoteResponse,
          userPublicKey: keypair.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        },
        { timeout: 30000 }
      );

      const { swapTransaction } = swapResponse.data;
      const txBuf = Buffer.from(swapTransaction, 'base64');
      const tx = VersionedTransaction.deserialize(txBuf);
      tx.sign([keypair]);

      const rawTx = tx.serialize();
      const signature = await solanaService.getConnection().sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 3,
      });

      return signature;
    } catch (error) {
      logger.error({ error, quote: quoteResponse }, 'Swap execution failed');
      return null;
    }
  }

  async buyToken(
    telegramId: number,
    walletId: string,
    mint: string,
    amountSol: number,
    slippageBps = 500
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    const keypair = await walletManager.getKeypair(walletId, telegramId);
    if (!keypair) return { success: false, error: 'Wallet not found' };

    const balance = await solanaService.getSolBalance(keypair.publicKey.toBase58());
    if (balance < amountSol) {
      return { success: false, error: `Insufficient SOL. Balance: ${balance.toFixed(4)} SOL` };
    }

    const quote = await this.getQuote(
      'So11111111111111111111111111111111111111112',
      mint,
      amountSol,
      slippageBps
    );

    if (!quote) return { success: false, error: 'Failed to get quote' };

    const signature = await this.executeSwap(keypair, quote);
    if (!signature) return { success: false, error: 'Transaction failed' };

    const confirmed = await solanaService.confirmTransaction(signature);

    await Transaction.create({
      telegramId,
      walletId,
      type: 'buy',
      mint,
      amount: amountSol.toString(),
      txSignature: signature,
      status: confirmed ? 'confirmed' : 'pending',
      slippageBps,
    });

    return { success: confirmed, signature };
  }

  async sellToken(
    telegramId: number,
    walletId: string,
    mint: string,
    amount: number,
    slippageBps = 500
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    const keypair = await walletManager.getKeypair(walletId, telegramId);
    if (!keypair) return { success: false, error: 'Wallet not found' };

    const tokenBalance = await solanaService.getTokenBalance(keypair.publicKey.toBase58(), mint);
    if (!tokenBalance || tokenBalance.amount === BigInt(0)) {
      return { success: false, error: 'No token balance to sell' };
    }

    const amountLamports = amount > 0 ? BigInt(Math.floor(amount * 10 ** tokenBalance.decimals)) : tokenBalance.amount;

    const quote = await this.getQuote(mint, 'So11111111111111111111111111111111111111112', Number(amountLamports) / LAMPORTS_PER_SOL, slippageBps);
    if (!quote) return { success: false, error: 'Failed to get quote' };

    const signature = await this.executeSwap(keypair, quote);
    if (!signature) return { success: false, error: 'Transaction failed' };

    const confirmed = await solanaService.confirmTransaction(signature);

    await Transaction.create({
      telegramId,
      walletId,
      type: 'sell',
      mint,
      amount: amount.toString(),
      txSignature: signature,
      status: confirmed ? 'confirmed' : 'pending',
      slippageBps,
    });

    return { success: confirmed, signature };
  }
}

export const swapEngine = new SwapEngine();
