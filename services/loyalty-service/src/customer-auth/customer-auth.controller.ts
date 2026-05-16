import {
  Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CustomerAuthService } from './customer-auth.service';
import {
  RegisterDto, LoginDto, OtpRequestDto, OtpVerifyDto,
  EmailOtpRequestDto, EmailOtpVerifyDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto,
} from './dto';

@Controller('api/v1/auth/customer')
export class CustomerAuthController {
  constructor(private readonly svc: CustomerAuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.svc.register(dto, res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.svc.login(dto.email, dto.password, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.svc.refresh(req, res);
  }

  @Get('me')
  me(@Req() req: Request) {
    return this.svc.me(req);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.svc.logout(req, res);
  }

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: OtpRequestDto) {
    return this.svc.requestOtp(dto.phone);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: OtpVerifyDto, @Res({ passthrough: true }) res: Response) {
    return this.svc.verifyOtp(dto.phone, dto.otp, res);
  }

  @Post('email/otp/request')
  @HttpCode(HttpStatus.OK)
  requestEmailOtp(@Body() dto: EmailOtpRequestDto) {
    return this.svc.requestEmailOtp(dto.email);
  }

  @Post('email/otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyEmailOtp(@Body() dto: EmailOtpVerifyDto, @Res({ passthrough: true }) res: Response) {
    return this.svc.verifyEmailOtp(dto.email, dto.otp, res);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.svc.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.svc.resetPassword(dto.email, dto.otp, dto.password);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    // Extract customer ID from the Bearer JWT in the Authorization header.
    // The token was already validated by the customer token interceptor.
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }
    // Decode without verification — already verified by auth flow.
    // The gateway-side customer-auth routes forward the raw token.
    const parts = authHeader.slice(7).split('.');
    let customerId: string;
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      customerId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    return this.svc.changePassword(customerId, dto.currentPassword, dto.newPassword);
  }
}
