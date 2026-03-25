import { ConnectionOptions } from 'bullmq';
import { config } from './env.js';

export const redisConnection: ConnectionOptions = {
    url: config.REDIS_URL || 'redis://localhost:6379',
};

export const PAYROLL_QUEUE_NAME = 'payroll-processing';
