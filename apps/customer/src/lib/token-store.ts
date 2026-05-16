/**
 * In-memory access-token store for TechMo Customer Portal.
 *
 * Mirrors the same pattern used in the Admin app.
 * Access token is never persisted — it is re-issued on every page load
 * by calling POST /auth/customer/refresh which reads the HttpOnly
 * techmo_customer_refresh cookie set by the gateway.
 */

let _accessToken: string | null = null;
let _refreshFn: (() => Promise<string | null>) | null = null;

export const customerTokenStore = {
  get(): string | null {
    return _accessToken;
  },

  set(token: string | null): void {
    _accessToken = token;
  },

  setRefreshFn(fn: () => Promise<string | null>): void {
    _refreshFn = fn;
  },

  async refresh(): Promise<string | null> {
    return _refreshFn ? _refreshFn() : null;
  },
};
