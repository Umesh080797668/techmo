import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerDto, UpdateCustomerDto, EarnPointsDto, RedeemPointsDto, ManualAdjustDto,
} from './dto/customer.dto';
import * as bcrypt from 'bcryptjs';

const PREMIUM_THRESHOLD = 5000; // points to become PREMIUM
const POINT_REDEMPTION_VALUE = 1; // 1 point = 1 LKR

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new BadRequestException(`Phone ${dto.phone} already registered`);

    const { password, ...rest } = dto;
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

    return this.prisma.customer.create({
      data: {
        ...rest,
        tier: 'NORMAL',
        loyaltyPoints: 0,
        ...(passwordHash ? { passwordHash, mustChangePassword: true } : {}),
      },
    });
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName:  { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where, skip, take: limit, orderBy: { firstName: 'asc' },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        loyaltyTransactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
    return c;
  }

  async findByPhone(phone: string) {
    const c = await this.prisma.customer.findUnique({ where: { phone } });
    if (!c) throw new NotFoundException(`Customer with phone ${phone} not found`);
    return c;
  }

  async getMe(customerId: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        tier: true, loyaltyPoints: true, address: true, nic: true,
        isActive: true, createdAt: true,
      },
    });
    if (!c) throw new NotFoundException('Customer not found');
    return {
      ...c,
      name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
      tier: (c.tier === 'PREMIUM' ? 'PREMIUM' : 'STANDARD') as 'STANDARD' | 'PREMIUM',
    };
  }

  async getLoyaltySummary(customerId: string) {
    const customer = await this.ensureExists(customerId);
    const recent = await this.prisma.loyaltyTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return {
      totalPoints: customer.loyaltyPoints,
      tier: (customer.tier === 'PREMIUM' ? 'PREMIUM' : 'STANDARD') as 'STANDARD' | 'PREMIUM',
      recentTransactions: recent,
    };
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.ensureExists(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async earnPoints(dto: EarnPointsDto) {
    const customer = await this.ensureExists(dto.customerId);
    const newTotal = customer.loyaltyPoints + dto.points;
    const newTier = newTotal >= PREMIUM_THRESHOLD && customer.tier === 'NORMAL'
      ? 'PREMIUM' : customer.tier;

    const [updated] = await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: dto.customerId },
        data: { loyaltyPoints: { increment: dto.points }, tier: newTier as any },
      }),
      this.prisma.loyaltyTransaction.create({
        data: {
          customerId: dto.customerId,
          type: dto.type as any,
          points: dto.points,
          reference: dto.reference,
          balanceAfter: newTotal,
        },
      }),
    ]);

    if (newTier === 'PREMIUM' && customer.tier === 'NORMAL') {
      this.logger.log(`Customer ${dto.customerId} upgraded to PREMIUM tier!`);
    }

    return updated;
  }

  async redeemPoints(dto: RedeemPointsDto) {
    const customer = await this.ensureExists(dto.customerId);
    if (customer.loyaltyPoints < dto.points) {
      throw new BadRequestException(
        `Insufficient points: ${customer.loyaltyPoints} available, ${dto.points} requested`,
      );
    }

    const newTotal = customer.loyaltyPoints - dto.points;
    const discountValue = dto.points * POINT_REDEMPTION_VALUE;

    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: dto.customerId },
        data: { loyaltyPoints: { decrement: dto.points } },
      }),
      this.prisma.loyaltyTransaction.create({
        data: {
          customerId: dto.customerId,
          type: 'REDEMPTION',
          points: -dto.points,
          reference: dto.reference,
          balanceAfter: newTotal,
        },
      }),
    ]);

    return { pointsRedeemed: dto.points, discountValueLKR: discountValue, newBalance: newTotal };
  }

  async manualAdjust(dto: ManualAdjustDto, adjustedBy: string) {
    const customer = await this.ensureExists(dto.customerId);
    const newTotal = customer.loyaltyPoints + dto.points;
    if (newTotal < 0) {
      throw new BadRequestException('Adjustment would make points negative');
    }

    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: dto.customerId },
        data: { loyaltyPoints: { increment: dto.points } },
      }),
      this.prisma.loyaltyTransaction.create({
        data: {
          customerId: dto.customerId,
          type: 'MANUAL_ADJUSTMENT',
          points: dto.points,
          reference: `MANUAL-${adjustedBy}`,
          balanceAfter: newTotal,
        },
      }),
    ]);

    return { newBalance: newTotal };
  }

  async getTransactionHistory(customerId: string, page = 1, limit = 30) {
    await this.ensureExists(customerId);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.loyaltyTransaction.findMany({
        where: { customerId },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.loyaltyTransaction.count({ where: { customerId } }),
    ]);
    return { data, total, page, limit };
  }

  private async ensureExists(id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
    return c;
  }
}
