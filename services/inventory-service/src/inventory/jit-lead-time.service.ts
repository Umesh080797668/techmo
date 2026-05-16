import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface SupplierLeadTime {
  supplierId: string;
  supplierName: string;
  avgLeadTimeDays: number;
  medianLeadTimeDays: number;
  p90LeadTimeDays: number;
  orderCount: number;
  isRunningLate: boolean;
  /** Rolling 30-day avg compared to historical avg */
  trendDays: number;
  /** Human-readable flag */
  warning?: string;
}

export interface PosLeadTimeWarning {
  supplierId: string;
  supplierName: string;
  issuedAt: string;
  estimatedDelay: string;
  likelyArrivalDate: string;
}

@Injectable()
export class JitLeadTimeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate actual lead time per supplier using a SQL window function
   * over the immutable_movement_history (order → receive movement pairs).
   *
   * Lead time = days between "purchase_order" movement and next
   * "stock_in" movement for the same product+supplier.
   */
  async getSupplierLeadTimes(): Promise<SupplierLeadTime[]> {
    const rows: Array<{
      supplier_id: string;
      supplier_name: string;
      avg_days: number;
      median_days: number;
      p90_days: number;
      order_count: number;
      recent_avg_days: number;
    }> = await this.prisma.$queryRaw(Prisma.sql`
      WITH order_pairs AS (
        SELECT
          po.supplier_id,
          s.name                                     AS supplier_name,
          po.product_id,
          po.created_at                              AS ordered_at,
          LEAD(sm.created_at) OVER (
            PARTITION BY po.supplier_id, po.product_id
            ORDER BY po.created_at
          )                                          AS received_at
        FROM inventory_movements po
        JOIN inventory_movements sm
          ON sm.product_id   = po.product_id
         AND sm.movement_type = 'stock_in'
         AND sm.created_at   > po.created_at
         AND sm.created_at   < po.created_at + INTERVAL '90 days'
        JOIN suppliers s ON s.id = po.supplier_id
        WHERE po.movement_type = 'purchase_order'
          AND po.supplier_id IS NOT NULL
      ),
      lead_times AS (
        SELECT
          supplier_id,
          supplier_name,
          EXTRACT(DAY FROM (received_at - ordered_at))::int AS lead_days,
          ordered_at
        FROM order_pairs
        WHERE received_at IS NOT NULL
      )
      SELECT
        supplier_id,
        supplier_name,
        ROUND(AVG(lead_days), 1)                                   AS avg_days,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lead_days)     AS median_days,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY lead_days)     AS p90_days,
        COUNT(*)                                                   AS order_count,
        ROUND(AVG(lead_days) FILTER (
          WHERE ordered_at > NOW() - INTERVAL '30 days'), 1)       AS recent_avg_days
      FROM lead_times
      GROUP BY supplier_id, supplier_name
      ORDER BY avg_days DESC
    `);

    return rows.map(r => {
      const trendDays = (r.recent_avg_days ?? r.avg_days) - r.avg_days;
      const isRunningLate = trendDays > 2; // 2-day threshold
      return {
        supplierId:        r.supplier_id,
        supplierName:      r.supplier_name,
        avgLeadTimeDays:   Math.round(r.avg_days),
        medianLeadTimeDays: Math.round(r.median_days),
        p90LeadTimeDays:   Math.round(r.p90_days),
        orderCount:        Number(r.order_count),
        isRunningLate,
        trendDays:         Math.round(trendDays * 10) / 10,
        warning: isRunningLate
          ? `Running ~${Math.round(trendDays)} days slower than historical average`
          : undefined,
      };
    });
  }

  /**
   * For the POS: check if a pending order relies on a supplier that is currently
   * running late and return a human-readable warning.
   */
  async getPosWarningForSupplier(supplierId: string): Promise<PosLeadTimeWarning | null> {
    const all = await this.getSupplierLeadTimes();
    const supplier = all.find(s => s.supplierId === supplierId);
    if (!supplier || !supplier.isRunningLate) return null;

    const estimatedDelayDays = Math.round(supplier.trendDays);
    const likelyArrival = new Date();
    likelyArrival.setDate(likelyArrival.getDate() + supplier.avgLeadTimeDays + estimatedDelayDays);

    return {
      supplierId:         supplier.supplierId,
      supplierName:       supplier.supplierName,
      issuedAt:           new Date().toISOString(),
      estimatedDelay:     `~${estimatedDelayDays} extra day${estimatedDelayDays !== 1 ? 's' : ''}`,
      likelyArrivalDate:  likelyArrival.toLocaleDateString('en-LK'),
    };
  }

  /**
   * Returns the single slowest supplier for dashboard quick badge.
   */
  async getSlowestSupplier(): Promise<SupplierLeadTime | null> {
    const all = await this.getSupplierLeadTimes();
    const late = all.filter(s => s.isRunningLate);
    return late.length > 0 ? late[0] : null;
  }
}
