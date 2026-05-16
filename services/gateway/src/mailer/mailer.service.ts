import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; path?: string; content?: Buffer; contentType?: string }>;
}

@Injectable()
export class MailerService implements OnModuleInit {
  private transporter!: Transporter;
  private readonly logger = new Logger(MailerService.name);
  private fromEmail!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.fromEmail = this.config.get<string>('FROM_EMAIL', 'noreply@techmo.lk');

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: false, // STARTTLS
      auth: {
        user: this.config.get<string>('SMTP_USER', ''),
        pass: this.config.get<string>('SMTP_PASS', ''),
      },
    });

    this.transporter.verify((err) => {
      if (err) {
        this.logger.warn(`Mailer not connected: ${err.message}`);
      } else {
        this.logger.log('NodeMailer SMTP connection ready');
      }
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `TechMo <${this.fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });
      this.logger.log(`Email sent to ${options.to} — "${options.subject}"`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}: ${(err as Error).message}`);
      throw err;
    }
  }

  // ── Pre-built templates ────────────────────────────────────────────────────

  async sendInvoiceEmail(to: string, customerName: string, invoiceNo: string, pdfUrl: string): Promise<void> {
    await this.send({
      to,
      subject: `TechMo Invoice #${invoiceNo}`,
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#1e40af">Your Invoice is Ready 🧾</h2>
          <p>Dear ${customerName},</p>
          <p>Thank you for your purchase at <strong>TechMo</strong>.</p>
          <p>Your invoice <strong>#${invoiceNo}</strong> is available here:</p>
          <p style="margin:20px 0">
            <a href="${pdfUrl}" style="background:#1e40af;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
              Download Invoice →
            </a>
          </p>
          <p style="color:#64748b;font-size:13px">This link is hosted on Cloudinary and is always accessible.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">TechMo Electronics · Sri Lanka</p>
        </div>
      `,
    });
  }

  async sendRepairStatusEmail(
    to: string,
    customerName: string,
    ticketNo: string,
    status: string,
    trackUrl: string,
  ): Promise<void> {
    const statusLabel = status.replace(/_/g, ' ');
    await this.send({
      to,
      subject: `TechMo Repair Update – Ticket #${ticketNo}`,
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#1e40af">Repair Status Update 🔧</h2>
          <p>Dear ${customerName},</p>
          <p>Your repair ticket <strong>#${ticketNo}</strong> has been updated:</p>
          <div style="background:#eff6ff;border-left:4px solid #1e40af;padding:12px 16px;border-radius:6px;margin:16px 0">
            <strong style="color:#1e40af;font-size:16px">${statusLabel}</strong>
          </div>
          <p>
            <a href="${trackUrl}" style="background:#1e40af;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
              Track Your Repair →
            </a>
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">TechMo Electronics · Sri Lanka</p>
        </div>
      `,
    });
  }

  async sendLowStockAlert(to: string, productName: string, sku: string, qty: number): Promise<void> {
    await this.send({
      to,
      subject: `⚠️ Low Stock Alert: ${productName}`,
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#dc2626">Low Stock Alert ⚠️</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#64748b">Product</td><td style="font-weight:600">${productName}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">SKU</td><td style="font-family:monospace">${sku}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Remaining</td><td style="font-weight:700;color:#dc2626">${qty} units</td></tr>
          </table>
          <p style="color:#64748b;margin-top:16px">Please reorder soon to avoid stockouts.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">TechMo Inventory System</p>
        </div>
      `,
    });
  }

  async sendContactInquiry(
    to: string,
    customerName: string,
    customerEmail: string,
    customerPhone: string,
    message: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: `New Inquiry from ${customerName} — TechMo`,
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#1e40af">New Contact Inquiry 📩</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#64748b">Name</td><td style="font-weight:600">${customerName}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Email</td><td>${customerEmail || '–'}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Phone</td><td>${customerPhone}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;vertical-align:top">Message</td><td>${message}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">TechMo Website Contact Form</p>
        </div>
      `,
    });
  }
}
