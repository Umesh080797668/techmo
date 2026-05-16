import {
  Injectable, UnauthorizedException, BadRequestException, ConflictException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import * as bcrypt from 'bcryptjs';
import { Request, Response } from 'express';

const COOKIE_NAME = 'techmo_customer_refresh';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {}

  private get secret(): string {
    return this.config.get<string>('CUSTOMER_JWT_SECRET')
      ?? this.config.get<string>('JWT_SECRET')
      ?? 'customer_secret_change_in_production';
  }

  private signAccess(customerId: string): string {
    return this.jwt.sign(
      { sub: customerId, type: 'customer_access' },
      { secret: this.secret, expiresIn: '15m' },
    );
  }

  private signRefresh(customerId: string): string {
    return this.jwt.sign(
      { sub: customerId, type: 'customer_refresh' },
      { secret: this.secret, expiresIn: '7d' },
    );
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      // strict prevents the cookie being sent on cross-site sub-requests (CSRF)
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE,
      // Restrict to customer-auth paths so the refresh token is NOT transmitted
      // on product / order / repair API calls (minimal exposure surface).
      path: '/api/v1/auth/customer',
    });
  }

  private clearRefreshCookie(res: Response): void {
    // Clear new-style restricted-path cookie.
    res.clearCookie(COOKIE_NAME, { path: '/api/v1/auth/customer' });
    // Also clear the legacy root-path cookie so existing sessions are fully
    // revoked on logout during the transition period.
    res.clearCookie(COOKIE_NAME, { path: '/' });
  }

  private safeCustomer(c: any) {
    const { passwordHash, refreshToken, ...safe } = c;
    return safe;
  }

  /** Shape the DB customer record into what the frontend CustomerUser interface expects. */
  private formatCustomer(c: any) {
    const { passwordHash, refreshToken, firstName, lastName, tier, ...rest } = c;
    return {
      ...rest,
      name: `${firstName ?? ''} ${lastName ?? ''}`.trim(),
      // Prisma enum: NORMAL → frontend calls it STANDARD; PREMIUM stays PREMIUM
      tier: (tier === 'PREMIUM' ? 'PREMIUM' : 'STANDARD') as 'STANDARD' | 'PREMIUM',
    };
  }

  // ─── Register ────────────────────────────────────────────────────────────────
  async register(data: { name: string; phone: string; email: string; password: string; address?: string }, res: Response) {
    const existing = await this.prisma.customer.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === data.email ? 'Email already registered' : 'Phone already registered',
      );
    }

    const [firstName, ...rest] = data.name.trim().split(/\s+/);
    const lastName = rest.join(' ') || '-';
    const passwordHash = await bcrypt.hash(data.password, 12);

    await this.prisma.customer.create({
      data: { firstName, lastName, email: data.email, phone: data.phone, passwordHash, emailVerified: false,
              ...(data.address ? { address: data.address } : {}) },
    });

    // Create email OTP and redirect to verification — no tokens issued yet
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.customerOtp.create({
      data: { target: data.email, type: 'EMAIL_VERIFY', otp, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) },
    });
    this.logger.log(`[Register OTP] ${data.email} → ${otp}`);
    void this.mailer.sendOtpEmail(data.email, otp);

    return {
      requiresEmailVerification: true,
      ...(this.config.get('NODE_ENV') !== 'production' ? { otp } : {}),
    };
  }

  // ─── Email + Password Login ──────────────────────────────────────────────────
  async login(email: string, password: string, res: Response) {
    const customer = await this.prisma.customer.findUnique({ where: { email } });
    if (!customer?.passwordHash) throw new UnauthorizedException('Invalid email or password');

    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.');
    }

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) {
      const attempts = (customer.failedLoginAttempts ?? 0) + 1;
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          failedLoginAttempts: attempts,
          ...(attempts >= 5 ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } : {}),
        },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Block unverified accounts — password check runs first to prevent user
    // enumeration (attacker cannot distinguish "wrong password" from "unverified").
    if (!customer.emailVerified) {
      // Silently resend a fresh verification OTP so the user can unblock themselves.
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await this.prisma.customerOtp.deleteMany({ where: { target: customer.email!, type: 'EMAIL_VERIFY' } });
      await this.prisma.customerOtp.create({
        data: { target: customer.email!, type: 'EMAIL_VERIFY', otp, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) },
      });
      this.logger.log(`[Login – resend verify OTP] ${customer.email} → ${otp}`);
      void this.mailer.sendOtpEmail(customer.email!, otp);
      return {
        requiresEmailVerification: true,
        ...(this.config.get('NODE_ENV') !== 'production' ? { otp } : {}),
      };
    }

    const accessToken = this.signAccess(customer.id);
    const refreshToken = this.signRefresh(customer.id);
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { refreshToken, lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
    this.setRefreshCookie(res, refreshToken);

    return {
      token: accessToken,
      customer: this.formatCustomer(customer),
      mustChangePassword: customer.mustChangePassword ?? false,
    };
  }

  // ─── Refresh Token ───────────────────────────────────────────────────────────
  async refresh(req: Request, res: Response) {
    const cookieToken = req.cookies?.[COOKIE_NAME];
    if (!cookieToken) throw new UnauthorizedException('No refresh token');

    let payload: any;
    try { payload = this.jwt.verify(cookieToken, { secret: this.secret } as any); }
    catch { throw new UnauthorizedException('Invalid or expired refresh token'); }

    if (payload.type !== 'customer_refresh') throw new UnauthorizedException('Invalid token type');

    const customer = await this.prisma.customer.findUnique({ where: { id: payload.sub } });
    if (!customer || customer.refreshToken !== cookieToken) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    const accessToken = this.signAccess(customer.id);
    const newRefreshToken = this.signRefresh(customer.id);
    await this.prisma.customer.update({ where: { id: customer.id }, data: { refreshToken: newRefreshToken } });
    this.setRefreshCookie(res, newRefreshToken);

    return { token: accessToken };
  }

  // ─── Me ──────────────────────────────────────────────────────────────────────
  async me(req: Request) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException('No token');

    let payload: any;
    try { payload = this.jwt.verify(authHeader.slice(7), { secret: this.secret } as any); }
    catch { throw new UnauthorizedException('Invalid token'); }

    if (payload.type !== 'customer_access') throw new UnauthorizedException('Invalid token type');

    const customer = await this.prisma.customer.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        tier: true, loyaltyPoints: true, address: true, nic: true,
        isActive: true, emailVerified: true, lastLoginAt: true, createdAt: true,
      },
    });
    if (!customer) throw new UnauthorizedException('Customer not found');
    return this.formatCustomer(customer);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────
  async logout(req: Request, res: Response) {
    const cookieToken = req.cookies?.[COOKIE_NAME];
    if (cookieToken) {
      try {
        const payload = this.jwt.verify(cookieToken, { secret: this.secret } as any) as any;
        await this.prisma.customer.update({ where: { id: payload.sub }, data: { refreshToken: null } }).catch(() => {});
      } catch {}
    }
    this.clearRefreshCookie(res);
    return { message: 'Logged out' };
  }

  // ─── Phone OTP ───────────────────────────────────────────────────────────────
  async requestOtp(phone: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.customerOtp.create({
      data: { target: phone, type: 'PHONE_LOGIN', otp, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) },
    });
    this.logger.log(`[OTP] Phone ${phone} → ${otp}`); // In dev, visible in docker logs
    return {
      message: 'OTP sent to your phone',
      ...(this.config.get('NODE_ENV') !== 'production' ? { otp } : {}),
    };
  }

  async verifyOtp(phone: string, otp: string, res: Response) {
    const record = await this.prisma.customerOtp.findFirst({
      where: { target: phone, type: 'PHONE_LOGIN', otp, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new UnauthorizedException('Invalid or expired OTP');
    await this.prisma.customerOtp.update({ where: { id: record.id }, data: { used: true } });

    let customer = await this.prisma.customer.findUnique({ where: { phone } });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: { firstName: phone, lastName: '', phone, tier: 'NORMAL', loyaltyPoints: 0 },
      });
    }

    const accessToken = this.signAccess(customer.id);
    const refreshToken = this.signRefresh(customer.id);
    await this.prisma.customer.update({ where: { id: customer.id }, data: { refreshToken, lastLoginAt: new Date() } });
    this.setRefreshCookie(res, refreshToken);

    return { token: accessToken, customer: this.formatCustomer(customer) };
  }

  // ─── Email OTP ───────────────────────────────────────────────────────────────
  async requestEmailOtp(email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.customerOtp.create({
      data: { target: email, type: 'EMAIL_VERIFY', otp, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) },
    });
    this.logger.log(`[OTP] Email ${email} → ${otp}`);
    void this.mailer.sendOtpEmail(email, otp);
    return {
      message: 'OTP sent to your email',
      ...(this.config.get('NODE_ENV') !== 'production' ? { otp } : {}),
    };
  }

  async verifyEmailOtp(email: string, otp: string, res: Response) {
    const record = await this.prisma.customerOtp.findFirst({
      where: { target: email, type: 'EMAIL_VERIFY', otp, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new UnauthorizedException('Invalid or expired OTP');
    await this.prisma.customerOtp.update({ where: { id: record.id }, data: { used: true } });

    const customer = await this.prisma.customer.update({
      where: { email },
      data: { emailVerified: true, lastLoginAt: new Date() },
    });

    // Issue tokens so the user is immediately logged in after verification
    const accessToken = this.signAccess(customer.id);
    const refreshToken = this.signRefresh(customer.id);
    await this.prisma.customer.update({ where: { id: customer.id }, data: { refreshToken } });
    this.setRefreshCookie(res, refreshToken);

    return { token: accessToken, customer: this.formatCustomer(customer) };
  }

  // ─── Password Reset ──────────────────────────────────────────────────────────
  async forgotPassword(email: string) {
    const customer = await this.prisma.customer.findUnique({ where: { email } });
    if (customer) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      // Invalidate any existing unused PASSWORD_RESET OTPs for this email
      await this.prisma.customerOtp.updateMany({
        where: { target: email, type: 'PASSWORD_RESET', used: false },
        data: { used: true },
      });
      await this.prisma.customerOtp.create({
        data: { target: email, type: 'PASSWORD_RESET', otp, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) },
      });
      this.logger.log(`[Password Reset OTP] Email: ${email}`);
      void this.mailer.sendOtpEmail(email, otp);
    }
    return { message: 'If that email is registered, a 6-digit OTP has been sent.' };
  }

  async resetPassword(email: string, otp: string, password: string) {
    const record = await this.prisma.customerOtp.findFirst({
      where: { target: email, type: 'PASSWORD_RESET', otp, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('Invalid or expired OTP. Please request a new one.');
    await this.prisma.customerOtp.update({ where: { id: record.id }, data: { used: true } });
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.customer.update({
      where: { email },
      data: { passwordHash, refreshToken: null, failedLoginAttempts: 0, lockedUntil: null },
    });
    return { message: 'Password reset successfully. Please log in.' };
  }

  // ─── Change Password (first-login force change) ──────────────────────────────
  async changePassword(customerId: string, currentPassword: string, newPassword: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new UnauthorizedException('Customer not found');
    if (!customer.passwordHash) throw new BadRequestException('No password set for this account');

    const valid = await bcrypt.compare(currentPassword, customer.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { passwordHash, mustChangePassword: false, refreshToken: null },
    });
    return { message: 'Password changed successfully' };
  }
}
