import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { RedisService } from '../util/redis.service';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import * as crypto from 'crypto';

/**
 * WebAuthn / Passkeys Service (Gateway)
 * =======================================
 * Implements FIDO2/WebAuthn registration and authentication flows so that
 * managers can use device biometrics (Touch ID, Face ID, Windows Hello) instead
 * of—or in addition to—their manager PIN.
 *
 * Uses the @simplewebauthn/server library (MIT, zero cost).
 * Install: npm install @simplewebauthn/server  (in services/gateway)
 *
 * Flow:
 *   Registration:
 *     1. POST /auth/webauthn/register/options   → generates challenge → store in Redis
 *     2. POST /auth/webauthn/register/verify    → verifies attestation → save credential to DB
 *
 *   Authentication:
 *     1. POST /auth/webauthn/login/options      → generates challenge → store in Redis
 *     2. POST /auth/webauthn/login/verify       → verifies assertion → issue JWT
 *
 * DB table (add to auth-service / gateway shared DB):
 *   passkey_credentials (id, user_id, credential_id, public_key, counter, device_type, created_at)
 *
 * Security notes:
 *   - Private keys never leave the user's device
 *   - Resident credentials (passkeys) are synced via iCloud/Google Password Manager
 *   - Replay attacks prevented by the challenge + counter mechanism
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StoredCredential {
  credentialId:     string;   // base64url
  publicKey:        string;   // base64url encoded COSE key
  counter:          number;
  userId:           string;
  deviceType:       string;
  transports?:      string[];
  createdAt:        Date;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WebAuthnService {
  private readonly logger = new Logger(WebAuthnService.name);
  private readonly rpId:   string = process.env.WEBAUTHN_RP_ID   ?? 'localhost';
  private readonly rpName: string = process.env.WEBAUTHN_RP_NAME ?? 'TechMo';
  private readonly origin: string = process.env.WEBAUTHN_ORIGIN  ?? 'http://localhost:4001';

  constructor(private readonly redis: RedisService) {}

  // ── Registration ─────────────────────────────────────────────────────────

  async generateRegistrationOptions(userId: string, username: string): Promise<object> {
    const {
      generateRegistrationOptions,
    } = await import('@simplewebauthn/server');

    const options = await generateRegistrationOptions({
      rpName:                       this.rpName,
      rpID:                         this.rpId,
      userName:                     username,
      userID:                       Buffer.from(userId),
      attestationType:              'none',
      authenticatorSelection: {
        residentKey:      'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',  // biometric/device-bound
      },
      supportedAlgorithmIDs: [-7, -257],      // ES256, RS256
    });

    // Store challenge in Redis (TTL: 5 minutes)
    await this.redis.set(
      `webauthn:reg:${userId}`,
      JSON.stringify({ challenge: options.challenge, userId }),
      300,
    );

    return options;
  }

  async verifyRegistration(
    userId:   string,
    response: Record<string, unknown>,
  ): Promise<StoredCredential> {
    const { verifyRegistrationResponse } = await import('@simplewebauthn/server');

    const stored = await this.redis.get(`webauthn:reg:${userId}`);
    if (!stored) throw new BadRequestException('Registration challenge expired or not found');

    const { challenge } = JSON.parse(stored);

    const verification = await verifyRegistrationResponse({
      response:           response as never,
      expectedChallenge:  challenge,
      expectedOrigin:     this.origin,
      expectedRPID:       this.rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('WebAuthn registration verification failed');
    }

    await this.redis.del(`webauthn:reg:${userId}`);

    const { credential, credentialDeviceType } = verification.registrationInfo;

    const stored_cred: StoredCredential = {
      credentialId: Buffer.from(credential.id).toString('base64url'),
      publicKey:    Buffer.from(credential.publicKey).toString('base64url'),
      counter:      credential.counter,
      userId,
      deviceType:   credentialDeviceType,
      transports:   (response.response as { transports?: string[] })?.transports,
      createdAt:    new Date(),
    };

    this.logger.log(`Passkey registered for user ${userId} — device: ${credentialDeviceType}`);
    return stored_cred;
  }

  // ── Authentication ────────────────────────────────────────────────────────

  async generateAuthenticationOptions(userId: string, credentials: StoredCredential[]): Promise<object> {
    const { generateAuthenticationOptions } = await import('@simplewebauthn/server');

    const options = await generateAuthenticationOptions({
      rpID:             this.rpId,
      userVerification: 'preferred',
      allowCredentials: credentials.map((c) => ({
        id:         c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
    });

    await this.redis.set(
      `webauthn:auth:${userId}`,
      JSON.stringify({ challenge: options.challenge, userId }),
      300,
    );

    return options;
  }

  async verifyAuthentication(
    userId:      string,
    response:    Record<string, unknown>,
    credential:  StoredCredential,
  ): Promise<{ verified: boolean; newCounter: number }> {
    const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');

    const stored = await this.redis.get(`webauthn:auth:${userId}`);
    if (!stored) throw new UnauthorizedException('Authentication challenge expired');

    const { challenge } = JSON.parse(stored);

    const verification = await verifyAuthenticationResponse({
      response:          response as never,
      expectedChallenge: challenge,
      expectedOrigin:    this.origin,
      expectedRPID:      this.rpId,
      credential: {
        id:         credential.credentialId,
        publicKey:  Buffer.from(credential.publicKey, 'base64url'),
        counter:    credential.counter,
        transports: credential.transports as AuthenticatorTransportFuture[],
      },
    });

    await this.redis.del(`webauthn:auth:${userId}`);

    if (!verification.verified) {
      throw new UnauthorizedException('WebAuthn authentication failed');
    }

    return {
      verified:   true,
      newCounter: verification.authenticationInfo.newCounter,
    };
  }

  // ── Credential persistence (stored in Redis keyed by userId) ─────────────

  async saveCredential(credential: StoredCredential): Promise<void> {
    const existing = await this.getCredentialsByUser(credential.userId);
    existing.push(credential);
    await this.redis.set(
      `webauthn:creds:${credential.userId}`,
      JSON.stringify(existing),
    );
  }

  async getCredentialsByUser(userId: string): Promise<StoredCredential[]> {
    const raw = await this.redis.get(`webauthn:creds:${userId}`);
    if (!raw) return [];
    try { return JSON.parse(raw) as StoredCredential[]; }
    catch { return []; }
  }

  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    const existing = await this.getCredentialsByUser(userId);
    const filtered = existing.filter(c => c.credentialId !== credentialId);
    await this.redis.set(
      `webauthn:creds:${userId}`,
      JSON.stringify(filtered),
    );
  }

  async updateCredentialCounter(userId: string, credentialId: string, newCounter: number): Promise<void> {
    const existing = await this.getCredentialsByUser(userId);
    const updated  = existing.map(c =>
      c.credentialId === credentialId ? { ...c, counter: newCounter } : c,
    );
    await this.redis.set(`webauthn:creds:${userId}`, JSON.stringify(updated));
  }
}
