/**
 * In-memory access-token store for TechMo Admin.
 *
 * The access token NEVER touches localStorage or any persistent storage.
 * It lives only in this module-level variable, which is reset on page refresh
 * (triggering a silent re-issue from the HttpOnly refresh-token cookie via
 * POST /auth/refresh).
 *
 * AuthContext writes to this store after every login / silent-refresh cycle.
 * The axios request interceptor in api.ts reads from this store.
 */

let _accessToken: string | null = null;
let _refreshFn: (() => Promise<string | null>) | null = null;

export const tokenStore = {
  /** Get the current in-memory access token. */
  get(): string | null {
    return _accessToken;
  },

  /** Set a new access token (called by AuthContext on login / refresh). */
  set(token: string | null): void {
    _accessToken = token;
  },

  /**
   * Register the silent-refresh function from AuthContext.
   * Called once during AuthProvider mount so the axios interceptor can
   * trigger a refresh without importing AuthContext (avoids circular deps).
   */
  setRefreshFn(fn: () => Promise<string | null>): void {
    _refreshFn = fn;
  },

  /**
   * Trigger a silent token refresh.
   * Returns the new access token, or null if the refresh cookie has expired.
   */
  async refresh(): Promise<string | null> {
    return _refreshFn ? _refreshFn() : null;
  },
};
