import mongoose from 'mongoose';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  const uri = config.mongoUri;
  if (!uri) {
    logger.error('MONGODB_URI is not set');
    process.exit(1);
  }

  logger.info({ uri: uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') }, 'Connecting to MongoDB');

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connected successfully');
  } catch (error: any) {
    logger.error({ err: error?.message || String(error) }, 'MongoDB connection failed');
    process.exit(1);
  }
}
