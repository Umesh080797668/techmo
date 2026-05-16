import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatteryEntryDto } from './dto/create-battery-entry.dto';

@Injectable()
export class BatteryDegradationService {
  private readonly logger = new Logger(BatteryDegradationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Create entry ──────────────────────────────────────────────────────────

  async createEntry(inventoryId: string, dto: CreateBatteryEntryDto) {
    return this.prisma.batteryStockEntry.create({
      data: {
        inventoryId,
        receivedAt:       dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
        manufacturedAt:   dto.manufacturedAt ? new Date(dto.manufacturedAt) : null,
        shelfLifeDays:    dto.shelfLifeDays    ?? 730,
        alertFractionPct: dto.alertFractionPct ?? 80,
        batchNumber:      dto.batchNumber,
        ratedCapacityMah: dto.ratedCapacityMah,
        notes:            dto.notes,
      },
    });
  }

  // ── Query alerts ──────────────────────────────────────────────────────────

  async listAlerts(type?: string) {
    return this.prisma.batteryAlert.findMany({
      where: {
        acknowledgedAt: null,
        ...(type ? { alertType: type as never } : {}),
      },
      include: {
        entry: {
          include: { inventory: { select: { sku: true, location: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acknowledgeAlert(alertId: string, managerId: string) {
    return this.prisma.batteryAlert.update({
      where: { id: alertId },
      data: { acknowledgedAt: new Date(), acknowledgedBy: managerId },
    });
  }

  async getEntriesForInventory(inventoryId: string) {
    const entries = await this.prisma.batteryStockEntry.findMany({
      where: { inventoryId },
      include: { alerts: { orderBy: { createdAt: 'desc' } } },
      orderBy: { receivedAt: 'desc' },
    });

    // Attach calculated age fields
    const now = Date.now();
    return entries.map((e) => {
      const refDate = e.manufacturedAt ?? e.receivedAt;
      const daysOnShelf = Math.floor((now - refDate.getTime()) / 86_400_000);
      const shelfPct = Math.round((daysOnShelf / e.shelfLifeDays) * 100);
      return { ...e, daysOnShelf, shelfPct };
    });
  }

  // ── Scheduled scan: runs every day at 06:00 ───────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDegradationScan(): Promise<{ generated: number }> {
    this.logger.log('Running battery shelf-life degradation scan…');

    const entries = await this.prisma.batteryStockEntry.findMany({
      include: { inventory: { select: { sku: true } } },
    });

    let generated = 0;

    for (const entry of entries) {
      const refDate = entry.manufacturedAt ?? entry.receivedAt;
      const daysOnShelf = Math.floor((Date.now() - refDate.getTime()) / 86_400_000);
      const alertThresholdDays = Math.floor((entry.shelfLifeDays * entry.alertFractionPct) / 100);

      const existingAlertTypes = await this.prisma.batteryAlert
        .findMany({ where: { entryId: entry.id, acknowledgedAt: null }, select: { alertType: true } })
        .then((rows) => rows.map((r) => r.alertType));

      // CRITICAL_AGE: > 18 months (540 days)
      if (daysOnShelf > 540 && !existingAlertTypes.includes('CRITICAL_AGE')) {
        await this.prisma.batteryAlert.create({
          data: {
            entryId:    entry.id,
            alertType:  'CRITICAL_AGE',
            daysOnShelf,
            message:    `Battery batch ${entry.batchNumber ?? entry.id} (SKU: ${entry.inventory.sku}) has been on the shelf for ${daysOnShelf} days — exceeds 18-month critical age. Discount or return to supplier.`,
          },
        });
        generated++;
        continue;
      }

      // SHELF_LIMIT_EXCEEDED: 100 %
      if (daysOnShelf >= entry.shelfLifeDays && !existingAlertTypes.includes('SHELF_LIMIT_EXCEEDED')) {
        await this.prisma.batteryAlert.create({
          data: {
            entryId:    entry.id,
            alertType:  'SHELF_LIMIT_EXCEEDED',
            daysOnShelf,
            message:    `Battery batch for SKU ${entry.inventory.sku} has exceeded its ${entry.shelfLifeDays}-day shelf life (${daysOnShelf} days). Do not sell as new.`,
          },
        });
        generated++;
        continue;
      }

      // APPROACHING_SHELF_LIMIT: configurable fraction
      if (daysOnShelf >= alertThresholdDays && !existingAlertTypes.includes('APPROACHING_SHELF_LIMIT')) {
        await this.prisma.batteryAlert.create({
          data: {
            entryId:    entry.id,
            alertType:  'APPROACHING_SHELF_LIMIT',
            daysOnShelf,
            message:    `Battery batch for SKU ${entry.inventory.sku} is at ${entry.alertFractionPct}% of its shelf life (${daysOnShelf}/${entry.shelfLifeDays} days). Prioritise selling this batch.`,
          },
        });
        generated++;
      }
    }

    this.logger.log(`Battery scan complete — ${generated} new alert(s) generated.`);
    return { generated };
  }
}
