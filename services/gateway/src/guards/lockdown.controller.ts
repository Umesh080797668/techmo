/**
 * Lockdown Controller — toggle emergency read-only mode via Redis.
 * Requires SUPER_ADMIN role (enforced by JwtAuthGuard + RolesGuard below).
 */
import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RedisService } from '../util/redis.service';
import { BypassLockdown, LOCKDOWN_REDIS_KEY } from '../guards/lockdown.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@ApiTags('Admin — Lockdown')
@ApiBearerAuth()
@Controller('api/v1/admin/lockdown')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LockdownController {
  constructor(private readonly redis: RedisService) {}

  @Get('status')
  @BypassLockdown()
  @ApiOperation({ summary: 'Check current lockdown status (any authenticated user)' })
  async status() {
    try {
      const active = (await this.redis.get(LOCKDOWN_REDIS_KEY)) === '1';
      const reason = await this.redis.get('techmo:lockdown_reason');
      return { lockdown: active, reason: reason ?? null };
    } catch {
      // Redis unavailable — system is not locked down
      return { lockdown: false, reason: null };
    }
  }

  @Post('activate')
  @BypassLockdown()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Activate emergency read-only lockdown (SUPER_ADMIN only)' })
  async activate(@Body() body: { reason?: string }) {
    await this.redis.set(LOCKDOWN_REDIS_KEY, '1');
    await this.redis.set('techmo:lockdown_reason', body.reason ?? 'Manual activation', 86400);
    return { lockdown: true, message: 'System is now in read-only emergency mode.' };
  }

  @Post('deactivate')
  @BypassLockdown()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Deactivate lockdown and resume normal operations (SUPER_ADMIN only)' })
  async deactivate() {
    await this.redis.del(LOCKDOWN_REDIS_KEY);
    await this.redis.del('techmo:lockdown_reason');
    return { lockdown: false, message: 'System resumed normal operations.' };
  }
}
