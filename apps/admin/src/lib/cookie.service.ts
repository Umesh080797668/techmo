/**
 * Browser cookie utility for TechMo Admin.
 *
 * Handles non-sensitive, non-HttpOnly cookies:
 *  - Cookie consent record  (techmo_consent)
 *  - Theme preference        (techmo_theme)
 *  - UI locale               (techmo_locale)
 *
 * Auth tokens are NEVER managed here.  The HttpOnly refresh token is set
 * exclusively by the gateway; the access token lives in memory (token-store.ts).
 */

export interface ConsentPreferences {
  /** Google Analytics / PostHog */
  analytics: boolean;
  /** Marketing emails / WhatsApp opt-in banners */
  marketing: boolean;
  /** UI preferences, recently-viewed, keyboard shortcuts */
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

export const consentService = {
  /** Returns true if the user has already made a consent decision. */
  hasConsented(): boolean {
    return getCookie('techmo_consent') !== null;
  },

  /**
   * Persist the user's consent preferences for 1 year.
   * SameSite=Lax so it survives top-level cross-site navigations.
   */
  saveConsent(prefs: ConsentPreferences): void {
    setCookie('techmo_consent', JSON.stringify(prefs), 365, 'lax');
  },

  /** Retrieve the current consent record, or null if not yet set. */
  getConsent(): ConsentPreferences | null {
    const raw = getCookie('techmo_consent');
    if (!raw) return null;
    try { return JSON.parse(raw) as ConsentPreferences; } catch { return null; }
  },

  /** Check whether a specific category has been granted. */
  isGranted(category: keyof ConsentPreferences): boolean {
    return this.getConsent()?.[category] ?? false;
  },

  /** Revoke and delete all consent records (e.g. from profile settings). */
  revokeAll(): void {
    deleteCookie('techmo_consent');
  },
};

// ─── Theme Preference ─────────────────────────────────────────────────────────

export const themeService = {
  /** Persist the chosen theme for 1 year. */
  save(theme: 'light' | 'dark' | 'system'): void {
    setCookie('techmo_theme', theme, 365);
  },

  /** Read the persisted theme preference. */
  get(): 'light' | 'dark' | 'system' | null {
    return getCookie('techmo_theme') as 'light' | 'dark' | 'system' | null;
  },

  clear(): void {
    deleteCookie('techmo_theme');
  },
};

// ─── UI Locale ────────────────────────────────────────────────────────────────

export const localeService = {
  /** Persist the selected UI locale (e.g. 'en', 'si', 'ta'). */
  save(locale: string): void {
    setCookie('techmo_locale', locale, 365);
  },

  get(): string | null {
    return getCookie('techmo_locale');
  },

  clear(): void {
    deleteCookie('techmo_locale');
  },
};

// ─── Generic helpers (exported for advanced use) ──────────────────────────────

export const cookieUtils = { setCookie, getCookie, deleteCookie };
