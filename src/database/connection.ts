import mongoose from 'mongoose';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  const uri = config.mongoUri;
  if (!uri) {
    logger.error('MONGODB_URI is not set in .env file');
    process.exit(1);
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error({ error }, 'MongoDB connection failed');
    process.exit(1);
  }
}
