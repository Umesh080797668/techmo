import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, DefaultValuePipe, Headers, UseInterceptors,
  UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { RepairsService } from './repairs.service';
import { CourierTrackingService } from './courier-tracking.service';
import {
  CreateRepairDto, UpdateRepairStatusDto, AddRepairPartDto, UpdateRepairDto,
} from './dto/repair.dto';
import { UploadPhotoDto, PhotoPhase } from './dto/upload-photo.dto';
import { CompleteSignedDto } from './dto/complete-signed.dto';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@ApiTags('Repairs')
@Controller('api/v1/repairs')
export class RepairsController {
  constructor(
    private readonly svc: RepairsService,
    private readonly courierSvc: CourierTrackingService,
    private readonly config: ConfigService,
  ) {
    // Configure Cloudinary from NestJS config
    cloudinary.config({
      cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get('CLOUDINARY_API_KEY'),
      api_secret: config.get('CLOUDINARY_API_SECRET'),
    });
  }

  // ── Public endpoint (no auth) for QR tracking ──────────────────────────────
  @Get('track/:qrToken')
  @ApiOperation({ summary: 'Public: track repair by QR token (no auth required)' })
  track(@Param('qrToken') qrToken: string) {
    return this.svc.trackByQrToken(qrToken);
  }

  @Get('public/track')
  @ApiOperation({ summary: 'Public: search repair by ticket number or phone (kiosk)' })
  @ApiQuery({ name: 'ref', required: true, description: 'Ticket number or customer phone' })
  trackPublic(@Query('ref') ref: string) {
    return this.svc.trackPublic(ref);
  }

  @Post('kiosk-checkin')
  @ApiOperation({ summary: 'Public: walk-in kiosk check-in — creates a new RECEIVED repair ticket' })
  kioskCheckin(@Body() body: { phone: string; device: string; fault: string; name?: string }) {
    return this.svc.kioskCheckin(body);
  }

  @Post('sign-delivery/:qrToken')
  @ApiOperation({ summary: 'Public: customer signs to confirm courier delivery (READY_FOR_PICKUP → COMPLETED)' })
  signCourierDelivery(
    @Param('qrToken') qrToken: string,
    @Body() dto: CompleteSignedDto,
  ) {
    return this.svc.signCourierDelivery(qrToken, dto);
  }

  // ── Authenticated endpoints ─────────────────────────────────────────────────
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new repair ticket' })
  create(@Body() dto: CreateRepairDto, @Headers('x-user-id') userId: string) {
    return this.svc.create(dto, userId);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List repair tickets (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'technicianId', required: false })
  @ApiQuery({ name: 'customerPhone', required: false })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('technicianId') technicianId?: string,
    @Query('customerPhone') customerPhone?: string,
  ) {
    return this.svc.findAll(page, limit, status, technicianId, customerPhone);
  }

  @Get('summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Repair status summary counts' })
  summary() {
    return this.svc.getSummary();
  }

  @Get('analytics/failure-rate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Repair failure/return rate analytics by device model' })
  failureRate(@Query('days', new DefaultValuePipe(90), ParseIntPipe) days: number) {
    return this.svc.getRepairFailureStats(days);
  }

  @Get(':id')
  @ApiBearerAuth()
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update repair ticket metadata' })
  update(@Param('id') id: string, @Body() dto: UpdateRepairDto) {
    return this.svc.update(id, dto);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Advance repair ticket through status lifecycle' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRepairStatusDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.svc.updateStatus(id, dto, userId);
  }

  @Post(':id/parts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add parts used in this repair (deducts from inventory)' })
  addParts(
    @Param('id') id: string,
    @Body() dto: AddRepairPartDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.svc.addParts(id, dto, userId);
  }

  // ── Photo Timeline ──────────────────────────────────────────────────────────

  @Post(':id/photos')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a before/during/after photo for this repair' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadPhotoDto,
    @Headers('x-user-id') userId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    // Upload to Cloudinary using stream
    const result: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `techmo_uploads/repairs/${id}`,
          resource_type: 'image',
          tags: [dto.phase, id],
        },
        (err, result) => (err ? reject(err) : resolve(result)),
      );
      Readable.from(file.buffer).pipe(uploadStream);
    });

    return this.svc.uploadPhoto(id, result.secure_url, result.public_id, dto, userId);
  }

  @Patch(':id/photos/:photoId')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Replace a repair photo with an annotated version (overwrites Cloudinary URL in DB)' })
  @UseInterceptors(FileInterceptor('file'))
  async replacePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const result: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `techmo_uploads/repairs/${id}`, resource_type: 'image', tags: ['annotated', id] },
        (err, result) => (err ? reject(err) : resolve(result)),
      );
      Readable.from(file.buffer).pipe(uploadStream);
    });
    return this.svc.updatePhoto(photoId, result.secure_url, result.public_id);
  }

  @Get(':id/photos')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all photos for a repair ticket' })
  getPhotos(@Param('id') id: string) {
    return this.svc.getPhotos(id);
  }

  // ── Digital Signature Completion ────────────────────────────────────────────

  @Post(':id/complete-signed')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete a repair with customer digital signature (READY_FOR_PICKUP → COMPLETED)' })
  completeWithSignature(
    @Param('id') id: string,
    @Body() dto: CompleteSignedDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.svc.completeWithSignature(id, dto, userId);
  }

  // ── QR Status Sticker ───────────────────────────────────────────────────────

  @Post(':id/sticker')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a printable QR status sticker PDF for this ticket' })
  async generateSticker(@Param('id') id: string) {
    const url = await this.svc.generateStatusSticker(id);
    return { url };
  }

  // ── WhatsApp Review Request ─────────────────────────────────────────────────

  @Get(':id/review-link')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a pre-filled WhatsApp review request link' })
  async reviewLink(@Param('id') id: string) {
    const ticket = await this.svc.findOne(id);
    const link = this.svc.buildReviewRequestLink(ticket);
    return { link };
  }

  // ── Courier Tracking ────────────────────────────────────────────────────────

  @Patch(':id/courier-info')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save courier tracking number and carrier for a repair ticket' })
  saveCourierInfo(
    @Param('id') id: string,
    @Body() body: { trackingNumber: string; carrier: string },
  ) {
    return this.svc.saveCourierInfo(id, body.trackingNumber, body.carrier);
  }

  @Get(':id/courier-tracking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get live courier tracking events for a repair ticket' })
  @ApiQuery({ name: 'trackingNumber', required: false })
  @ApiQuery({ name: 'carrier', required: false })
  getCourierTracking(
    @Param('id') id: string,
    @Query('trackingNumber') trackingNumber?: string,
    @Query('carrier') carrier?: string,
  ) {
    return this.svc.getCourierTracking(id, trackingNumber ?? '', carrier ?? '');
  }
}
