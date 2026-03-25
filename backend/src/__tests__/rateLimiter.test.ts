import request from 'supertest';
import app from '../app.js';
import { Redis } from 'ioredis';
import { config } from '../config/env.js';

describe('Rate Limiting Integration', () => {
  let redis: Redis;

  beforeAll(async () => {
    if (config.REDIS_URL) {
      redis = new Redis(config.REDIS_URL);
    }
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  beforeEach(async () => {
    if (redis) {
      const keys = await redis.keys('ratelimit:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  });

  it('should include rate limit headers for API routes', async () => {
    const response = await request(app).get('/health');
    
    // Use health which is not rate limited but we can check an API route
    const apiResponse = await request(app).get('/api/v1/rate-limit/tiers');
    
    expect(apiResponse.headers).toHaveProperty('x-ratelimit-limit');
    expect(apiResponse.headers).toHaveProperty('x-ratelimit-remaining');
    expect(apiResponse.headers).toHaveProperty('x-ratelimit-reset');
  });

  it('should return 404/200 but still have headers even if unauthenticated', async () => {
    const response = await request(app).get('/api/non-existent-route');
    // It should hit the middleware before failing with 404 or 401
    expect(response.headers).toHaveProperty('x-ratelimit-limit');
  });

  it('should use different tiers for different routes', async () => {
    const authResponse = await request(app).post('/auth/login');
    const apiResponse = await request(app).get('/api/v1/rate-limit/tiers');
    
    expect(authResponse.headers['x-ratelimit-limit']).not.toBeUndefined();
    expect(apiResponse.headers['x-ratelimit-limit']).not.toBeUndefined();
    
    // Auth limit is 10, API limit is 100
    expect(authResponse.headers['x-ratelimit-limit']).toBe("10");
    expect(apiResponse.headers['x-ratelimit-limit']).toBe("100");
  });
});
