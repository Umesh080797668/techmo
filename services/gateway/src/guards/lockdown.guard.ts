/**
 * LockdownGuard — Read-Only Emergency Lockdown
 *
 * When activated (via Redis key `techmo:lockdown`), this guard:
 *  - Returns HTTP 423 (Locked) for all mutating requests (POST, PUT, PATCH, DELETE)
 *  - Allows GET and HEAD requests through (read-only mode)
 *  - Can be toggled via the /api/v1/admin/lockdown endpoint (SUPER_ADMIN only)
 *
 * Usage: Apply as a global guard in app.module.ts:
 *   providers: [{ provide: APP_GUARD, useClass: LockdownGuard }]
 */
import {
  Injectable, CanActivate, ExecutionContext,
  HttpException, Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../util/redis.service';

export const BYPASS_LOCKDOWN_KEY = 'bypassLockdown';

/** Decorator to exempt an endpoint from lockdown (e.g., health check, lockdown toggle itself) */
export const BypassLockdown = () => require('@nestjs/common').SetMetadata(BYPASS_LOCKDOWN_KEY, true);

export const LOCKDOWN_REDIS_KEY = 'techmo:lockdown';
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class LockdownGuard implements CanActivate {
  private readonly logger = new Logger(LockdownGuard.name);

  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Allow bypassed routes (health, lockdown toggle)
    const bypass = this.reflector.getAllAndOverride<boolean>(BYPASS_LOCKDOWN_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (bypass) return true;

    const req = ctx.switchToHttp().getRequest<Request>();

    // Read-only methods always pass through
    if (READ_METHODS.has((req as any).method)) return true;

    // Check Redis lockdown flag
    const lockdown = await this.redis.get(LOCKDOWN_REDIS_KEY);
    if (lockdown === '1') {
      this.logger.warn(
        `[LOCKDOWN] Blocked ${(req as any).method} ${(req as any).url} — system in read-only mode`,
      );
      throw new HttpException(
        {
          statusCode: 423,
          message:
            '🔒 TechMo is currently in emergency read-only mode. Mutating operations are temporarily suspended.',
          error: 'System Lockdown',
          readOnly: true,
        },
        423,
      );
    }

    return true;
  }
}
