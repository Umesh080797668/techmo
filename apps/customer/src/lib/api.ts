import axios, { AxiosError } from 'axios';
import { customerTokenStore } from './token-store';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${GATEWAY}/api/v1`,
  timeout: 15000,
  // Required so the browser includes the HttpOnly techmo_customer_refresh
  // cookie on every request to the gateway.
  withCredentials: true,
});

// ── Request: attach in-memory access token ────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = customerTokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: silent token refresh on 401 ────────────────────────────────────
let _refreshingPromise: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as any;

    // Never retry the refresh endpoint itself — prevents an infinite 401 loop.
    const isRefreshCall = (original?.url as string | undefined)?.includes('/auth/customer/refresh');

    if (err.response?.status === 401 && !original._retry && !isRefreshCall) {
      original._retry = true;

      if (!_refreshingPromise) {
        _refreshingPromise = customerTokenStore.refresh().finally(() => {
          _refreshingPromise = null;
        });
      }

      const newToken = await _refreshingPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Don't redirect if we're already on a public/auth page
      // (e.g. wrong password returns 401 on /login — should stay on page)
      if (typeof window !== 'undefined') {
        const authPages = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
        const onAuthPage = authPages.some(p => window.location.pathname.startsWith(p));
        if (!onAuthPage) window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ─── Customer Auth ────────────────────────────────────────────────────────────
export const customerAuthApi = {
  // ── Phone OTP ──────────────────────────────────────────────────────────────
  /** Request OTP sent to phone */
  requestOtp: (phone: string) =>
    api.post('/auth/customer/otp/request', { phone }),
  /** Verify phone OTP → JWT */
  verifyOtp: (phone: string, otp: string) =>
    api.post('/auth/customer/otp/verify', { phone, otp }),

  // ── Email / Password ───────────────────────────────────────────────────────
  /** Register new customer (phone required, email required) */
  register: (data: {
    name: string;
    phone: string;
    email: string;
    password: string;
    address?: string;
  }) => api.post('/auth/customer/register', data),

  /** Login with email + password */
  loginEmail: (email: string, password: string) =>
    api.post('/auth/customer/login', { email, password }),

  // ── Email Verification ─────────────────────────────────────────────────────
  /** Request email OTP for email address verification */
  requestEmailOtp: (email: string) =>
    api.post('/auth/customer/email/otp/request', { email }),
  /** Verify email OTP */
  verifyEmailOtp: (email: string, otp: string) =>
    api.post('/auth/customer/email/otp/verify', { email, otp }),

  // ── Password Reset ─────────────────────────────────────────────────────────
  /** Request password-reset link/token sent to email */
  forgotPassword: (email: string) =>
    api.post('/auth/customer/forgot-password', { email }),
  /** Reset password using OTP received by email */
  resetPassword: (email: string, otp: string, password: string) =>
    api.post('/auth/customer/reset-password', { email, otp, password }),

  // ── Shared ─────────────────────────────────────────────────────────────────
  /** Silent refresh — reads HttpOnly techmo_customer_refresh cookie */
  refresh: () => api.post('/auth/customer/refresh'),
  /** Get current customer profile from token */
  me: () => api.get('/auth/customer/me'),
  logout: () => api.post('/auth/customer/logout'),  /** Change password (used on force-change-password screen) */
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/customer/change-password', { currentPassword, newPassword }),};

// ─── Customer Profile ─────────────────────────────────────────────────────────
export const customerApi = {
  me: () => api.get('/customers/me'),
  update: (data: { name?: string; email?: string; address?: string }) =>
    api.patch('/customers/me', data),
};

// ─── Loyalty / Points ─────────────────────────────────────────────────────────
export const loyaltyApi = {
  transactions: (params?: { page?: number; limit?: number; type?: string }) =>
    api.get('/customers/me/loyalty/transactions', { params }),
  summary: () => api.get('/customers/me/loyalty/summary'),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const myOrdersApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/customers/me/orders', { params }),
  get: (id: string) => api.get(`/customers/me/orders/${id}`),
};

// ─── Repairs ──────────────────────────────────────────────────────────────────
export const myRepairsApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/customers/me/repairs', { params }),
  get: (id: string) => api.get(`/customers/me/repairs/${id}`),
  trackByToken: (token: string) =>
    api.get(`/repairs/track/${encodeURIComponent(token)}`),
  getPhotos: (repairId: string) =>
    api.get(`/repairs/${repairId}/photos`),
};

// ─── Consent ──────────────────────────────────────────────────────────────────
export const myConsentApi = {
  /** Get all consents for the current customer */
  getAll: (customerId: string) => api.get(`/orders/consents/${customerId}`),
  /** Record a consent preference */
  record: (data: {
    customerId: string;
    type: 'MARKETING_SMS' | 'MARKETING_EMAIL' | 'MARKETING_WHATSAPP' | 'DATA_ANALYTICS' | 'THIRD_PARTY_SHARING';
    granted: boolean;
  }) =>
    api.post('/orders/consents', {
      ...data,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    }),
};

// ─── Warranty ─────────────────────────────────────────────────────────────────
export const myWarrantyApi = {
  list: () => api.get('/customers/me/warranty'),
  validate: (imeiOrSerial: string) =>
    api.get(`/warranty/validate/${encodeURIComponent(imeiOrSerial)}`),
  claims: (params?: Record<string, any>) =>
    api.get('/customers/me/warranty/claims', { params }),
  submitClaim: (data: { imeiOrSerial: string; issueDescription: string; claimType: string }) =>
    api.post('/warranty/claims', data),
};

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const myReviewsApi = {
  submit: (data: {
    rating: number;
    title?: string;
    body: string;
    photoUrl?: string;
    type?: 'GENERAL' | 'PRODUCT' | 'REPAIR';
    referenceId?: string;
  }) => api.post('/reviews', data),
  mine: () => api.get('/reviews/mine'),
  deleteOwn: (id: string) => api.delete(`/reviews/mine/${id}`),
  publicList: (params?: { page?: number; limit?: number }) =>
    api.get('/reviews', { params }),
};

// ─── Products (public — no auth needed) ───────────────────────────────────────
export const publicProductsApi = {
  list: (params?: Record<string, any>) => api.get('/products', { params }),
  get: (id: string) => api.get(`/products/${id}`),
};
