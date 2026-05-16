import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { CookieService } from '../cookie/cookie.service';
import { Public } from './public.decorator';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly cookies: CookieService,
    private readonly jwtService: JwtService,
  ) {}

  private get authServiceUrl(): string {
    const url = this.config.get<string>('AUTH_SERVICE_URL');
    if (!url) throw new InternalServerErrorException('AUTH_SERVICE_URL not configured');
    return url;
  }

  // ─── Login ─────────────────────────────────────────────────────────────────
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)  // 5 attempts per 15 minutes per IP — prevents brute-force credential attacks.
  @Throttle({ default: { limit: 5, ttl: 900_000 } })  async login(
    @Body() body: { username: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    let data: any;
    try {
      const resp = await firstValueFrom(
        this.http.post(
          `${this.authServiceUrl}/api/v1/auth/login`,
          { usernameOrEmail: body.username, password: body.password },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Forwarded-For': req.ip ?? '',
              'User-Agent': req.headers['user-agent'] ?? '',
            },
          },
        ),
      );
      data = resp.data;
    } catch (err: any) {
      // Forward the auth-service error status & message rather than 500
      const status = err?.response?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
      const message = err?.response?.data?.message ?? 'Invalid credentials';
      throw new HttpException({ message }, status);
    }

    // Extract the raw refresh token from the auth-service response body and
    // place it in an HttpOnly cookie so the browser never exposes it to JS.
    const { refreshToken, accessToken, userId, username, fullName, tokenType, mustChangePassword } = data;
    if (refreshToken) {
      this.cookies.setRefreshToken(res, refreshToken);
    }

    // Derive the user's actual role by decoding the JWT authorities claim.
    const role = this.extractRole(accessToken);

    // Reshape to match admin UI expectations: { accessToken, user: {...} }
    return {
      accessToken,
      tokenType: tokenType ?? 'Bearer',
      user: {
        id: userId,
        username,
        name: fullName,
        role,
        mustChangePassword: mustChangePassword ?? false,
      },
    };
  }

  // ─── Silent Refresh ─────────────────────────────────────────────────────────
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)  // 20 refreshes per minute per IP.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = this.cookies.getRefreshToken(req);
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token cookie found');
    }

    const { data } = await firstValueFrom(
      this.http.post(
        `${this.authServiceUrl}/api/v1/auth/refresh`,
        { refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': req.ip ?? '',
            'User-Agent': req.headers['user-agent'] ?? '',
          },
        },
      ),
    );

    // Rotate: replace old cookie with the newly issued refresh token.
    const { refreshToken: newRefreshToken, accessToken, userId, username, fullName, tokenType } = data;
    if (newRefreshToken) {
      this.cookies.setRefreshToken(res, newRefreshToken);
    }

    // Derive role from the new access token — same shape as login response.
    const role = this.extractRole(accessToken);

    return {
      accessToken,
      tokenType: tokenType ?? 'Bearer',
      user: {
        id: userId,
        username,
        name: fullName,
        role,
      },
    };
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = (req as any).user?.userId;

    // Best-effort call to auth service to revoke the stored refresh token.
    if (userId) {
      try {
        await firstValueFrom(
          this.http.post(`${this.authServiceUrl}/api/v1/auth/logout`, null, {
            headers: {
              'X-User-Id': userId,
              'X-Forwarded-For': req.ip ?? '',
              'User-Agent': req.headers['user-agent'] ?? '',
            },
          }),
        );
      } catch {
        // Non-fatal — we still clear the cookie.
      }
    }

    this.cookies.clearRefreshToken(res);
  }

  // ─── Change Password ────────────────────────────────────────────────────────
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.userId;
    await firstValueFrom(
      this.http.post(`${this.authServiceUrl}/api/v1/auth/change-password`, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId ?? '',
          'X-Forwarded-For': req.ip ?? '',
          'User-Agent': req.headers['user-agent'] ?? '',
        },
      }),
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Decode the JWT (no re-verification — auth-service already verified it)
   * and extract the primary role from the `authorities` claim.
   * Returns the role name without the "ROLE_" prefix (e.g. "SUPER_ADMIN").
   */
  private extractRole(accessToken: string): string {
    try {
      const payload = this.jwtService.decode(accessToken) as Record<string, any>;
      const authorities: string[] = payload?.authorities ?? [];
      const roleAuthority = authorities.find((a: string) => a.startsWith('ROLE_'));
      return roleAuthority ? roleAuthority.replace('ROLE_', '') : 'MANAGER';
    } catch {
      return 'MANAGER';
    }
  }
}
