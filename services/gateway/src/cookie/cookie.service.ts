import { Injectable } from '@nestjs/common';
import { Request, Response } from 'express';

export interface CookieSetOptions {
  name: string;
  value: string;
  /** Lifetime in seconds */
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string;
  domain?: string;
}

// ─── Token lifetimes ─────────────────────────────────────────────────────────
const SEVEN_DAYS_MS     = 7  * 24 * 60 * 60 * 1_000;
const ONE_YEAR_MS       = 365 * 24 * 60 * 60 * 1_000;
const ONE_DAY_MS        = 1   * 24 * 60 * 60 * 1_000;

@Injectable()
export class CookieService {
  private readonly isProd = process.env.NODE_ENV === 'production';

  // ─── Staff Refresh Token ────────────────────────────────────────────────────

  /**
   * Set the staff JWT refresh token as an HttpOnly Secure SameSite=Strict cookie.
   * Path restricted to auth endpoints — never sent with other requests.
   */
  setRefreshToken(res: Response, token: string, maxAgeMs = SEVEN_DAYS_MS): void {
    res.cookie('techmo_refresh', token, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: maxAgeMs,
    });
  }

  /** Extract the staff refresh token from the incoming request's cookies. */
  getRefreshToken(req: Request): string | undefined {
    return req.cookies?.['techmo_refresh'];
  }

  /** Expire the staff refresh token cookie on logout. */
  clearRefreshToken(res: Response): void {
    res.clearCookie('techmo_refresh', {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'strict',
      path: '/api/v1/auth',
    });
  }

  // ─── Customer Refresh Token ─────────────────────────────────────────────────

  /**
   * Set the customer portal JWT refresh token as an HttpOnly Secure cookie.
   * Path restricted to customer auth endpoints.
   */
  setCustomerRefreshToken(res: Response, token: string, maxAgeMs = SEVEN_DAYS_MS): void {
    res.cookie('techmo_customer_refresh', token, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'strict',
      path: '/api/v1/auth/customer',
      maxAge: maxAgeMs,
    });
  }

  /** Extract the customer refresh token from cookies. */
  getCustomerRefreshToken(req: Request): string | undefined {
    return req.cookies?.['techmo_customer_refresh'];
  }

  /** Expire the customer refresh token cookie on logout. */
  clearCustomerRefreshToken(res: Response): void {
    res.clearCookie('techmo_customer_refresh', {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'strict',
      path: '/api/v1/auth/customer',
    });
  }

  // ─── CSRF Double-Submit Token ────────────────────────────────────────────────

  /**
   * Set a readable (non-HttpOnly) CSRF double-submit cookie.
   * The client must echo this exact value in the `X-CSRF-Token` header on
   * every mutating request. Validated by CsrfGuard in the gateway.
   */
  setCsrfToken(res: Response, token: string): void {
    res.cookie('techmo_csrf', token, {
      httpOnly: false,        // intentionally readable by JS
      secure: this.isProd,
      sameSite: 'strict',
      path: '/',
      maxAge: ONE_DAY_MS,
    });
  }

  getCsrfToken(req: Request): string | undefined {
    return req.cookies?.['techmo_csrf'];
  }

  // ─── Cookie-Consent Record ───────────────────────────────────────────────────

  /**
   * Persist the user's cookie consent choices for 1 year.
   * Categories: { analytics, marketing, functional }
   * Uses SameSite=Lax so it survives cross-site top-level navigations
   * (needed when the user returns from an OAuth provider).
   */
  setConsentCookie(res: Response, categories: Record<string, boolean>): void {
    res.cookie('techmo_consent', JSON.stringify(categories), {
      httpOnly: false,        // must be readable by analytics scripts
      secure: this.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: ONE_YEAR_MS,
    });
  }

  getConsentCookie(req: Request): Record<string, boolean> | null {
    try {
      const raw: string | undefined = req.cookies?.['techmo_consent'];
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : null;
    } catch {
      return null;
    }
  }

  // ─── Generic Helpers ─────────────────────────────────────────────────────────

  /** Low-level setter — full control over all cookie attributes. */
  set(res: Response, options: CookieSetOptions): void {
    const { name, value, maxAge, secure, sameSite, httpOnly, path, domain } = options;
    res.cookie(name, value, {
      maxAge:   maxAge !== undefined ? maxAge * 1_000 : undefined,
      httpOnly: httpOnly ?? false,
      secure:   secure   ?? this.isProd,
      sameSite: sameSite  ?? 'strict',
      path:     path      ?? '/',
      domain,
    });
  }

  /** Read any named cookie from the request. */
  get(req: Request, name: string): string | undefined {
    return req.cookies?.[name];
  }

  /** Expire (clear) any named cookie. */
  clear(res: Response, name: string, path = '/'): void {
    res.clearCookie(name, { path, secure: this.isProd });
  }
}
