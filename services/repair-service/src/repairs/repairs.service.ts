import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomBytes } from 'crypto';
import { CourierTrackingService } from './courier-tracking.service';
import {
  CreateRepairDto, UpdateRepairStatusDto, AddRepairPartDto, UpdateRepairDto,
} from './dto/repair.dto';
import { UploadPhotoDto, PhotoPhase } from './dto/upload-photo.dto';
import { CompleteSignedDto } from './dto/complete-signed.dto';

// Status transition rules
const VALID_TRANSITIONS: Record<string, string[]> = {
  RECEIVED: ['PENDING_DIAGNOSIS', 'CANCELLED'],
  PENDING_DIAGNOSIS: ['AWAITING_PARTS', 'UNDER_REPAIR', 'CANCELLED'],
  AWAITING_PARTS: ['UNDER_REPAIR', 'CANCELLED'],
  UNDER_REPAIR: ['READY_FOR_PICKUP', 'AWAITING_PARTS', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'UNDER_REPAIR'],
  COMPLETED: [],
  CANCELLED: [],
};

// Statuses that should trigger customer email notifications
const NOTIFY_STATUSES = ['READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED'];

@Injectable()
export class RepairsService {
  private readonly logger = new Logger(RepairsService.name);
  private workerUrl: string;
  private inventoryUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly courierTracking: CourierTrackingService,
  ) {
    this.workerUrl = config.get('WORKER_SERVICE_URL', 'http://worker-service:8000');
    this.inventoryUrl = config.get('INVENTORY_SERVICE_URL', 'http://inventory-service:3002');
  }

  async create(dto: CreateRepairDto, createdBy: string) {
    const ticketNumber = await this.generateTicketNumber();
    const qrToken = randomBytes(16).toString('hex');

    const ticket = await this.prisma.repairTicket.create({
      data: {
        ticketNumber,
        qrToken,
        customerId: dto.customerId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        deviceBrand: dto.deviceBrand,
        deviceModel: dto.deviceModel,
        imei: dto.imei,
        issueDescription: dto.issueDescription,
        technicianId: dto.technicianId,
        estimatedCost: dto.estimatedCost,
        notes: dto.notes,
        status: 'RECEIVED' as any,
        statusHistory: {
          create: {
            status: 'RECEIVED' as any,
            notes: 'Ticket created — device received',
            updatedBy: createdBy,
          },
        },
      },
      include: { statusHistory: true, parts: true },
    });

    // Generate QR code and repair receipt PDF async
    this.generateRepairQr(ticket).catch((e) =>
      this.logger.warn(`QR gen failed: ${e.message}`),
    );

    return ticket;
  }

  async findAll(page = 1, limit = 20, status?: string, technicianId?: string, customerPhone?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (technicianId) where.technicianId = technicianId;
    if (customerPhone) where.customerPhone = { contains: customerPhone };

    const [data, total] = await Promise.all([
      this.prisma.repairTicket.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { parts: true, _count: { select: { statusHistory: true } } },
      }),
      this.prisma.repairTicket.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  /** Kiosk public track — find by ticketNumber or customerPhone */
  async trackPublic(ref: string) {
    const byTicket = await this.prisma.repairTicket.findFirst({
      where: { ticketNumber: ref },
      select: {
        ticketNumber: true, deviceBrand: true, deviceModel: true,
        status: true, estimatedCost: true, finalCost: true,
        statusHistory: { select: { status: true, notes: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (byTicket) return byTicket;

    // Fallback: return latest ticket matching phone
    const byPhone = await this.prisma.repairTicket.findFirst({
      where: { customerPhone: ref },
      orderBy: { createdAt: 'desc' },
      select: {
        ticketNumber: true, deviceBrand: true, deviceModel: true,
        status: true, estimatedCost: true, finalCost: true,
        statusHistory: { select: { status: true, notes: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (byPhone) return byPhone;
    throw new NotFoundException('No repair found for that ticket number or phone');
  }

  /** Kiosk walk-in check-in — creates a RECEIVED ticket from minimal info */
  async kioskCheckin(dto: { phone: string; device: string; fault: string; name?: string }) {
    const ticketNumber = await this.generateTicketNumber();
    const qrToken = randomBytes(16).toString('hex');
    const [brand, ...modelParts] = dto.device.split(' ');
    const ticket = await this.prisma.repairTicket.create({
      data: {
        ticketNumber,
        qrToken,
        customerName: dto.name ?? 'Walk-in Customer',
        customerPhone: dto.phone,
        deviceBrand: brand || 'Unknown',
        deviceModel: modelParts.join(' ') || dto.device,
        issueDescription: dto.fault,
        status: 'RECEIVED' as any,
        statusHistory: {
          create: { status: 'RECEIVED' as any, notes: 'Kiosk walk-in check-in', updatedBy: 'kiosk' },
        },
      },
    });
    return { ticketRef: ticket.ticketNumber, qrToken: ticket.qrToken, id: ticket.id };
  }

  async findOne(id: string) {
    const ticket = await this.prisma.repairTicket.findUnique({
      where: { id },
      include: { statusHistory: { orderBy: { createdAt: 'asc' } }, parts: true },
    });
    if (!ticket) throw new NotFoundException(`Repair ticket ${id} not found`);
    return ticket;
  }

  async trackByQrToken(qrToken: string) {
    const ticket = await this.prisma.repairTicket.findUnique({
      where: { qrToken },
      select: {
        id: true,
        ticketNumber: true,
        deviceBrand: true,
        deviceModel: true,
        customerName: true,
        issueDescription: true,
        status: true,
        estimatedCost: true,
        finalCost: true,
        createdAt: true,
        courierTrackingNumber: true,
        courierCarrier: true,
        courierStatus: true,
        statusHistory: {
          select: { status: true, notes: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Repair ticket not found');
    return ticket;
  }

  async updateStatus(id: string, dto: UpdateRepairStatusDto, changedBy: string) {
    changedBy = changedBy || 'system';
    const ticket = await this.findOne(id);
    const allowed = VALID_TRANSITIONS[ticket.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${ticket.status} to ${dto.status}`,
      );
    }

    const updated = await this.prisma.repairTicket.update({
      where: { id },
      data: {
        status: dto.status as any,
        finalCost: dto.finalCost ?? ticket.finalCost,
        statusHistory: {
          create: {
            status: dto.status as any,
            notes: dto.notes,
            updatedBy: changedBy,
          },
        },
      },
      include: { statusHistory: { orderBy: { createdAt: 'asc' } }, parts: true },
    });

    // Notify customer if status warrants
    if (NOTIFY_STATUSES.includes(dto.status)) {
      this.notifyCustomer(updated, dto.status).catch((e) =>
        this.logger.warn(`Notification failed: ${e.message}`),
      );
    }

    return updated;
  }

  async update(id: string, dto: UpdateRepairDto) {
    await this.findOne(id);
    return this.prisma.repairTicket.update({ where: { id }, data: dto });
  }

  async addParts(id: string, dto: AddRepairPartDto, addedBy: string) {
    await this.findOne(id);

    // Deduct each part from inventory
    for (const part of dto.parts) {
      if (part.inventoryId) {
        await axios.post(
          `${this.inventoryUrl}/api/v1/inventory/${part.inventoryId}/adjust`,
          {
            quantityDelta: -part.quantity,
            movementType: 'REPAIR_USED',
            reason: `Used in repair ticket ${id}`,
            reference: id,
            performedBy: addedBy,
          },
        ).catch((e) => this.logger.warn(`Inventory deduct for part failed: ${e.message}`));
      }
    }

    const creates = dto.parts.map((p) => ({
      ticketId: id,
      productId: p.productId ?? '',
      productName: p.productName,
      sku: p.sku ?? '',
      quantity: p.quantity,
      unitCost: p.unitCost,
    }));

    await this.prisma.repairPart.createMany({ data: creates });
    return this.findOne(id);
  }

  async getSummary() {
    const [total, byStatus] = await Promise.all([
      this.prisma.repairTicket.count(),
      this.prisma.repairTicket.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);
    return { total, byStatus };
  }

  private async generateTicketNumber(): Promise<string> {
    const count = await this.prisma.repairTicket.count();
    const prefix = `RPR-${new Date().getFullYear()}`;
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateRepairQr(ticket: any) {
    await axios.post(`${this.workerUrl}/api/qr/repair`, {
      qrToken: ticket.qrToken,
      ticketNumber: ticket.ticketNumber,
    });
  }

  private async notifyCustomer(ticket: any, status: string) {
    await axios.post(`${this.workerUrl}/api/email/repair-status`, {
      customerId: ticket.customerId,
      ticketNumber: ticket.ticketNumber,
      deviceBrand: ticket.deviceBrand,
      deviceModel: ticket.deviceModel,
      status,
      qrToken: ticket.qrToken,
    });
  }

  // ─── Repair Photo Timeline ────────────────────────────────────────────────────

  async uploadPhoto(
    id: string,
    cloudinaryUrl: string,
    publicId: string,
    dto: UploadPhotoDto,
    uploadedBy: string,
  ) {
    uploadedBy = uploadedBy || 'system';
    const ticket = await this.prisma.repairTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Repair ticket not found');

    return this.prisma.repairPhoto.create({
      data: {
        ticketId: id,
        phase: dto.phase as any,
        cloudinaryUrl,
        publicId,
        uploadedBy,
        caption: dto.caption,
      },
    });
  }

  async updatePhoto(photoId: string, cloudinaryUrl: string, publicId: string) {
    return this.prisma.repairPhoto.update({
      where: { id: photoId },
      data: { cloudinaryUrl, publicId },
    });
  }

  async getPhotos(id: string) {
    const ticket = await this.prisma.repairTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Repair ticket not found');

    return this.prisma.repairPhoto.findMany({
      where: { ticketId: id },
      orderBy: [{ phase: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // ─── Digital Signature on Completion ─────────────────────────────────────────

  async completeWithSignature(id: string, dto: CompleteSignedDto, technicianId: string) {
    const updatedBy = technicianId || 'system';
    const ticket = await this.prisma.repairTicket.findUnique({
      where: { id },
      include: { parts: true },
    });
    if (!ticket) throw new NotFoundException('Repair ticket not found');
    if (ticket.status !== 'READY_FOR_PICKUP') {
      throw new BadRequestException(
        'Signature completion only allowed when ticket is READY_FOR_PICKUP',
      );
    }

    // Generate signed receipt PDF via worker service
    let receiptUrl: string | undefined;
    try {
      const photos = await this.getPhotos(id);
      const afterPhotos = photos
        .filter(p => p.phase === 'AFTER')
        .map(p => p.cloudinaryUrl);

      const res = await axios.post(`${this.workerUrl}/api/v1/worker/pdf/signed-repair-receipt`, {
        ticket_number: ticket.ticketNumber,
        customer_name: ticket.customerName,
        customer_phone: ticket.customerPhone,
        device: `${ticket.deviceBrand} ${ticket.deviceModel}`,
        issue: ticket.issueDescription,
        final_cost: ticket.finalCost ? Number(ticket.finalCost) : null,
        technician_notes: ticket.notes,
        signature_data_url: dto.signatureDataUrl,
        after_photos: afterPhotos,
        completed_at: new Date().toISOString(),
      });
      receiptUrl = res.data?.url;
    } catch (e) {
      this.logger.warn('Failed to generate signed receipt PDF', e);
    }

    // Transition status to COMPLETED
    const updated = await this.prisma.$transaction([
      this.prisma.repairTicket.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          signatureUrl: dto.signatureDataUrl,
          completionReceiptUrl: receiptUrl ?? null,
          notes: dto.notes ? `${ticket.notes ?? ''}\n[Completion] ${dto.notes}`.trim() : ticket.notes,
        },
      }),
      this.prisma.repairStatusHistory.create({
        data: { ticketId: id, status: 'COMPLETED', updatedBy: updatedBy, notes: 'Signed completion' },
      }),
    ]);

    try {
      await this.notifyCustomer(ticket, 'COMPLETED');
    } catch (_) {}

    return updated[0];
  }

  // ─── Courier Delivery Signature (public — customer signs via tracking page) ──

  async signCourierDelivery(qrToken: string, dto: CompleteSignedDto) {
    const ticket = await this.prisma.repairTicket.findUnique({
      where: { qrToken },
      include: { parts: true },
    });
    if (!ticket) throw new NotFoundException('Repair ticket not found');
    if (ticket.status !== 'READY_FOR_PICKUP') {
      throw new BadRequestException(
        'Delivery signature only allowed when ticket is READY_FOR_PICKUP',
      );
    }

    // Generate signed receipt PDF via worker service
    let receiptUrl: string | undefined;
    try {
      const photos = await this.getPhotos(ticket.id);
      const afterPhotos = photos.filter(p => p.phase === 'AFTER').map(p => p.cloudinaryUrl);
      const res = await axios.post(`${this.workerUrl}/api/v1/worker/pdf/signed-repair-receipt`, {
        ticket_number: ticket.ticketNumber,
        customer_name: ticket.customerName,
        customer_phone: ticket.customerPhone,
        device: `${ticket.deviceBrand} ${ticket.deviceModel}`,
        issue: ticket.issueDescription,
        final_cost: ticket.finalCost ? Number(ticket.finalCost) : null,
        technician_notes: ticket.notes,
        signature_data_url: dto.signatureDataUrl,
        after_photos: afterPhotos,
        completed_at: new Date().toISOString(),
      });
      receiptUrl = res.data?.url;
    } catch (e) {
      this.logger.warn('Failed to generate signed receipt PDF for courier delivery', e);
    }

    await this.prisma.$transaction([
      this.prisma.repairTicket.update({
        where: { id: ticket.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          signatureUrl: dto.signatureDataUrl,
          completionReceiptUrl: receiptUrl ?? null,
          courierStatus: 'DELIVERED',
          notes: dto.notes
            ? `${ticket.notes ?? ''}\n[Courier Delivery] ${dto.notes}`.trim()
            : ticket.notes,
        },
      }),
      this.prisma.repairStatusHistory.create({
        data: {
          ticketId: ticket.id,
          status: 'COMPLETED',
          updatedBy: 'customer',
          notes: 'Customer signed to confirm courier delivery',
        },
      }),
    ]);

    try { await this.notifyCustomer(ticket, 'COMPLETED'); } catch (_) {}

    return { success: true, receiptUrl: receiptUrl ?? null };
  }

  // ─── QR Status Sticker ────────────────────────────────────────────────────────

  async generateStatusSticker(id: string): Promise<string> {
    const ticket = await this.prisma.repairTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Repair ticket not found');

    const trackingUrl = `${this.config.get('MARKETING_URL') ?? 'https://techmo.lk'}/track/${ticket.qrToken}`;

    const res = await axios.post(`${this.workerUrl}/api/v1/worker/pdf/status-sticker`, {
      ticket_number: ticket.ticketNumber,
      device: `${ticket.deviceBrand} ${ticket.deviceModel}`,
      status: ticket.status,
      tracking_url: trackingUrl,
      qr_token: ticket.qrToken,
    });

    return res.data?.url ?? '';
  }

  // ─── WhatsApp Review Request ──────────────────────────────────────────────────

  buildReviewRequestLink(ticket: any): string {
    const msg = encodeURIComponent(
      `Hi ${ticket.customerName}, your ${ticket.deviceBrand} ${ticket.deviceModel} repair (${ticket.ticketNumber}) is complete! ` +
      `We'd love your feedback — please leave us a quick review at https://g.page/r/techmo/review 🙏`,
    );
    const phone = ticket.customerPhone.replace(/\D/g, '');
    return `https://wa.me/${phone}?text=${msg}`;
  }

  // ─── Repair Failure Rate Analytics ───────────────────────────────────────────

  async getRepairFailureStats(days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Prisma ORM avoids raw SQL column-name quoting issues (camelCase columns)
    const completed = await this.prisma.repairTicket.findMany({
      where: { status: 'COMPLETED' as any, completedAt: { gte: since } },
      select: { id: true, deviceModel: true },
    });

    if (completed.length === 0) return [];

    // Tickets whose status history notes mention "return" or "reopened"
    const failedHistory = await this.prisma.repairStatusHistory.findMany({
      where: {
        ticketId: { in: completed.map(t => t.id) },
        OR: [
          { notes: { contains: 'return', mode: 'insensitive' } },
          { notes: { contains: 'reopened', mode: 'insensitive' } },
        ],
      },
      select: { ticketId: true },
    });

    const failedIds = new Set(failedHistory.map(h => h.ticketId));

    // Aggregate by device model
    const modelMap: Record<string, { totalRepairs: number; failures: number }> = {};
    for (const ticket of completed) {
      const model = ticket.deviceModel || 'Unknown';
      if (!modelMap[model]) modelMap[model] = { totalRepairs: 0, failures: 0 };
      modelMap[model].totalRepairs++;
      if (failedIds.has(ticket.id)) modelMap[model].failures++;
    }

    return Object.entries(modelMap)
      .map(([deviceModel, stats]) => ({
        deviceModel,
        totalRepairs: stats.totalRepairs,
        failures: stats.failures,
        failureRate:
          stats.totalRepairs > 0
            ? Number(((stats.failures / stats.totalRepairs) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.failureRate - a.failureRate)
      .slice(0, 20);
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
      this.prisma.repairTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { statusHistory: true, parts: true },
      }),
      this.prisma.repairTicket.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOneForCustomer(id: string, customerId: string) {
    const ticket = await this.findOne(id);
    if (ticket.customerId !== customerId) {
      throw new NotFoundException('Repair ticket not found');
    }
    return ticket;
  }

  // ── Courier Tracking ─────────────────────────────────────────────────────

  /** Save / update the courier tracking info on a repair ticket */
  async saveCourierInfo(
    id: string,
    trackingNumber: string,
    carrier: string,
  ) {
    // Support lookup by UUID or ticket number
    const existing = await this.prisma.repairTicket.findFirst({
      where: {
        OR: [
          { id },
          { ticketNumber: id },
        ],
      },
    });
    if (!existing) throw new NotFoundException(`Repair ticket ${id} not found`);

    return this.prisma.repairTicket.update({
      where: { id: existing.id },
      data: {
        courierTrackingNumber: trackingNumber,
        courierCarrier: carrier,
        courierStatus: 'PENDING',
        courierUpdatedAt: new Date(),
      },
    });
  }

  /** Poll courier API for live tracking events */
  async getCourierTracking(
    id: string,
    trackingNumber: string,
    carrier: string,
  ) {
    // id can be UUID or ticketNumber — verify ticket exists
    const ticket = await this.prisma.repairTicket.findFirst({
      where: {
        OR: [
          { id },
          { ticketNumber: id },
        ],
      },
    });
    if (!ticket) throw new NotFoundException(`Repair ticket ${id} not found`);

    // Use the stored tracking info if none supplied
    const tn = trackingNumber || ticket.courierTrackingNumber || '';
    const ca = carrier       || ticket.courierCarrier       || 'dhl';
    if (!tn) throw new BadRequestException('No tracking number associated with this repair');

    return this.courierTracking.track(tn, ca);
  }
}
