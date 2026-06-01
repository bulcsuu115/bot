import mongoose from 'mongoose';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  let uri = config.mongoUri;
  logger.info({ rawUriPrefix: String(uri).substring(0, 25), rawUriLength: String(uri).length, uriType: typeof uri }, 'MongoDB URI check');
  uri = (uri || '').trim();
  if (!uri) {
    logger.error('MONGODB_URI is empty or not set');
    process.exit(1);
  }
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    logger.error({ uri: uri.substring(0, 50) }, 'MONGODB_URI has invalid scheme');
    process.exit(1);
  }

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
