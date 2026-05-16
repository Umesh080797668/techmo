import {
  Controller, Post, Get, Delete, Body, Param, Req,
  HttpCode, HttpStatus, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Public } from './public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { WebAuthnService } from './webauthn.service';

/**
 * WebAuthn / Passkey Controller — Gateway
 * =========================================
 * Exposes the FIDO2 registration and authentication flow to the admin UI.
 * Credentials are stored in Redis keyed by user ID.
 *
 * Registration  (called from Settings → Security → Passkeys)
 *   POST /api/v1/auth/webauthn/register/options    → challenge for browser
 *   POST /api/v1/auth/webauthn/register/verify     → verify attestation & store cred
 *
 * Authentication  (called from PIN-challenge modal or future login page)
 *   POST /api/v1/auth/webauthn/login/options       → challenge for browser
 *   POST /api/v1/auth/webauthn/login/verify        → verify assertion & return userId
 *
 * Credential management
 *   GET    /api/v1/auth/webauthn/credentials/:userId   → list passkeys
 *   DELETE /api/v1/auth/webauthn/credentials/:credId   → delete a passkey
 */

@ApiTags('WebAuthn / Passkeys')
@Controller('api/v1/auth/webauthn')
@UseGuards(JwtAuthGuard)
export class WebAuthnController {
  constructor(private readonly webauthn: WebAuthnService) {}

  // ── Registration ─────────────────────────────────────────────────────────

  @Post('register/options')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate WebAuthn registration challenge' })
  async registrationOptions(@Req() req: Request) {
    const userId   = (req as any).user?.userId as string;
    const username = (req as any).user?.username as string;
    if (!userId) throw new UnauthorizedException('Must be logged in to register a passkey');
    return this.webauthn.generateRegistrationOptions(userId, username ?? userId);
  }

  @Post('register/verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify WebAuthn registration and persist credential' })
  async registrationVerify(
    @Req()  req:  Request,
    @Body() body: Record<string, unknown>,
  ) {
    const userId = (req as any).user?.userId as string;
    if (!userId) throw new UnauthorizedException('Must be logged in to register a passkey');

    const credential = await this.webauthn.verifyRegistration(userId, body);
    await this.webauthn.saveCredential(credential);
    return { verified: true, credentialId: credential.credentialId, deviceType: credential.deviceType };
  }

  // ── Authentication ────────────────────────────────────────────────────────

  @Public()
  @Post('login/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate WebAuthn authentication challenge' })
  async authOptions(@Body() body: { userId: string }) {
    const { userId } = body;
    const credentials = await this.webauthn.getCredentialsByUser(userId);
    return this.webauthn.generateAuthenticationOptions(userId, credentials);
  }

  @Public()
  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify WebAuthn assertion and confirm identity' })
  async authVerify(@Body() body: { userId: string; response: Record<string, unknown> }) {
    const { userId, response } = body;
    const credentials = await this.webauthn.getCredentialsByUser(userId);

    // Find which credential the browser used (matched by response.id)
    const credId = (response?.id ?? (response?.rawId)) as string | undefined;
    const credential = credentials.find(c => c.credentialId === credId);
    if (!credential) throw new UnauthorizedException('Unknown credential');

    const { verified, newCounter } = await this.webauthn.verifyAuthentication(userId, response, credential);
    if (verified) {
      await this.webauthn.updateCredentialCounter(userId, credential.credentialId, newCounter);
    }
    return { verified, userId };
  }

  // ── Credential Management ─────────────────────────────────────────────────

  @Get('credentials/:userId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List registered passkeys for a user' })
  async listCredentials(@Param('userId') userId: string, @Req() req: Request) {
    const requesterId = (req as any).user?.userId as string;
    // Allow self-lookup or super_admin
    const authorities: string[] = (req as any).user?.authorities ?? [];
    if (requesterId !== userId && !authorities.includes('ROLE_SUPER_ADMIN')) {
      throw new UnauthorizedException('Cannot list credentials for another user');
    }
    const creds = await this.webauthn.getCredentialsByUser(userId);
    // Return only safe fields — never expose the raw public key
    return creds.map(c => ({
      credentialId: c.credentialId,
      deviceType:   c.deviceType,
      transports:   c.transports,
      createdAt:    c.createdAt,
    }));
  }

  @Delete('credentials/:credentialId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete / revoke a passkey credential' })
  async deleteCredential(
    @Param('credentialId') credentialId: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.userId as string;
    if (!userId) throw new UnauthorizedException();
    await this.webauthn.deleteCredential(userId, credentialId);
  }
}
