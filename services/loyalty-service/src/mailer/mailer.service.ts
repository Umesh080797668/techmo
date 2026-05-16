import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService implements OnModuleInit {
  private transporter!: nodemailer.Transporter;
  private readonly logger = new Logger(MailerService.name);
  private fromEmail!: string;
  private fromName = 'TechMo';

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
        this.logger.warn(`Mailer SMTP not connected: ${err.message}`);
      } else {
        this.logger.log('Mailer SMTP connection ready ✓');
      }
    });
  }

  // ── OTP Verification Email ─────────────────────────────────────────────────

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `${this.fromName} <${this.fromEmail}>`,
        to,
        subject: `${otp} is your TechMo verification code`,
        html: `
          <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff">
            <div style="text-align:center;margin-bottom:32px">
              <h1 style="color:#1e40af;font-size:24px;margin:0;font-weight:700">TechMo</h1>
              <p style="color:#64748b;font-size:14px;margin:4px 0 0">Electronics · Sri Lanka</p>
            </div>

            <h2 style="color:#0f172a;font-size:20px;font-weight:600;margin:0 0 12px">Verify your email address</h2>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 28px">
              Enter the code below to verify your email and complete your TechMo account setup.
            </p>

            <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px">
              <p style="color:#1e40af;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin:0 0 8px">Your verification code</p>
              <p style="color:#1e3a8a;font-size:40px;font-weight:800;letter-spacing:0.2em;margin:0;font-family:monospace">${otp}</p>
            </div>

            <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 8px">
              ⏱ This code expires in <strong>5 minutes</strong>.
            </p>
            <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0">
              If you didn't create a TechMo account, you can safely ignore this email.
            </p>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0"/>
            <p style="color:#cbd5e1;font-size:12px;text-align:center;margin:0">
              TechMo Electronics · Sri Lanka · This is an automated message
            </p>
          </div>
        `,
        text: `Your TechMo verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you didn't create a TechMo account, ignore this email.`,
      });
      this.logger.log(`OTP email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send OTP email to ${to}: ${(err as Error).message}`);
      // Don't re-throw — email failure should not block registration
    }
  }

  // ── Password Reset Email ───────────────────────────────────────────────────

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `${this.fromName} <${this.fromEmail}>`,
        to,
        subject: 'Reset your TechMo password',
        html: `
          <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff">
            <div style="text-align:center;margin-bottom:32px">
              <h1 style="color:#1e40af;font-size:24px;margin:0;font-weight:700">TechMo</h1>
              <p style="color:#64748b;font-size:14px;margin:4px 0 0">Electronics · Sri Lanka</p>
            </div>

            <h2 style="color:#0f172a;font-size:20px;font-weight:600;margin:0 0 12px">Password reset request</h2>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 28px">
              We received a request to reset the password for your TechMo account. Click the button below to set a new password.
            </p>

            <div style="text-align:center;margin-bottom:28px">
              <a href="${resetUrl}"
                 style="display:inline-block;background:#1e40af;color:#ffffff;font-size:15px;font-weight:600;
                        padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.01em">
                Reset Password →
              </a>
            </div>

            <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 8px">
              ⏱ This link expires in <strong>1 hour</strong>.
            </p>
            <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 8px">
              If the button doesn't work, copy and paste this URL into your browser:
            </p>
            <p style="color:#64748b;font-size:12px;word-break:break-all;margin:0">${resetUrl}</p>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0"/>
            <p style="color:#cbd5e1;font-size:12px;text-align:center;margin:0">
              If you didn't request a password reset, no action is needed. Your account is safe.
            </p>
          </div>
        `,
        text: `Reset your TechMo password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
      });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${to}: ${(err as Error).message}`);
    }
  }
}
