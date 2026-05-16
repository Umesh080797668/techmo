import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByInventory(inventoryId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { inventoryId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.count({ where: { inventoryId } }),
    ]);
    return { data, total, page, limit };
  }

  async findByReference(reference: string) {
    return this.prisma.stockMovement.findMany({
      where: { reference },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(page = 1, limit = 50, movementType?: string) {
    const skip = (page - 1) * limit;
    const where = movementType ? { movementType: movementType as any } : {};
    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { inventory: { select: { sku: true, productId: true } } },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
