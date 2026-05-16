import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CreateOrderDto, VoidOrderDto } from './dto/order.dto';

const TAX_RATE = 0.05; // 5% VAT
const LOYALTY_POINTS_PER_LKR = 0.01; // 1 pt per 100 LKR
const LOYALTY_POINT_VALUE = 1; // 1 pt = 1 LKR discount

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private inventoryUrl: string;
  private productUrl: string;
  private loyaltyUrl: string;
  private workerUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.inventoryUrl = config.get('INVENTORY_SERVICE_URL', 'http://inventory-service:3002');
    this.productUrl = config.get('PRODUCT_SERVICE_URL', 'http://product-service:3001');
    this.loyaltyUrl = config.get('LOYALTY_SERVICE_URL', 'http://loyalty-service:3005');
    this.workerUrl = config.get('WORKER_SERVICE_URL', 'http://worker-service:8000');
  }

  async createOrder(dto: CreateOrderDto) {
    // 1. Calculate totals
    const subtotal = dto.items.reduce(
      (sum, i) => sum + (i.unitPrice - i.discountAmount) * i.quantity, 0,
    );
    const loyaltyDiscount = (dto.loyaltyPointsToRedeem ?? 0) * LOYALTY_POINT_VALUE;
    const discount = (dto.discountAmount ?? 0) + loyaltyDiscount;
    const taxable = Math.max(subtotal - discount, 0);
    const tax = parseFloat((taxable * TAX_RATE).toFixed(2));
    const total = parseFloat((taxable + tax).toFixed(2));
    const loyaltyEarned = Math.floor(total * LOYALTY_POINTS_PER_LKR);

    // 2. Reserve stock for all items
    for (const item of dto.items) {
      await axios.post(
        `${this.inventoryUrl}/api/v1/inventory/${item.inventoryId}/reserve`,
        { quantity: item.quantity, reference: 'ORDER_PENDING', performedBy: dto.cashierId },
      );
    }

    // 3. Create order in DB
    const orderNumber = await this.generateOrderNumber();
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        customerId: dto.customerId,
        walkInName: dto.walkInName,
        cashierId: dto.cashierId,
        subtotal,
        discountAmt: discount,
        taxAmt: tax,
        totalAmt: total,
        loyaltyPtsEarned: loyaltyEarned,
        loyaltyPtsRedeemed: dto.loyaltyPointsToRedeem ?? 0,
        paymentMethod: dto.paymentMethod ?? 'CASH',
        notes: dto.notes,
        status: 'PENDING',
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            sku: i.sku,
            imei: i.imei,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discountAmt: i.discountAmount,
            lineTotal: (i.unitPrice - i.discountAmount) * i.quantity,
          })),
        },
      },
      include: { items: true },
    });

    return order;
  }

  async completeOrder(id: string) {
    const order = await this.findOne(id);
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING orders can be completed');
    }

    // 1. Deduct reserved stock & mark IMEI sold
    for (const item of order.items) {
      await axios.post(
        `${this.inventoryUrl}/api/v1/inventory/${item['inventoryId']}/deduct`,
        { quantity: item.quantity, reference: order.orderNumber },
      ).catch((e) => this.logger.warn(`Inventory deduct failed: ${e.message}`));

      if (item.imei) {
        await axios.patch(
          `${this.productUrl}/api/v1/products/imei/${item.imei}/sell`,
          { orderId: id },
        ).catch((e) => this.logger.warn(`IMEI mark-sold failed: ${e.message}`));
      }
    }

    // 2. Award loyalty points
    if (order.customerId && order.loyaltyPtsEarned > 0) {
      await axios.post(
        `${this.loyaltyUrl}/api/v1/customers/loyalty/earn`,
        {
          customerId: order.customerId,
          points:     order.loyaltyPtsEarned,
          reference:  order.orderNumber,
          type:       'PURCHASE_EARN',
        },
        {
          headers: {
            // Shared internal service secret — must match INTERNAL_SERVICE_KEY in loyalty-service
            'x-internal-key': process.env.INTERNAL_SERVICE_KEY ?? 'techmo-internal-svc-2026',
          },
        },
      ).catch((e) => this.logger.warn(`Loyalty earn failed: ${e.message}`));
    }

    // 3. Complete the order
    const completed = await this.prisma.order.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: { items: true },
    });

    // 4. Create invoice record
    const invoiceNo = await this.generateInvoiceNumber();
    const invoice = await this.prisma.invoice.create({
      data: { invoiceNo, orderId: id },
    });

    // 5. Trigger PDF generation (async)
    this.generateInvoicePdf(invoice.id, order, invoiceNo).catch((e) =>
      this.logger.warn(`Invoice PDF generation failed: ${e.message}`),
    );

    return { order: completed, invoice };
  }

  async voidOrder(id: string, dto: VoidOrderDto) {
    const order = await this.findOne(id);
    if (order.status === 'VOIDED') throw new BadRequestException('Order already voided');
    if (order.status === 'REFUNDED') throw new BadRequestException('Order already refunded');

    // Release reserved/deducted stock
    for (const item of order.items) {
      if (order.status === 'PENDING') {
        await axios.post(
          `${this.inventoryUrl}/api/v1/inventory/${item['inventoryId']}/release`,
          { quantity: item.quantity, reference: order.orderNumber },
        ).catch((e) => this.logger.warn(`Inventory release failed: ${e.message}`));
      }
    }

    const voided = await this.prisma.order.update({
      where: { id },
      data: { status: 'VOIDED' },
      include: { items: true },
    });

    // Mark invoice as void
    await this.prisma.invoice.updateMany({
      where: { orderId: id },
      data: {
        isVoided: true,
        voidedBy: dto.voidedBy,
        voidReason: dto.reason,
        voidedAt: new Date(),
      },
    });

    return voided;
  }

  async findAll(page = 1, limit = 20, status?: string, cashierId?: string, from?: string, to?: string, customerId?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (cashierId) where.cashierId = cashierId;
    if (customerId) where.customerId = customerId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from + (from.length === 10 ? 'T00:00:00' : ''));
      if (to)   where.createdAt.lte = new Date(to   + (to.length   === 10 ? 'T23:59:59' : ''));
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, invoice: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async findByOrderNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, invoice: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderNumber} not found`);
    return order;
  }

  async getSalesSummary(from: Date, to: Date) {
    const result = await this.prisma.order.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: from, lte: to } },
      _sum: { totalAmt: true, taxAmt: true, discountAmt: true },
      _count: { id: true },
    });
    return {
      totalRevenue: result._sum.totalAmt ?? 0,
      totalTax: result._sum.taxAmt ?? 0,
      totalDiscount: result._sum.discountAmt ?? 0,
      orderCount: result._count.id,
    };
  }

  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const prefix = `ORD-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const count = await this.prisma.order.count({
      where: { orderNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateInvoiceNumber(): Promise<string> {
    const count = await this.prisma.invoice.count();
    return `INV-${String(count + 1).padStart(6, '0')}`;
  }

  private async generateInvoicePdf(invoiceId: string, order: any, invoiceNo: string) {
    const customerName = order.customerId
      ? `Customer #${String(order.customerId).slice(-8).toUpperCase()} (Online)`
      : (order.walkInName ? `${order.walkInName} (Walk-in)` : 'Walk-in Customer');

    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
    const dateStr = `${createdAt.getDate().toString().padStart(2, '0')} ${
      ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][createdAt.getMonth()]
    } ${createdAt.getFullYear()} ${createdAt.getHours().toString().padStart(2, '0')}:${createdAt.getMinutes().toString().padStart(2, '0')}`;

    const resp = await axios.post(`${this.workerUrl}/api/pdf/invoice`, {
      invoice_no: invoiceNo,
      customer_name: customerName,
      cashier_name: order.cashierId ?? 'Staff',
      date: dateStr,
      subtotal: Number(order.subtotal ?? 0),
      discount: Number(order.discountAmt ?? 0),
      total: Number(order.totalAmt ?? 0),
      items: (order.items ?? []).map((item: any) => ({
        product_name: item.productName ?? item.sku ?? '—',
        sku: item.sku ?? '',
        imei: item.imei ?? null,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice ?? 0),
        discount_amt: Number(item.discountAmt ?? 0),
        line_total: Number(item.lineTotal ?? (Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0))),
      })),
    });
    const pdfUrl = resp.data?.url;
    if (pdfUrl) {
      await this.prisma.invoice.update({ where: { id: invoiceId }, data: { pdfUrl } });
    }
  }

  // ─── Smart Defaults (last 30-day purchase patterns per cashier) ──────────────

  async getSmartDefaults(cashierId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    // Most frequent items sold by this cashier in the last 30 days
    const topItems = await this.prisma.$queryRaw<any[]>`
      SELECT
        oi.sku,
        oi."productName",
        oi."unitPrice",
        SUM(oi.quantity)::int AS "totalQty"
      FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      WHERE o."cashierId" = ${cashierId}
        AND o.status = 'COMPLETED'
        AND o."createdAt" >= ${since}
      GROUP BY oi.sku, oi."productName", oi."unitPrice"
      ORDER BY "totalQty" DESC
      LIMIT 8
    `;

    // Most frequent customer phones this cashier has served
    const topCustomers = await this.prisma.$queryRaw<any[]>`
      SELECT
        o."customerId",
        COUNT(*)::int AS "visits"
      FROM orders o
      WHERE o."cashierId" = ${cashierId}
        AND o."customerId" IS NOT NULL
        AND o.status = 'COMPLETED'
        AND o."createdAt" >= ${since}
      GROUP BY o."customerId"
      ORDER BY "visits" DESC
      LIMIT 5
    `;

    return { topItems, topCustomers };
  }

  // ─── POS Mistake Prevention ──────────────────────────────────────────────────

  async validatePosRules(dto: CreateOrderDto): Promise<{ warnings: string[] }> {
    const rules = await this.prisma.posRule.findMany({ where: { isActive: true } });
    const warnings: string[] = [];

    for (const rule of rules) {
      switch (rule.type) {
        case 'MAX_QTY_PER_LINE': {
          const max = parseInt(rule.value, 10);
          for (const item of dto.items) {
            if (item.quantity > max) {
              warnings.push(`⚠ Qty ${item.quantity} for "${item.productName}" exceeds max allowed (${max}).`);
            }
          }
          break;
        }
        case 'MAX_DISCOUNT_PERCENT': {
          const maxPct = parseFloat(rule.value);
          for (const item of dto.items) {
            if (item.unitPrice > 0) {
              const pct = (item.discountAmount / item.unitPrice) * 100;
              if (pct > maxPct) {
                warnings.push(`⚠ Discount ${pct.toFixed(1)}% on "${item.productName}" exceeds max (${maxPct}%).`);
              }
            }
          }
          break;
        }
        case 'DUPLICATE_ITEM_WARN': {
          const skus = dto.items.map(i => i.sku);
          const dupes = skus.filter((s, i) => skus.indexOf(s) !== i);
          if (dupes.length > 0) {
            warnings.push(`⚠ Duplicate SKU(s) in cart: ${[...new Set(dupes)].join(', ')}`);
          }
          break;
        }
        case 'HIGH_VALUE_ORDER_WARN': {
          const threshold = parseFloat(rule.value);
          const total = dto.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          if (total > threshold) {
            warnings.push(`⚠ Order total LKR ${total.toLocaleString()} exceeds high-value threshold (${threshold.toLocaleString()}).`);
          }
          break;
        }
      }
    }

    return { warnings };
  }

  // ─── Abandoned Reservation Tracker ──────────────────────────────────────────

  async createReservation(data: {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    staffId: string;
    productId: string;
    productName: string;
    sku?: string;
    productSku?: string; // accepted as alias for sku
    quantity: number;
    unitPrice: number;
    expiresInHours?: number;
    notes?: string;
  }) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (data.expiresInHours ?? 48));

    // Explicitly pick Prisma fields to avoid spreading unknown keys (e.g. expiresInHours)
    return this.prisma.reservation.create({
      data: {
        customerId: data.customerId ?? undefined,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        staffId: data.staffId,
        productId: data.productId,
        productName: data.productName,
        sku: data.sku ?? data.productSku ?? '',
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        notes: data.notes ?? undefined,
        expiresAt,
      },
    });
  }

  async listReservations(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    else where.status = { in: ['ACTIVE', 'EXPIRED'] };

    // Auto-expire overdue ones
    await this.prisma.reservation.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });

    const [data, total] = await Promise.all([
      this.prisma.reservation.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.reservation.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async cancelReservation(id: string) {
    return this.prisma.reservation.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async convertReservationToOrder(id: string, orderId: string) {
    return this.prisma.reservation.update({
      where: { id },
      data: { status: 'CONVERTED', convertedOrderId: orderId },
    });
  }

  // ─── Customer Consent Logs (PDPA/GDPR) ──────────────────────────────────────

  async recordConsent(customerId: string, type: string, granted: boolean, meta: any) {
    return this.prisma.customerConsent.create({
      data: {
        customerId,
        type: type as any,
        granted,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        recordedBy: meta.recordedBy ?? 'self',
      },
    });
  }

  async getCustomerConsents(customerId: string) {
    const rows = await this.prisma.customerConsent.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    // Return latest consent per type
    const latest: Record<string, any> = {};
    for (const row of rows) {
      if (!latest[row.type]) latest[row.type] = row;
    }
    return Object.values(latest);
  }

  // ─── AI-like Insights ────────────────────────────────────────────────────────

  async getInsights() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [currentRevenue, previousRevenue, topSku, voidRate, avgOrderValue] =
      await Promise.all([
        // Current 30-day revenue
        this.prisma.order.aggregate({
          where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
          _sum: { totalAmt: true },
          _count: { id: true },
        }),
        // Previous 30-day revenue
        this.prisma.order.aggregate({
          where: { status: 'COMPLETED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
          _sum: { totalAmt: true },
          _count: { id: true },
        }),
        // Top SKU this month
        this.prisma.$queryRaw<any[]>`
          SELECT oi.sku, oi."productName", SUM(oi.quantity)::int AS sold
          FROM order_items oi
          JOIN orders o ON o.id = oi."orderId"
          WHERE o.status = 'COMPLETED' AND o."createdAt" >= ${thirtyDaysAgo}
          GROUP BY oi.sku, oi."productName"
          ORDER BY sold DESC
          LIMIT 1
        `,
        // Void rate
        this.prisma.order.groupBy({
          by: ['status'],
          _count: { id: true },
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),
        // Avg order value
        this.prisma.order.aggregate({
          where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
          _avg: { totalAmt: true },
        }),
      ]);

    const total = currentRevenue._count.id || 1;
    const voidCount = voidRate.find(r => r.status === 'VOIDED')?._count?.id ?? 0;
    const currentRev = Number(currentRevenue._sum.totalAmt ?? 0);
    const previousRev = Number(previousRevenue._sum.totalAmt ?? 1);
    const revenueChange = ((currentRev - previousRev) / previousRev) * 100;

    return {
      revenueCurrentMonth: currentRev,
      revenueChangePercent: parseFloat(revenueChange.toFixed(1)),
      orderCountCurrentMonth: currentRevenue._count.id,
      avgOrderValue: parseFloat(Number(avgOrderValue._avg.totalAmt ?? 0).toFixed(2)),
      topSellingProduct: topSku[0] ?? null,
      voidRatePercent: parseFloat(((voidCount / total) * 100).toFixed(1)),
      revenueVsPreviousLabel: revenueChange >= 0 ? `↑${revenueChange.toFixed(1)}% vs last month` : `↓${Math.abs(revenueChange).toFixed(1)}% vs last month`,
    };
  }

  // ─── Customer self-service ────────────────────────────────────────────────

  async findByCustomer(
    customerId: string,
    page = 1,
    limit = 20,
    status?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { customerId };
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOneForCustomer(id: string, customerId: string) {
    const order = await this.findOne(id);
    if (order.customerId !== customerId) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }
}
