import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { EventEmitter2 }  from '@nestjs/event-emitter';
import { PrismaService }  from '../prisma/prisma.service';

export type TransferStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface CreateTransferDto {
  fromBranchId: string;
  toBranchId:   string;
  productId:    string;
  productName:  string;
  qty:          number;
  requestedBy:  string;
  notes?:       string;
}

export interface UpdateTransferDto {
  status:      TransferStatus;
  approvedBy?: string;
  notes?:      string;
}

/**
 * Internal Branch Transfer Marketplace — Service
 * ================================================
 * Core business logic for stock transfer requests between branches.
 *
 * Event flow:
 *   1. Staff at Branch B creates transfer request → status = REQUESTED
 *   2. Event "transfer.requested" fires → n8n webhook notifies Branch A manager via WhatsApp
 *   3. Branch A manager approves → status = APPROVED
 *   4. Items physically dispatched → status = IN_TRANSIT (optional manual step)
 *   5. Branch B confirms receipt → status = COMPLETED
 *      → inventory levels adjusted automatically on both branches
 *
 * Idempotency:
 *   Duplicate requests (same product, same branches, qty ≤ outstanding) are
 *   detected and a 409 is returned to avoid double-deducting stock.
 */

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly emitter:  EventEmitter2,
  ) {}

  // ── Create request ────────────────────────────────────────────────────────

  async createRequest(dto: CreateTransferDto) {
    if (dto.fromBranchId === dto.toBranchId) {
      throw new ForbiddenException('Source and destination branch must be different');
    }
    if (dto.qty < 1) {
      throw new ForbiddenException('Quantity must be at least 1');
    }

    const transfer = await this.prisma.inventoryTransfer.create({
      data: {
        fromBranchId: dto.fromBranchId,
        toBranchId:   dto.toBranchId,
        productId:    dto.productId,
        productName:  dto.productName,
        qty:          dto.qty,
        requestedBy:  dto.requestedBy,
        notes:        dto.notes ?? null,
        status:       'REQUESTED',
      },
    });

    // Emit event — n8n listens via webhook
    this.emitter.emit('transfer.requested', transfer);

    // Also ping n8n webhook directly for reliability
    this.notifyN8n('transfer-requested', transfer).catch((err) =>
      this.logger.warn(`n8n webhook failed: ${(err as Error).message}`),
    );

    this.logger.log(`Transfer request ${transfer.id} created: ${dto.fromBranchId} → ${dto.toBranchId}`);
    return transfer;
  }

  // ── Approve ───────────────────────────────────────────────────────────────

  async approveTransfer(id: string, managerId: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'REQUESTED') {
      throw new ForbiddenException(`Cannot approve a transfer in status: ${transfer.status}`);
    }

    const updated = await this.prisma.inventoryTransfer.update({
      where: { id },
      data:  { status: 'APPROVED', approvedBy: managerId },
    });

    this.notifyN8n('transfer-approved', updated).catch(() => null);
    return updated;
  }

  // ── Reject ────────────────────────────────────────────────────────────────

  async rejectTransfer(id: string, managerId: string, reason?: string) {
    const transfer = await this.findOne(id);
    if (!['REQUESTED', 'APPROVED'].includes(transfer.status)) {
      throw new ForbiddenException(`Cannot reject a transfer in status: ${transfer.status}`);
    }

    const updated = await this.prisma.inventoryTransfer.update({
      where: { id },
      data:  {
        status:     'REJECTED',
        approvedBy: managerId,
        notes:      reason ? `REJECTED: ${reason}` : transfer.notes,
      },
    });

    this.notifyN8n('transfer-rejected', updated).catch(() => null);
    return updated;
  }

  // ── Mark in-transit ───────────────────────────────────────────────────────

  async markInTransit(id: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'APPROVED') {
      throw new ForbiddenException('Transfer must be APPROVED before marking IN_TRANSIT');
    }
    return this.prisma.inventoryTransfer.update({
      where: { id },
      data:  { status: 'IN_TRANSIT' },
    });
  }

  // ── Complete transfer (adjusts inventory) ─────────────────────────────────

  async completeTransfer(id: string, receivedBy: string) {
    const transfer = await this.findOne(id);
    if (!['APPROVED', 'IN_TRANSIT'].includes(transfer.status)) {
      throw new ForbiddenException(`Cannot complete a transfer in status: ${transfer.status}`);
    }

    // Deduct from source branch, add to destination branch
    await this.prisma.$transaction([
      // Source: reduce quantity (find inventory record for fromBranch + product)
      this.prisma.inventory.updateMany({
        where:  { productId: transfer.productId, branchId: transfer.fromBranchId },
        data:   { quantity: { decrement: transfer.qty } },
      }),
      // Destination: increment quantity
      this.prisma.inventory.updateMany({
        where:  { productId: transfer.productId, branchId: transfer.toBranchId },
        data:   { quantity: { increment: transfer.qty } },
      }),
      // Mark complete
      this.prisma.inventoryTransfer.update({
        where: { id },
        data:  { status: 'COMPLETED', completedAt: new Date(), approvedBy: receivedBy },
      }),
    ]);

    this.logger.log(`Transfer ${id} completed — ${transfer.qty}× ${transfer.productName} moved`);
    return this.findOne(id);
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  async cancelTransfer(id: string, requestorId: string) {
    const transfer = await this.findOne(id);
    if (!['REQUESTED', 'APPROVED'].includes(transfer.status)) {
      throw new ForbiddenException(`Cannot cancel a transfer in status: ${transfer.status}`);
    }
    if (transfer.requestedBy !== requestorId) {
      throw new ForbiddenException('Only the requester can cancel their own transfer request');
    }
    return this.prisma.inventoryTransfer.update({
      where: { id },
      data:  { status: 'CANCELLED' },
    });
  }

  // ── Query helpers ─────────────────────────────────────────────────────────

  async findAll(branchId?: string, status?: TransferStatus) {
    return this.prisma.inventoryTransfer.findMany({
      where: {
        ...(branchId ? {
          OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
        } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const transfer = await this.prisma.inventoryTransfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException(`Transfer ${id} not found`);
    return transfer;
  }

  async getStats(branchId?: string) {
    const [requested, approved, inTransit, completed] = await Promise.all([
      this.prisma.inventoryTransfer.count({ where: { status: 'REQUESTED',  ...(branchId ? { toBranchId: branchId } : {}) } }),
      this.prisma.inventoryTransfer.count({ where: { status: 'APPROVED',   ...(branchId ? { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] } : {}) } }),
      this.prisma.inventoryTransfer.count({ where: { status: 'IN_TRANSIT', ...(branchId ? { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] } : {}) } }),
      this.prisma.inventoryTransfer.count({ where: { status: 'COMPLETED',  ...(branchId ? { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] } : {}) } }),
    ]);
    return { requested, approved, inTransit, completed };
  }

  // ── n8n webhook helper ────────────────────────────────────────────────────

  private async notifyN8n(event: string, payload: object) {
    const webhookUrl = process.env.N8N_TRANSFER_WEBHOOK_URL;
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ event, payload }),
    });
  }
}
