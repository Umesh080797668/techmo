import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import {
  CreateInventoryDto,
  UpdateInventoryDto,
  AdjustStockDto,
  ReserveStockDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private readonly workerUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.workerUrl = config.get<string>('WORKER_SERVICE_URL', 'http://worker-service:8000');
  }

  async create(dto: CreateInventoryDto) {
    return this.prisma.inventory.create({
      data: {
        productId: dto.productId,
        sku: dto.sku,
        quantity: dto.quantity,
        lowStockQty: dto.lowStockQty ?? 5,
        location: dto.location,
      },
    });
  }

  async findAll(page = 1, limit = 20, lowStockOnly = false, search?: string) {
    const skip = (page - 1) * limit;

    // Low-stock path (raw SQL)
    if (lowStockOnly) {
      const items = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM inventory
        WHERE quantity <= "lowStockQty"
        ORDER BY quantity ASC
        LIMIT ${limit} OFFSET ${skip}
      `;
      const total = await this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count FROM inventory WHERE quantity <= "lowStockQty"
      `;
      return { data: items, total: Number(total[0].count), page, limit };
    }

    const where = search
      ? {
          OR: [
            { sku: { contains: search, mode: 'insensitive' as const } },
            { productId: { contains: search, mode: 'insensitive' as const } },
            { location: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.inventory.findMany({ where, skip, take: limit, orderBy: { sku: 'asc' } }),
      this.prisma.inventory.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findBySku(sku: string) {
    const item = await this.prisma.inventory.findUnique({ where: { sku } });
    if (!item) throw new NotFoundException(`SKU ${sku} not found`);
    return item;
  }

  /** Offline stocktake bulk-sync — compare counted qty vs server qty and return variance. */
  async bulkSyncStocktake(body: {
    sessionId: string;
    scans: Array<{
      localId: number;
      sku: string;
      countedQty: number;
      binLocation?: string;
      notes?: string;
      scannedAt: string;
    }>;
  }) {
    const results = await Promise.all(
      body.scans.map(async (scan) => {
        try {
          const inv = await this.prisma.inventory.findUnique({ where: { sku: scan.sku } });
          if (!inv) {
            return { localId: scan.localId, sku: scan.sku, serverQty: null, variance: null, status: 'not_found' };
          }
          const serverQty = inv.quantity;
          const variance = scan.countedQty - serverQty;
          return {
            localId: scan.localId,
            sku: scan.sku,
            serverQty,
            variance,
            status: variance === 0 ? 'synced' : 'conflict',
          };
        } catch {
          return { localId: scan.localId, sku: scan.sku, serverQty: null, variance: null, status: 'error' };
        }
      }),
    );
    return { sessionId: body.sessionId, results };
  }

  async findByProductId(productId: string) {
    return this.prisma.inventory.findMany({ where: { productId } });
  }

  async findById(id: string) {
    const item = await this.prisma.inventory.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Inventory record ${id} not found`);
    return item;
  }

  async update(id: string, dto: UpdateInventoryDto) {
    await this.ensureExists(id);
    return this.prisma.inventory.update({ where: { id }, data: dto });
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    const inv = await this.ensureExists(id);
    const newQty = inv.quantity + dto.quantityDelta;
    if (newQty < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.inventory.update({
        where: { id },
        data: { quantity: newQty },
      }),
      this.prisma.stockMovement.create({
        data: {
          inventoryId: id,
          movementType: dto.movementType as any,
          quantity: Math.abs(dto.quantityDelta),
          reason: dto.reason,
          reference: dto.reference,
          performedBy: dto.performedBy,
        },
      }),
    ]);

    // Check low stock after adjustment
    if (updated.quantity <= updated.lowStockQty) {
      this.triggerLowStockAlert(updated).catch((e) =>
        this.logger.warn(`Low-stock alert failed: ${e.message}`),
      );
    }

    return updated;
  }

  async reserveStock(id: string, dto: ReserveStockDto) {
    const inv = await this.ensureExists(id);
    const available = inv.quantity - inv.reserved;
    if (available < dto.quantity) {
      throw new BadRequestException(
        `Only ${available} units available (${inv.quantity} stock - ${inv.reserved} reserved)`,
      );
    }

    return this.prisma.$transaction([
      this.prisma.inventory.update({
        where: { id },
        data: { reserved: { increment: dto.quantity } },
      }),
      this.prisma.stockMovement.create({
        data: {
          inventoryId: id,
          movementType: 'SALE_OUT',
          quantity: dto.quantity,
          reason: 'Stock reserved for order',
          reference: dto.reference,
          performedBy: dto.performedBy,
        },
      }),
    ]);
  }

  async deductReserved(id: string, quantity: number, reference: string, performedBy: string) {
    const inv = await this.ensureExists(id);
    if (inv.reserved < quantity) {
      throw new BadRequestException('Reserved quantity mismatch');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.inventory.update({
        where: { id },
        data: {
          quantity: { decrement: quantity },
          reserved: { decrement: quantity },
        },
      }),
      this.prisma.stockMovement.create({
        data: {
          inventoryId: id,
          movementType: 'SALE_OUT',
          quantity,
          reason: 'Stock deducted on order completion',
          reference,
          performedBy,
        },
      }),
    ]);

    if (updated.quantity <= updated.lowStockQty) {
      this.triggerLowStockAlert(updated).catch((e) =>
        this.logger.warn(`Low-stock alert failed: ${e.message}`),
      );
    }

    return updated;
  }

  async releaseReserved(id: string, quantity: number, reference: string, performedBy: string) {
    await this.ensureExists(id);
    return this.prisma.inventory.update({
      where: { id },
      data: { reserved: { decrement: quantity } },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async dailyLowStockScan() {
    this.logger.log('Running daily low-stock scan...');
    const lowItems = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM inventory WHERE quantity <= "lowStockQty"
    `;
    for (const item of lowItems) {
      await this.triggerLowStockAlert(item).catch((e) =>
        this.logger.warn(`Alert failed for ${item.sku}: ${e.message}`),
      );
    }
    this.logger.log(`Low-stock scan complete. ${lowItems.length} items alerted.`);
  }

  private async triggerLowStockAlert(item: any) {
    await axios.post(`${this.workerUrl}/api/email/low-stock`, {
      sku: item.sku,
      productId: item.productId,
      currentQty: item.quantity,
      threshold: item.lowStockQty,
      location: item.location,
    });
  }

  private async ensureExists(id: string) {
    const item = await this.prisma.inventory.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Inventory item ${id} not found`);
    return item;
  }
}
