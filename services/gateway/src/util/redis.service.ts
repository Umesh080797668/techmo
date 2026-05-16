import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Thin Redis wrapper — exposes only the operations needed by gateway services.
 * Backed by a single ioredis client configured from environment variables.
 *
 * Accepts either:
 *   REDIS_URL  = redis://:password@host:port   (preferred, set by docker-compose)
 *   REDIS_HOST + REDIS_PORT + REDIS_PASSWORD   (fallback for local dev)
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;

    this.client = redisUrl
      ? new Redis(redisUrl, {
          maxRetriesPerRequest: 0,
          enableOfflineQueue: false,
          lazyConnect: true,
        })
      : new Redis({
          host:     process.env.REDIS_HOST     ?? 'localhost',
          port:     parseInt(process.env.REDIS_PORT ?? '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: 0,
          enableOfflineQueue: false,
          lazyConnect: true,
        });

    this.client.on('error', (err) =>
      this.logger.warn(`Redis connection error: ${err.message}`),
    );
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => {});
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** Store a value; optionally expire after `ttlSeconds`. */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Atomically increment a counter and set its TTL on the first increment.
   * Returns the value AFTER incrementing.
   * Used by IpThrottleMiddleware for sliding-window rate limiting.
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const count = await this.client.incr(key);
    // Only set TTL on first creation — avoids resetting the window on every hit.
    if (count === 1 && ttlSeconds) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Return all keys matching a glob pattern (use with care on large datasets). */
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  /** Delete multiple keys at once. No-op if the array is empty. */
  async mDel(keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}
