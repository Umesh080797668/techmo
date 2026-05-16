import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async getRulesForProduct(productId: string) {
    const now = new Date();
    return this.prisma.pricingRule.findMany({
      where: {
        productId,
        isActive: true,
        OR: [
          { startsAt: null },
          { startsAt: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { endsAt: null },
              { endsAt: { gte: now } },
            ],
          },
        ],
      },
    });
  }

  async calculatePrice(productId: string, qty: number, cartItems?: string[]) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) return null;

    const rules = await this.getRulesForProduct(productId);
    let finalPrice = Number(product.sellingPrice);
    const appliedRules: any[] = [];

    for (const rule of rules) {
      let applicable = false;

      if (rule.ruleType === 'BULK' && rule.minQty && qty >= rule.minQty) applicable = true;
      if (rule.ruleType === 'DISCOUNT_PERCENT') applicable = true;
      if (rule.ruleType === 'DISCOUNT_AMOUNT') applicable = true;
      if (rule.ruleType === 'TIME_BASED') applicable = true;
      if (rule.ruleType === 'COMBO_DISCOUNT' && cartItems?.length) {
        const comboRules = rule.comboRules as any[];
        applicable = comboRules?.every((r: any) => cartItems.includes(r.productId)) ?? false;
      }

      if (applicable) {
        if (rule.discountPct) finalPrice -= finalPrice * (Number(rule.discountPct) / 100);
        if (rule.discountAmt) finalPrice -= Number(rule.discountAmt);
        appliedRules.push({ name: rule.name, ruleType: rule.ruleType, requiresManagerPin: rule.requiresManagerPin });
      }
    }

    return {
      originalPrice: Number(product.sellingPrice),
      finalPrice: Math.max(0, finalPrice),
      appliedRules,
    };
  }

  async createRule(dto: any) {
    return this.prisma.pricingRule.create({ data: dto });
  }

  async findAll() {
    // Return ALL rules (active + inactive) with product name for the admin UI
    return this.prisma.pricingRule.findMany({
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRule(id: string, dto: any) {
    return this.prisma.pricingRule.update({ where: { id }, data: dto });
  }

  async deleteRule(id: string) {
    return this.prisma.pricingRule.delete({ where: { id } });
  }

  async deactivate(id: string) {
    return this.prisma.pricingRule.update({ where: { id }, data: { isActive: false } });
  }

  async validatePin(pin: string): Promise<{ valid: boolean }> {
    const correctPin = await this.getManagerPin();
    return { valid: pin === correctPin };
  }

  async getManagerPin(): Promise<string> {
    try {
      const setting = await this.prisma.appSetting.findUnique({ where: { key: 'manager_pin' } });
      return setting?.value ?? process.env.MANAGER_PIN ?? '0000';
    } catch {
      return process.env.MANAGER_PIN ?? '0000';
    }
  }

  async setManagerPin(newPin: string): Promise<void> {
    await this.prisma.appSetting.upsert({
      where:  { key: 'manager_pin' },
      update: { value: newPin },
      create: { key: 'manager_pin', value: newPin },
    });
  }
}
