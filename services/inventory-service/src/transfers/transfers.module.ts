import { Module }                          from '@nestjs/common';
import { TransfersController }             from './transfers.controller';
import { TransfersService }               from './transfers.service';
import { PrismaModule }                   from '../prisma/prisma.module';
import { EventEmitterModule }             from '@nestjs/event-emitter';

/**
 * Internal Branch Transfer Marketplace Module
 * =============================================
 * Allows branch managers to:
 *   - Request stock items from other branches
 *   - Approve / reject incoming transfer requests
 *   - Track transfer status (REQUESTED → APPROVED → IN_TRANSIT → COMPLETED)
 *
 * n8n WhatsApp notification workflow fires automatically when a new transfer
 * request is created (webhook: POST /automation/hooks/transfer-requested).
 *
 * Prisma model (add to inventory-service schema.prisma):
 * ─────────────────────────────────────────────────────
 * model InventoryTransfer {
 *   id            String           @id @default(cuid())
 *   fromBranchId  String
 *   toBranchId    String
 *   productId     String
 *   productName   String
 *   qty           Int
 *   status        TransferStatus   @default(REQUESTED)
 *   requestedBy   String           // userId
 *   approvedBy    String?          // userId
 *   notes         String?
 *   createdAt     DateTime         @default(now())
 *   updatedAt     DateTime         @updatedAt
 *   completedAt   DateTime?
 * }
 *
 * enum TransferStatus {
 *   REQUESTED
 *   APPROVED
 *   REJECTED
 *   IN_TRANSIT
 *   COMPLETED
 *   CANCELLED
 * }
 */

@Module({
  imports:     [PrismaModule, EventEmitterModule.forRoot()],
  controllers: [TransfersController],
  providers:   [TransfersService],
  exports:     [TransfersService],
})
export class TransfersModule {}
