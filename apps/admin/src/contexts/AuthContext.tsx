'use client';
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { authApi, parseApiError } from '@/lib/api';
import { tokenStore } from '@/lib/token-store';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: 'SUPER_ADMIN' | 'MANAGER' | 'CASHIER' | 'TECHNICIAN' | 'HR_ADMIN';
  name?: string;
  mustChangePassword?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** Access token — in-memory only, never stored in localStorage or cookies. */
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ mustChangePassword?: boolean }>;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  isRole: (...roles: AuthUser['role'][]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Silent refresh helper ──────────────────────────────────────────────────
  // Called by tokenStore (axios interceptor) when a 401 is received.
  const silentRefresh = useCallback(async (): Promise<string | null> => {
    try {
      // POST /auth/refresh — no body; gateway reads the HttpOnly refresh cookie.
      const res = await authApi.refresh();
      const { accessToken, user: u } = res.data;
      tokenStore.set(accessToken);
      setToken(accessToken);
      if (u) setUser(u);
      // Refresh the middleware cookie so the 8-hour window resets on every silent refresh.
      if (typeof document !== 'undefined') {
        document.cookie = `techmo_token=1; path=/; max-age=${60 * 60 * 8}; SameSite=Lax`;
      }
      return accessToken;
    } catch {
      // Refresh cookie expired or invalid — clear session and redirect to login.
      tokenStore.set(null);
      setToken(null);
      setUser(null);
      localStorage.removeItem('techmo_user');
      if (typeof document !== 'undefined') {
        document.cookie = 'techmo_token=; path=/; max-age=0';
      }
      // Don't redirect if already on the login page — avoids a reload loop.
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return null;
    }
  }, []);

  // ── Rehydrate session on mount ─────────────────────────────────────────────
  // Non-sensitive user profile is still cached in localStorage for
  // instant skeleton rendering; the actual JWT stays in memory only.
  useEffect(() => {
    // Register the silent refresh so the axios interceptor can call it.
    tokenStore.setRefreshFn(silentRefresh);

    const storedUser = localStorage.getItem('techmo_user');
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch { /* ignore */ }
      // Only attempt a silent refresh when a prior session exists.
      // Skipping this when not logged in prevents a spurious 401 on every page load.
      silentRefresh().finally(() => setIsLoading(false));
    } else {
      // No prior session — skip the network call and mark loading done.
      setIsLoading(false);
    }
  }, [silentRefresh]);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (username: string, password: string): Promise<{ mustChangePassword?: boolean }> => {
    let res: Awaited<ReturnType<typeof authApi.login>>;
    try {
      res = await authApi.login(username, password);
    } catch (err) {
      // Normalise raw AxiosError → plain Error so nothing verbose ends up in
      // the browser console and callers only deal with err.message.
      const { message } = parseApiError(err);
      throw new Error(message);
    }
    // Gateway sets HttpOnly techmo_refresh cookie in the Set-Cookie header.
    // We store only the short-lived access token in memory.
    const { accessToken, user: u } = res.data;
    tokenStore.set(accessToken);
    setToken(accessToken);
    setUser(u);
    // Non-sensitive profile cached in localStorage for instant skeleton paint.
    localStorage.setItem('techmo_user', JSON.stringify(u));
    // Set the middleware presence cookie (edge middleware checks for its existence).
    // The actual security is the in-memory access token + HttpOnly refresh cookie.
    document.cookie = `techmo_token=1; path=/; max-age=${60 * 60 * 8}; SameSite=Lax`;
    return { mustChangePassword: u?.mustChangePassword };
  }, []);

  // ── Update user ────────────────────────────────────────────────────────────
  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem('techmo_user', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    authApi.logout().catch(() => {});
    tokenStore.set(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem('techmo_user');
    document.cookie = 'techmo_token=; path=/; max-age=0';
  }, []);

  const isRole = useCallback(
    (...roles: AuthUser['role'][]) => !!user && roles.includes(user.role),
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser, isRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
