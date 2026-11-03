import { createClient, RedisClientType } from 'redis';

export const redisClient: RedisClientType = createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:6379`,
});

redisClient.on('error', (err) => console.error('[Redis Client Error]', err));

export async function connectRedis(retries = 10, delayMs = 2000): Promise<void> {
  while (retries > 0) {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
        console.log('[Redis] Connected to caching engine.');
      }
      return;
    } catch (err: any) {
      retries--;
      console.warn(`[Redis] Waiting for cache ready (${retries} attempts left)...`);
      if (retries === 0) throw err;
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

