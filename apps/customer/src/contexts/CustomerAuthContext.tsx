'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { customerAuthApi } from '@/lib/api';
import { customerTokenStore } from '@/lib/token-store';

interface CustomerUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tier: 'STANDARD' | 'PREMIUM';
  loyaltyPoints: number;
  address?: string;
  mustChangePassword?: boolean;
}

interface CustomerAuthContextType {
  customer: CustomerUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setCustomer: (c: CustomerUser | null) => void;
  updateCustomer: (updates: Partial<CustomerUser>) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomerState] = useState<CustomerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setCustomer = (c: CustomerUser | null) => {
    setCustomerState(c);
    // Only cache non-sensitive profile data for instant skeleton rendering.
    // Tokens are NEVER stored here.
    if (c) {
      localStorage.setItem('techmo_customer', JSON.stringify(c));
    } else {
      localStorage.removeItem('techmo_customer');
    }
  };

  const updateCustomer = (updates: Partial<CustomerUser>) => {
    setCustomerState(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem('techmo_customer', JSON.stringify(next));
      return next;
    });
  };

  // ── Silent refresh helper ──────────────────────────────────────────────────
  const silentRefresh = useCallback(async (): Promise<string | null> => {
    try {
      // POST /auth/customer/refresh — no body; gateway reads the HttpOnly cookie.
      const res = await customerAuthApi.refresh();
      const { token, accessToken, customer: c } = res.data;
      const tok = token ?? accessToken;
      customerTokenStore.set(tok);
      if (c) {
        setCustomerState(c);
        localStorage.setItem('techmo_customer', JSON.stringify(c));
      }
      return tok;
    } catch {
      customerTokenStore.set(null);
      setCustomerState(null);
      localStorage.removeItem('techmo_customer');
      return null;
    }
  }, []);

  const logout = useCallback(() => {
    customerAuthApi.logout().catch(() => {});
    customerTokenStore.set(null);
    setCustomerState(null);
    localStorage.removeItem('techmo_customer');
    window.location.href = '/login';
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await customerAuthApi.me();
      setCustomer(res.data);
    } catch { /* Token expired — interceptor handles redirect */ }
  }, []);

  // ── Rehydrate session on mount ─────────────────────────────────────────────
  useEffect(() => {
    customerTokenStore.setRefreshFn(silentRefresh);

    // Show cached profile immediately while refresh is in-flight.
    const stored = localStorage.getItem('techmo_customer');
    if (stored) {
      try { setCustomerState(JSON.parse(stored)); } catch { /* ignore */ }
      // Only attempt a silent refresh when a prior session exists.
      // Skipping this when not logged in prevents a spurious 401 on every page load.
      silentRefresh().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [silentRefresh]);

  return (
    <CustomerAuthContext.Provider value={{
      customer, isLoading, isAuthenticated: !!customer,
      setCustomer, updateCustomer, logout, refreshProfile,
    }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
