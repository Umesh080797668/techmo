import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
  Get,
} from '@nestjs/common';
import { MailerService, SendMailOptions } from './mailer.service';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/public.decorator';

// ── DTOs ─────────────────────────────────────────────────────────────────────

class SendEmailDto {
  to!: string | string[];
  subject!: string;
  html!: string;
  text?: string;
}

class InvoiceEmailDto {
  to!: string;
  customerName!: string;
  invoiceNo!: string;
  pdfUrl!: string;
}

class RepairStatusEmailDto {
  to!: string;
  customerName!: string;
  ticketNo!: string;
  status!: string;
  trackUrl!: string;
}

class LowStockAlertDto {
  to!: string;
  productName!: string;
  sku!: string;
  qty!: number;
}

class ContactInquiryDto {
  customerName!: string;
  customerEmail?: string;
  customerPhone!: string;
  message!: string;
  /** Cloudflare Turnstile token (validated server-side) */
  turnstileToken!: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('api/v1/mailer')
export class MailerController {
  private readonly logger = new Logger(MailerController.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  /** Generic send — internal services only (no Public decorator → JWT required) */
  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  async send(@Body() dto: SendEmailDto) {
    await this.mailer.send(dto as SendMailOptions);
    return { queued: true };
  }

  /** Invoice email with PDF link — internal */
  @Post('invoice')
  @HttpCode(HttpStatus.ACCEPTED)
  async invoice(@Body() dto: InvoiceEmailDto) {
    await this.mailer.sendInvoiceEmail(dto.to, dto.customerName, dto.invoiceNo, dto.pdfUrl);
    return { queued: true };
  }

  /** Repair status notification — internal */
  @Post('repair-status')
  @HttpCode(HttpStatus.ACCEPTED)
  async repairStatus(@Body() dto: RepairStatusEmailDto) {
    await this.mailer.sendRepairStatusEmail(
      dto.to, dto.customerName, dto.ticketNo, dto.status, dto.trackUrl,
    );
    return { queued: true };
  }

  /** Low-stock alert — internal */
  @Post('low-stock-alert')
  @HttpCode(HttpStatus.ACCEPTED)
  async lowStock(@Body() dto: LowStockAlertDto) {
    await this.mailer.sendLowStockAlert(dto.to, dto.productName, dto.sku, dto.qty);
    return { queued: true };
  }

  /**
   * Contact / inquiry form submission from marketing site.
   * PUBLIC endpoint — validates Cloudflare Turnstile token before sending.
   */
  @Public()
  @Post('contact-inquiry')
  @HttpCode(HttpStatus.ACCEPTED)
  async contactInquiry(@Body() dto: ContactInquiryDto) {
    // ── Validate Turnstile token ──────────────────────────────────────────────
    await this.verifyTurnstile(dto.turnstileToken);

    const alertEmail = this.config.get<string>('ALERT_EMAIL', 'admin@techmo.lk');
    await this.mailer.sendContactInquiry(
      alertEmail,
      dto.customerName,
      dto.customerEmail ?? '',
      dto.customerPhone,
      dto.message,
    );
    return { success: true };
  }

  // ── Turnstile validation ───────────────────────────────────────────────────
  private async verifyTurnstile(token: string): Promise<void> {
    const secret = this.config.get<string>('CF_TURNSTILE_SECRET_KEY', '');
    if (!secret) {
      this.logger.warn('CF_TURNSTILE_SECRET_KEY not set — skipping Turnstile validation');
      return;
    }
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data: any = await resp.json();
    if (!data.success) {
      throw new BadRequestException('Turnstile validation failed. Please try again.');
    }
  }
}
