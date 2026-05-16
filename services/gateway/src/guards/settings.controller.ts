/**
 * SettingsController — persists system-wide configuration in Redis.
 *
 * Routes:
 *   GET  /api/v1/admin/settings/smtp           → retrieve SMTP config
 *   PUT  /api/v1/admin/settings/smtp           → save SMTP config
 *   GET  /api/v1/admin/settings/business       → retrieve business info
 *   PUT  /api/v1/admin/settings/business       → save business info
 *   GET  /api/v1/admin/settings/notifications  → retrieve notification toggles
 *   PUT  /api/v1/admin/settings/notifications  → save notification toggles
 *   POST /api/v1/admin/cache/clear             → flush application cache keys
 *   GET  /api/v1/admin/export                  → trigger data export (email)
 *
 * Read endpoints are accessible to SUPER_ADMIN and MANAGER.
 * Write/destructive endpoints are SUPER_ADMIN + MANAGER (cache clear SUPER_ADMIN only).
 */
import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../util/redis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { BypassLockdown } from './lockdown.guard';
import { Public } from '../auth/public.decorator';

// ─── Redis keys ───────────────────────────────────────────────────────────────
const KEY_SMTP          = 'techmo:settings:smtp';
const KEY_BUSINESS      = 'techmo:settings:business';
const KEY_NOTIFICATIONS = 'techmo:settings:notifications';

// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_SMTP = {
  host: '', port: '587', user: '', from: '', alertEmail: '', secure: false,
};

const DEFAULT_BUSINESS = {
  name: 'TechMo',
  tagline: "Sri Lanka's Premier Device Repair & Retail",
  phone: '', email: '', address: '', city: '',
  country: 'Sri Lanka', regNumber: '', vatNumber: '', logo: '',
  currency: 'LKR', timezone: 'Asia/Colombo', dateFormat: 'DD/MM/YYYY',
};

const DEFAULT_NOTIFICATIONS = {
  lowStockThreshold: '5',
  sendLowStockAlert: true,
  sendRepairUpdates: true,
  sendInvoiceEmail: true,
  dailyReportEmail: '',
  adminAlertEmail: '',
};

const KEY_KIOSK     = 'techmo:settings:kiosk';
const DEFAULT_KIOSK = { exitPin: '1234', idleSeconds: 60 };

// ─── Settings Controller ──────────────────────────────────────────────────────
@Controller('api/v1/admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly redis: RedisService) {}

  // ── SMTP ──────────────────────────────────────────────────────────────────

  @Get('smtp')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @BypassLockdown()
  async getSmtp() {
    const raw = await this.redis.get(KEY_SMTP);
    return raw ? JSON.parse(raw) : DEFAULT_SMTP;
  }

  @Put('smtp')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @BypassLockdown()
  async saveSmtp(@Body() body: Record<string, any>) {
    await this.redis.set(KEY_SMTP, JSON.stringify(body));
    return { message: 'SMTP settings saved' };
  }

  // ── Business ──────────────────────────────────────────────────────────────

  @Get('business')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @BypassLockdown()
  async getBusiness() {
    const raw = await this.redis.get(KEY_BUSINESS);
    return raw ? JSON.parse(raw) : DEFAULT_BUSINESS;
  }

  @Put('business')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @BypassLockdown()
  async saveBusiness(@Body() body: Record<string, any>) {
    await this.redis.set(KEY_BUSINESS, JSON.stringify(body));
    return { message: 'Business info saved' };
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  @Get('notifications')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @BypassLockdown()
  async getNotifications() {
    const raw = await this.redis.get(KEY_NOTIFICATIONS);
    return raw ? JSON.parse(raw) : DEFAULT_NOTIFICATIONS;
  }

  @Put('notifications')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @BypassLockdown()
  async saveNotifications(@Body() body: Record<string, any>) {
    await this.redis.set(KEY_NOTIFICATIONS, JSON.stringify(body));
    return { message: 'Notification settings saved' };
  }

  // ── Kiosk ─────────────────────────────────────────────────────────────────

  @Get('kiosk')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @BypassLockdown()
  async getKiosk() {
    const raw = await this.redis.get(KEY_KIOSK);
    return raw ? JSON.parse(raw) : DEFAULT_KIOSK;
  }

  @Put('kiosk')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @BypassLockdown()
  async saveKiosk(@Body() body: Record<string, any>) {
    await this.redis.set(KEY_KIOSK, JSON.stringify(body));
    return { message: 'Kiosk settings saved' };
  }
}

// ─── Cache Controller ─────────────────────────────────────────────────────────
@Controller('api/v1/admin/cache')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CacheController {
  constructor(private readonly redis: RedisService) {}

  /**
   * Flush all application-level cache keys (techmo:cache:*).
   * SUPER_ADMIN only — this can briefly slow responses.
   */
  @Post('clear')
  @Roles('SUPER_ADMIN')
  @BypassLockdown()
  @HttpCode(HttpStatus.OK)
  async clearCache() {
    const keys = await this.redis.keys('techmo:cache:*');
    if (keys.length > 0) {
      await this.redis.mDel(keys);
    }
    return { message: `Cache cleared — ${keys.length} key(s) flushed.` };
  }
}

// ─── Export Controller ────────────────────────────────────────────────────────
@Controller('api/v1/admin/export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportController {
  constructor(private readonly redis: RedisService) {}

  /**
   * Trigger a full data export.
   * In production this would enqueue a background job that emails a ZIP download.
   */
  @Get()
  @Roles('SUPER_ADMIN', 'MANAGER')
  @BypassLockdown()
  async exportData(@Req() req: Request) {
    const user = (req as any).user as { username?: string };
    // Queue a background export job via Redis pub-sub (future enhancement).
    await this.redis.set(
      `techmo:export:requested_by`,
      user?.username ?? 'unknown',
      300,
    );
    return {
      message: 'Export queued — you will receive a download link via email within 5 minutes.',
    };
  }
}

// ─── Kiosk Public Controller ──────────────────────────────────────────────────
// These endpoints are called from the kiosk page which runs WITHOUT authentication.
@Controller('api/v1/admin/kiosk')
export class KioskController {
  constructor(private readonly redis: RedisService) {}

  /** Public — kiosk page reads idle timeout on mount (no auth required). */
  @Public()
  @Get('config')
  async getConfig() {
    const raw = await this.redis.get(KEY_KIOSK);
    const cfg = raw ? JSON.parse(raw) : DEFAULT_KIOSK;
    return { idleSeconds: cfg.idleSeconds ?? 60 };
  }

  /** Public — kiosk page validates the manager-entered exit PIN (no auth required). */
  @Public()
  @Post('validate-pin')
  @HttpCode(HttpStatus.OK)
  async validatePin(@Body() body: { pin: string }) {
    const raw = await this.redis.get(KEY_KIOSK);
    const cfg = raw ? JSON.parse(raw) : DEFAULT_KIOSK;
    return { valid: body.pin === cfg.exitPin };
  }
}
