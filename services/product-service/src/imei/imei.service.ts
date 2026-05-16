import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ImeiService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { status?: string; productId?: string; search?: string; page?: string | number; limit?: string | number }) {
    const { status, productId, search, page = 1, limit = 50 } = query;
    const where: any = {};
    if (status) where.status = status;
    if (productId) where.productId = productId;
    if (search) {
      where.OR = [
        { imei:         { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { product: { sku:  { contains: search, mode: 'insensitive' } } },
      ];
    }
    const records = await this.prisma.imeiRecord.findMany({
      where,
      include: { product: { select: { id: true, name: true, sku: true, warrantyMonths: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });
    return records.map((r) => ({ ...r, warrantyStatus: this._warrantyStatus(r) }));
  }

  private _warrantyStatus(record: { status: string; soldAt: Date | null; product?: { warrantyMonths: number } | null }): string | null {
    if (record.status !== 'SOLD' || !record.soldAt) return null;
    const months = record.product?.warrantyMonths ?? 0;
    if (months === 0) return 'NO_WARRANTY';
    const expiry = new Date(record.soldAt);
    expiry.setMonth(expiry.getMonth() + months);
    return new Date() <= expiry ? 'VALID' : 'EXPIRED';
  }

  async register(dto: {
    productId: string;
    imei: string;
    serialNumber?: string;
    color?: string;
    storage?: string;
  }) {
    try {
      return await this.prisma.imeiRecord.create({ data: dto });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('IMEI or serial number already registered');
      throw e;
    }
  }

  async findByImei(imei: string) {
    const record = await this.prisma.imeiRecord.findUnique({
      where: { imei },
      include: { product: true },
    });
    if (!record) throw new NotFoundException(`IMEI ${imei} not found`);
    return { ...record, warrantyStatus: this._warrantyStatus(record) };
  }

  async markSold(imei: string, orderId: string) {
    return this.prisma.imeiRecord.update({
      where: { imei },
      data: { status: 'SOLD', soldAt: new Date(), orderId },
    });
  }

  async getByProduct(productId: string) {
    return this.prisma.imeiRecord.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(imei: string, status: string) {
    return this.prisma.imeiRecord.update({
      where: { imei },
      data: { status: status as any },
    });
  }

  async bulkRegister(dto: {
    productId: string;
    numbers: string[];          // IMEI or serial strings
    mode: 'imei' | 'serial';   // which field to populate
  }) {
    const results: { number: string; status: 'ok' | 'duplicate' | 'error'; error?: string }[] = [];
    for (const num of dto.numbers) {
      const trimmed = num.trim();
      if (!trimmed) continue;
      try {
        const data: any = { productId: dto.productId };
        if (dto.mode === 'imei') {
          data.imei = trimmed;
        } else {
          // serial-only: use the serial as the imei field (unique identifier) + serialNumber
          data.imei = trimmed;
          data.serialNumber = trimmed;
        }
        await this.prisma.imeiRecord.create({ data });
        results.push({ number: trimmed, status: 'ok' });
      } catch (e: any) {
        if (e.code === 'P2002') {
          results.push({ number: trimmed, status: 'duplicate' });
        } else {
          results.push({ number: trimmed, status: 'error', error: e.message });
        }
      }
    }
    const registered = results.filter(r => r.status === 'ok').length;
    const duplicates = results.filter(r => r.status === 'duplicate').length;
    const errors = results.filter(r => r.status === 'error').length;
    return { registered, duplicates, errors, results };
  }
}
