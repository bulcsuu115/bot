import pino from 'pino';
import { config } from './config';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: config.logLevel,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino/file',
          options: { destination: './data/bot.log', mkdir: true },
        },
      }),
});
