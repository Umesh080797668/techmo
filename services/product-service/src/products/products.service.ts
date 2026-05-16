import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto as any, include: { category: true } });
  }

  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    categoryId?: string;
    productType?: string;
  }) {
    const { page, limit, search, categoryId, productType } = params;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (productType) where.productType = productType;

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where, skip, take: limit,
        include: { category: true, variants: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: true,
        compatibilities: { include: { deviceModel: true } },
        pricingRules: { where: { isActive: true } },
      },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async findBySku(sku: string) {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: { category: true, variants: true, compatibilities: { include: { deviceModel: true } } },
    });
    if (!product) throw new NotFoundException(`Product with SKU ${sku} not found`);
    return product;
  }

  async findByBarcode(barcode: string) {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: { category: true, variants: true, compatibilities: { include: { deviceModel: true } } },
    });
    if (!product) throw new NotFoundException(`Product with barcode ${barcode} not found`);
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto as any });
  }

  async deactivate(id: string) {
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  async softDelete(id: string) {
    return this.deactivate(id);
  }
}
