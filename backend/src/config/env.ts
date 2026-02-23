import { z } from 'zod';
import dotenv from 'dotenv';

// ok
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  THROTTLING_TPM: z.string().default('100'),
  THROTTLING_MAX_QUEUE_SIZE: z.string().default('1000'),
  THROTTLING_REFILL_INTERVAL_MS: z.string().default('1000'),
});

export const config = envSchema.parse(process.env);

export const getThrottlingConfig = () => ({
  tpm: parseInt(config.THROTTLING_TPM, 10),
  maxQueueSize: parseInt(config.THROTTLING_MAX_QUEUE_SIZE, 10),
  refillIntervalMs: parseInt(config.THROTTLING_REFILL_INTERVAL_MS, 10),
});
