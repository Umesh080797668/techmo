/**
 * IpThrottleMiddleware — Redis-backed per-IP DDoS protection.
 *
 * Applied to ALL proxied API routes (ProxyModule).
 * The NestJS ThrottlerGuard only covers controller routes; middleware is the
 * only mechanism that can protect the reverse-proxy paths.
 *
 * Two sliding windows are checked on every request:
 *   Tier-1  (60 s window)  — sustained traffic cap:  300 req / 60 s
 *   Tier-2  (10 s window)  — burst traffic cap:       60 req / 10 s
 *
 * IP extraction order (Cloudflare → nginx → direct):
 *   1. CF-Connecting-IP  (set by Cloudflare CDN)
 *   2. X-Real-IP         (set by nginx)
 *   3. X-Forwarded-For   (first entry in the chain)
 *   4. req.ip            (direct / Express fallback)
 */
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../util/redis.service';

@Injectable()
export class IpThrottleMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpThrottleMiddleware.name);

  // ── Tier 1 — sustained window ──────────────────────────────────────────────
  private readonly WINDOW_60S = 60;
  private readonly LIMIT_60S  = 300;

  // ── Tier 2 — burst window ──────────────────────────────────────────────────
  private readonly WINDOW_10S = 10;
  private readonly LIMIT_10S  = 60;

  constructor(private readonly redis: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const ip = this.extractIp(req);

    let count60 = 0;
    let count10 = 0;

    try {
      // Increment both counters atomically; each key auto-expires after its window.
      [count60, count10] = await Promise.all([
        this.redis.incr(`ddos:60:${ip}`, this.WINDOW_60S),
        this.redis.incr(`ddos:10:${ip}`, this.WINDOW_10S),
      ]);
    } catch (err: any) {
      // Redis is unreachable or returned an error. Fail-open: let the request
      // through rather than silently dropping it (which causes ERR_EMPTY_RESPONSE
      // in the browser). The error is logged so ops can detect the outage.
      this.logger.error(`[IpThrottle] Redis unavailable — failing open: ${err?.message}`);
      next();
      return;
    }

    // Forward rate-limit headers so legitimate clients can adapt.
    res.setHeader('X-RateLimit-Limit',     String(this.LIMIT_60S));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, this.LIMIT_60S - count60)));
    res.setHeader('X-RateLimit-Reset',     String(Math.ceil(Date.now() / 1000) + this.WINDOW_60S));

    if (count60 > this.LIMIT_60S || count10 > this.LIMIT_10S) {
      const retryAfter = count10 > this.LIMIT_10S ? this.WINDOW_10S : this.WINDOW_60S;
      this.logger.warn(
        `[DDOS] Rate limit exceeded — IP: ${ip} — 60s=${count60}/${this.LIMIT_60S}  10s=${count10}/${this.LIMIT_10S}`,
      );
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'You are sending requests too quickly. Please slow down.',
      });
      return;
    }

    next();
  }

  private extractIp(req: Request): string {
    return (
      (req.headers['cf-connecting-ip']  as string)                    ||
      (req.headers['x-real-ip']         as string)                    ||
      (req.headers['x-forwarded-for']   as string)?.split(',')[0]?.trim() ||
      req.ip                                                           ||
      '0.0.0.0'
    );
  }
}
