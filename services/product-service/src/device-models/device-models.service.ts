import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeviceModelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: { brand: string; model: string; variant?: string; releaseYear?: number }) {
    return this.prisma.deviceModel.create({ data: dto });
  }

  async findAll(search?: string) {
    return this.prisma.deviceModel.findMany({
      where: search
        ? {
            OR: [
              { brand: { contains: search, mode: 'insensitive' } },
              { model: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: [{ brand: 'asc' }, { model: 'asc' }],
    });
  }

  async findOne(id: string) {
    const dm = await this.prisma.deviceModel.findUnique({
      where: { id },
      include: { compatibilities: { include: { product: true } } },
    });
    if (!dm) throw new NotFoundException(`Device model ${id} not found`);
    return dm;
  }

  async update(id: string, dto: any) {
    return this.prisma.deviceModel.update({ where: { id }, data: dto });
  }
}
