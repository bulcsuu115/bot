import { Bot } from 'grammy';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { connectDatabase } from './database/connection';
import { registerCommands } from './bot/commands';
import { limitOrderEngine } from './trading/limit';
import { forwardEngine } from './trading/forward';
import { balanceUpdater } from './trading/balanceUpdater';
import { createWebApp } from './web/server';

async function main() {
  logger.info('Starting Solana Trojan Bot v2.0...');

  if (!config.botToken) {
    logger.error('BOT_TOKEN is not set');
    process.exit(1);
  }

  if (!config.encryptionKey || config.encryptionKey.length !== 64) {
    logger.error('ENCRYPTION_KEY must be 64 hex chars');
    process.exit(1);
  }

  if (!config.mongoUri) {
    logger.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await connectDatabase();

  limitOrderEngine.start();
  balanceUpdater.start();
  forwardEngine.start();

  const bot = new Bot(config.botToken);
  registerCommands(bot);

  bot.catch((err) => {
    logger.error({ error: err }, 'Bot error');
  });

  const app = createWebApp();
  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Web dashboard started');
  });

  logger.info('Bot starting polling...');
  await bot.start({ drop_pending_updates: true });
}

main().catch((err) => {
  logger.error({ error: err }, 'Fatal error');
  process.exit(1);
});
