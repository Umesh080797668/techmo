/**
 * Browser cookie utility for TechMo Customer Portal.
 *
 * Handles non-sensitive, non-HttpOnly cookies:
 *  - Cookie consent record  (techmo_consent)
 *  - Theme preference        (techmo_theme)
 *
 * Auth tokens are NEVER managed here.  The HttpOnly refresh token
 * (techmo_customer_refresh) is set exclusively by the gateway.
 */

export interface CustomerConsentPreferences {
  /** PostHog session replay + page analytics */
  analytics: boolean;
  /** Marketing emails / WhatsApp campaign opt-in */
  marketing: boolean;
  /** Essential UI state (theme, locale) */
  functional: boolean;
}

// ─── Low-level helpers ────────────────────────────────────────────────────────

function setCookie(
  name: string,
  value: string,
  days: number,
  sameSite: 'strict' | 'lax' = 'strict',
): void {
  const expires = new Date(Date.now() + days * 864_00_000).toUTCString();
  const secure  = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=${sameSite}${secure}`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string, path = '/'): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
}

// ─── Cookie Consent ───────────────────────────────────────────────────────────

export const customerConsentService = {
  hasConsented(): boolean {
    return getCookie('techmo_consent') !== null;
  },

  saveConsent(prefs: CustomerConsentPreferences): void {
    setCookie('techmo_consent', JSON.stringify(prefs), 365, 'lax');
  },

  getConsent(): CustomerConsentPreferences | null {
    const raw = getCookie('techmo_consent');
    if (!raw) return null;
    try { return JSON.parse(raw) as CustomerConsentPreferences; } catch { return null; }
  },

  isGranted(category: keyof CustomerConsentPreferences): boolean {
    return this.getConsent()?.[category] ?? false;
  },

  revokeAll(): void {
    deleteCookie('techmo_consent');
  },
};

// ─── Theme Preference ─────────────────────────────────────────────────────────

export const customerThemeService = {
  save(theme: 'light' | 'dark' | 'system'): void {
    setCookie('techmo_theme', theme, 365);
  },

  get(): 'light' | 'dark' | 'system' | null {
    return getCookie('techmo_theme') as 'light' | 'dark' | 'system' | null;
  },

  clear(): void {
    deleteCookie('techmo_theme');
  },
};

export const cookieUtils = { setCookie, getCookie, deleteCookie };
