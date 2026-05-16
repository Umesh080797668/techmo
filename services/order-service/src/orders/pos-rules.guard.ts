/**
 * POS Mistake-Prevention Guard
 *
 * Section 5.7 – POS Rules  (ENTERPRISE_ECOMMERCE_SYSTEM.md)
 *
 * Enforced rules:
 *  1. Discount > 25 %   → requires manager PIN + writes an AuditLog entry
 *  2. Incompatible part+device → returns 422 with a red-flag warning
 *  3. Same employee voids > 3 / day → fires a Telegram alert + writes AuditLog
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const MAX_DISCOUNT_PCT   = 25;
const MAX_VOIDS_PER_DAY  = 3;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID   ?? '';

@Injectable()
export class PosRulesGuard implements CanActivate {
  private readonly logger = new Logger(PosRulesGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest();
    const body = req.body ?? {};
    const employeeId: string = (req as any).user?.sub ?? body.employeeId ?? 'unknown';

    // ─── Rule 1: Discount cap ────────────────────────────────────────────────
    const discountPct: number = Number(body.discountPercent ?? body.discount ?? 0);
    if (discountPct > MAX_DISCOUNT_PCT) {
      const managerPin: string | undefined = req.headers['x-manager-pin'] as string;
      if (!managerPin || !this.validateManagerPin(managerPin)) {
        throw new HttpException(
          {
            statusCode: HttpStatus.FORBIDDEN,
            error: 'DISCOUNT_REQUIRES_MANAGER_APPROVAL',
            message: `Discounts above ${MAX_DISCOUNT_PCT}% require manager PIN authorisation.`,
          },
          HttpStatus.FORBIDDEN,
        );
      }
      await this.writeAuditLog(
        'HIGH_DISCOUNT_APPROVED',
        employeeId,
        { discountPct, orderId: body.orderId, managerPin: '***' },
      );
    }

    // ─── Rule 2: Incompatible part + device ──────────────────────────────────
    if (body.items?.length) {
      const hasIncompatible = await this.checkCompatibility(body.items, body.deviceModelId);
      if (hasIncompatible) {
        throw new HttpException(
          {
            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
            error: 'INCOMPATIBLE_PART_DEVICE',
            message: 'One or more selected parts are flagged as incompatible with the specified device model.',
            flag: 'red',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // ─── Rule 3: Excessive voids by same employee ────────────────────────────
    if (body.isVoid || body.action === 'void') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const voidCount = await this.prisma.auditLog.count({
        where: {
          action:    'VOID',
          actorId:   employeeId,
          createdAt: { gte: todayStart },
        },
      });

      if (voidCount >= MAX_VOIDS_PER_DAY) {
        await this.sendTelegramAlert(employeeId, voidCount + 1);
        await this.writeAuditLog(
          'EXCESSIVE_VOIDS_ALERT',
          employeeId,
          { voidCount: voidCount + 1, date: new Date().toISOString() },
        );
      }
    }

    return true;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private validateManagerPin(pin: string): boolean {
    const MANAGER_PIN = process.env.MANAGER_PIN ?? '0000';
    return pin === MANAGER_PIN;
  }

  private async checkCompatibility(items: any[], deviceModelId?: string): Promise<boolean> {
    if (!deviceModelId) return false;

    const productServiceUrl =
      process.env.PRODUCT_SERVICE_URL ?? 'http://product-service:3001';

    for (const item of items) {
      const productId: string | undefined = item.productId ?? item.partId;
      if (!productId) continue;

      try {
        const url =
          `${productServiceUrl}/api/v1/compatibility/check` +
          `?productId=${encodeURIComponent(productId)}` +
          `&deviceModelId=${encodeURIComponent(deviceModelId)}`;

        const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
        if (!res.ok) {
          this.logger.warn(
            `Compatibility check HTTP ${res.status} for product ${productId} / device ${deviceModelId}`,
          );
          continue;
        }

        const { compatible } = (await res.json()) as { compatible: boolean };
        if (compatible === false) {
          this.logger.warn(
            `Incompatible part detected: productId=${productId} deviceModelId=${deviceModelId}`,
          );
          return true;
        }
      } catch (err) {
        this.logger.warn(
          `Compatibility check failed for product ${productId} / device ${deviceModelId}: ${
            (err as Error).message
          }`,
        );
      }
    }
    return false;
  }

  private async writeAuditLog(
    action: string,
    actorId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { action, actorId, metadata: JSON.stringify(metadata) },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  private async sendTelegramAlert(employeeId: string, voidCount: number): Promise<void> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

    const text =
      `⚠️ *POS Alert*\n\nEmployee \`${employeeId}\` has processed *${voidCount} voids* today, ` +
      `exceeding the threshold of ${MAX_VOIDS_PER_DAY}.\n\nPlease review immediately.`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
      await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' }),
      });
    } catch (err) {
      this.logger.error(`Telegram alert failed: ${(err as Error).message}`);
    }
  }
}
