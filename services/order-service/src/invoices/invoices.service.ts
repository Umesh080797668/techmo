import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: { order: { include: { items: true } } },
    });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    return inv;
  }

  async findByOrder(orderId: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { orderId },
      include: { order: { include: { items: true } } },
    });
    if (!inv) throw new NotFoundException(`No invoice for order ${orderId}`);
    return inv;
  }
}
