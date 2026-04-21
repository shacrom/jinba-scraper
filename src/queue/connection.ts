import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
});

connection.on('connect', () => logger.debug('redis connected'));
connection.on('error', (err: Error) => logger.error({ err }, 'redis error'));
connection.on('close', () => logger.warn('redis connection closed'));
