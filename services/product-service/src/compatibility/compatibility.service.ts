import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompatibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async add(dto: { productId: string; deviceModelId: string; notes?: string }) {
    try {
      return await this.prisma.partCompatibility.create({
        data: dto,
        include: { product: true, deviceModel: true },
      });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Compatibility mapping already exists');
      throw e;
    }
  }

  async getByProduct(productId: string) {
    return this.prisma.partCompatibility.findMany({
      where: { productId },
      include: { deviceModel: true },
    });
  }

  async getByDevice(deviceModelId: string) {
    return this.prisma.partCompatibility.findMany({
      where: { deviceModelId },
      include: { product: { include: { category: true } } },
    });
  }

  async check(productId: string, deviceModelId: string) {
    const record = await this.prisma.partCompatibility.findUnique({
      where: { productId_deviceModelId: { productId, deviceModelId } },
      include: { deviceModel: true, product: true },
    });
    return { compatible: !!record, record };
  }

  async remove(id: string) {
    return this.prisma.partCompatibility.delete({ where: { id } });
  }
}
