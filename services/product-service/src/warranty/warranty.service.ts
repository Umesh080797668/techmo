import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WarrantyService {
  constructor(private readonly prisma: PrismaService) {}

  async checkEligibility(imei: string) {
    const record = await this.prisma.imeiRecord.findUnique({
      where: { imei },
      include: {
        product: true,
        warrantyRecords: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!record) return { eligible: false, reason: 'IMEI not found in system' };
    if (record.status !== 'SOLD') return { eligible: false, reason: 'Item not sold', status: record.status };
    if (!record.soldAt) return { eligible: false, reason: 'No sale date recorded' };

    const warrantyMonths = record.product.warrantyMonths;
    const expiryDate = new Date(record.soldAt);
    expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths);

    if (new Date() > expiryDate) {
      return { eligible: false, reason: 'Warranty expired', expiredAt: expiryDate };
    }

    const activeClaims = record.warrantyRecords.filter(w => w.status === 'PENDING' || w.status === 'APPROVED');
    if (activeClaims.length > 0) {
      return { eligible: false, reason: 'Active warranty claim exists', claim: activeClaims[0] };
    }

    return {
      eligible: true,
      product: record.product,
      imei: record.imei,
      soldAt: record.soldAt,
      warrantyExpiresAt: expiryDate,
      previousClaims: record.warrantyRecords.length,
    };
  }

  async claim(dto: { imei: string; issue: string; claimType?: string; claimedById: string }) {
    const eligibility = await this.checkEligibility(dto.imei);
    if (!eligibility.eligible) throw new BadRequestException(eligibility.reason);

    const record = await this.prisma.imeiRecord.findUnique({ where: { imei: dto.imei } });
    return this.prisma.warrantyClaim.create({
      data: {
        imeiRecordId: record!.id,
        claimedById: dto.claimedById,
        issue: dto.issue,
        claimType: dto.claimType ?? 'WARRANTY_REPAIR',
        status: 'PENDING',
      },
    });
  }

  async resolve(id: string, dto: { status: string; resolution?: string; rejectedReason?: string }) {
    return this.prisma.warrantyClaim.update({
      where: { id },
      data: dto as any,
    });
  }

  async findAll() {
    return this.prisma.warrantyClaim.findMany({
      include: { imeiRecord: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findClaimById(id: string) {
    const claim = await this.prisma.warrantyClaim.findUnique({
      where: { id },
      include: { imeiRecord: { include: { product: true } } },
    });
    if (!claim) throw new NotFoundException(`Warranty claim ${id} not found`);
    return claim;
  }

  /** Returns IMEI records whose warranty expires within the next `daysAhead` days. */
  async getExpiringSoon(daysAhead = 7) {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    const records = await this.prisma.imeiRecord.findMany({
      where: { status: 'SOLD', soldAt: { not: null } },
      include: {
        product: { select: { name: true, warrantyMonths: true } },
        warrantyRecords: { where: { status: { in: ['PENDING', 'APPROVED'] } } },
      },
    });

    return records
      .map((r) => {
        const months = r.product?.warrantyMonths ?? 0;
        if (months === 0 || !r.soldAt) return null;
        const expiry = new Date(r.soldAt);
        expiry.setMonth(expiry.getMonth() + months);
        if (expiry <= now || expiry > cutoff) return null;
        if (r.warrantyRecords.length > 0) return null; // already has active claim
        return {
          imei: r.imei,
          serialNumber: r.serialNumber,
          deviceName: r.product?.name ?? 'Unknown Device',
          warrantyExpiry: expiry.toISOString().split('T')[0],
          daysRemaining: Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000),
        };
      })
      .filter(Boolean);
  }
}
