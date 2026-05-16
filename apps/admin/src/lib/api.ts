import axios from 'axios';
import { tokenStore } from './token-store';

// Default gateway is the `gateway` service in docker-compose (port 3000).
const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${GATEWAY}/api/v1`,
  timeout: 15000,
  // Required so the browser sends the HttpOnly refresh-token cookie
  // and the CSRF cookie cross-origin (admin domain → gateway domain).
  withCredentials: true,
});

// ── Request: attach in-memory access token ────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: silent token refresh on 401 ────────────────────────────────────
// Single in-flight refresh promise shared across all concurrent 401 failures.
let _refreshingPromise: Promise<string | null> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // ⚠️  Never retry the refresh endpoint itself — that would cause an
    // infinite loop where each 401 on /auth/refresh spawns another refresh.
    // ⚠️  Also skip /auth/login — a 401 there means bad credentials, not an
    // expired session, so we must not redirect to /login (causing a page refresh).
    const isRefreshCall = (original?.url as string | undefined)?.includes('/auth/refresh');
    const isLoginCall = (original?.url as string | undefined)?.includes('/auth/login');

    if (error.response?.status === 401 && !original._retry && !isRefreshCall && !isLoginCall) {
      original._retry = true;

      // Deduplicate: if a refresh is already in-flight, wait for it.
      if (!_refreshingPromise) {
        _refreshingPromise = tokenStore.refresh().finally(() => {
          _refreshingPromise = null;
        });
      }

      const newToken = await _refreshingPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Refresh cookie expired / invalid — redirect to login once.
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Error normaliser ───────────────────────────────────────────────────────
/**
 * Extract a human-readable message and HTTP status from anything thrown by
 * an axios call.  Returns a plain object so callers never touch AxiosError
 * internals — prevents raw error objects from leaking into the console.
 */
export function parseApiError(err: unknown): { status: number; message: string } {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 0;
    const raw = err.response?.data;
    const message =
      typeof raw?.message === 'string'
        ? raw.message
        : typeof raw === 'string'
        ? raw
        : err.message ?? 'An unexpected error occurred';
    return { status, message };
  }
  return {
    status: 0,
    message: err instanceof Error ? err.message : 'An unexpected error occurred',
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  /** Reads the HttpOnly techmo_refresh cookie — no body needed. */
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const productsApi = {
  list: (params?: Record<string, any>) => api.get('/products', { params }),
  get: (id: string) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  searchBySku: (sku: string) => api.get(`/products/sku/${sku}`),
  /** Look up a product by its printed barcode value (EAN-13, Code 128, QR, etc.) */
  getByBarcode: (barcode: string) => api.get(`/products/barcode/${encodeURIComponent(barcode)}`),
  categories: () => api.get('/products/categories'),
  uploadImage: (file: File, options?: { onProgress?: (pct: number) => void; signal?: AbortSignal }) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/products/upload-image', fd, {
      timeout: 0,
      signal: options?.signal,
      onUploadProgress: (e) => {
        if (options?.onProgress && e.total) {
          options.onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },
};

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventoryApi = {
  list: (params?: Record<string, any>) => api.get('/inventory', { params }),
  get: (id: string) => api.get(`/inventory/${id}`),
  create: (data: any) => api.post('/inventory', data),
  update: (id: string, data: any) => api.patch(`/inventory/${id}`, data),
  adjustStock: (id: string, data: { quantity: number; movementType: string; reference?: string; notes?: string }) =>
    api.post(`/inventory/${id}/adjust`, {
      quantityDelta: data.quantity,
      movementType: data.movementType,
      reason: data.notes || data.movementType,
      reference: data.reference,
      performedBy: 'admin',
    }),
  movements: (params?: Record<string, any>) => api.get('/stock-movements', { params }),
  movementsByInventory: (inventoryId: string, params?: Record<string, any>) => api.get(`/stock-movements/by-inventory/${inventoryId}`, { params }),
  getBySku: (sku: string) => api.get(`/inventory/sku/${sku}`),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (params?: Record<string, any>) => api.get('/orders', { params }),
  get: (id: string) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  complete: (id: string) => api.post(`/orders/${id}/complete`),
  void: (id: string, reason: string, voidedBy = '') => api.post(`/orders/${id}/void`, { reason, voidedBy, managerPinHash: '' }),
  summary: (params: { from: string; to: string }) => api.get('/orders/summary', { params }),
};

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const invoicesApi = {
  getByOrder: (orderId: string) => api.get(`/invoices/by-order/${orderId}`),
  /** Call the worker service to generate an invoice PDF, returns { filename, url } */
  generatePdf: (data: {
    invoice_no: string;
    customer_name: string;
    cashier_name: string;
    date: string;
    subtotal: number;
    discount: number;
    total: number;
    items: Array<{
      product_name: string;
      sku: string;
      imei?: string | null;
      quantity: number;
      unit_price: number;
      discount_amt: number;
      line_total: number;
    }>;
  }) => api.post('/worker/pdf/invoice', data),
};

// ─── Worker Service (PDFs + AI) ───────────────────────────────────────────────
export const workerApi = {
  /** Repair receipt PDF — shows ticket info before customer signs off */
  repairReceiptPdf: (data: {
    ticket_number: string;
    customer_name: string;
    customer_phone: string;
    device: string;
    issue: string;
    status: string;
    estimated_cost: number;
    qr_token: string;
  }) => api.post('/worker/pdf/repair-receipt', data),

  /** Signed repair receipt PDF — generated after customer signs and device is handed back */
  signedReceiptPdf: (data: {
    ticket_number: string;
    customer_name: string;
    customer_phone: string;
    device: string;
    issue: string;
    final_cost: number;
    technician_notes: string;
    signature_data_url: string;
    after_photos?: string[];
    completed_at: string;
  }) => api.post('/worker/pdf/signed-repair-receipt', data),

  /** Emergency POS sheet — cashier reference for offline cash sales */
  emergencySheet: (data: {
    cashier_name: string;
    date: string;
    products: Array<{ name: string; sku: string; price: number; stock: number }>;
  }) => api.post('/worker/pdf/emergency-sheet', data),

  /** Status sticker — small QR sticker for device shelf / storage */
  statusSticker: (data: {
    ticket_number: string;
    device: string;
    status: string;
    tracking_url: string;
    qr_token: string;
  }) => api.post('/worker/pdf/status-sticker', data),

  /** Daily pulse report PDF — end-of-day management summary */
  dailyPulsePdf: (data: {
    date: string;
    branch: string;
    generated_by: string;
    total_sales: number;
    total_transactions: number;
    total_repairs_completed: number;
    battery_alerts: number;
    top_products: Array<{ name: string; qty_sold: number; revenue: number }>;
  }) => api.post('/worker/pdf/daily-pulse', data),

  // ── AI / Ollama ─────────────────────────────────────────────────────────────

  /** Check if the local Ollama LLM is online */
  aiStatus: () => api.get('/worker/ai/status'),

  /** Analyse repair note sentiment — returns { sentiment, confidence, summary, flags } */
  aiRepairSentiment: (data: { technician_notes: string; customer_complaint: string }) =>
    api.post('/worker/ai/repair-sentiment', data, { timeout: 120_000 }),

  /** Get AI repair advice — returns { likely_causes, recommended_parts, estimated_difficulty, notes } */
  aiRepairAdvice: (data: { device_model: string; reported_fault: string }) =>
    api.post('/worker/ai/repair-advice', data, { timeout: 120_000 }),

  /** Summarise audit log entries — returns { jobId, status } then poll aiJobStatus */
  aiSummariseAuditLogs: (entries: string[]) =>
    api.post('/worker/ai/summarise-audit-logs', { entries }, { timeout: 15_000 }),

  /** Poll for an async AI job result — returns { status: 'pending'|'done'|'failed', result? } */
  aiJobStatus: (jobId: string) => api.get(`/worker/ai/job/${jobId}`, { timeout: 10_000 }),
};

// ─── Repairs ──────────────────────────────────────────────────────────────────
export const repairsApi = {
  list: (params?: Record<string, any>) => api.get('/repairs', { params }),
  get: (id: string) => api.get(`/repairs/${id}`),
  create: (data: any) => api.post('/repairs', data),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/repairs/${id}/status`, { status, notes }),
  addParts: (id: string, parts: any[]) => api.post(`/repairs/${id}/parts`, { parts }),
  update: (id: string, data: any) => api.patch(`/repairs/${id}`, data),
  // Photos
  uploadPhoto: (id: string, formData: FormData) =>
    api.post(`/repairs/${id}/photos`, formData, { timeout: 60000 }),
  updatePhoto: (id: string, photoId: string, formData: FormData) =>
    api.patch(`/repairs/${id}/photos/${photoId}`, formData, { timeout: 60000 }),
  getPhotos: (id: string) => api.get(`/repairs/${id}/photos`),
  // Signature-based completion
  completeWithSignature: (id: string, data: { signatureDataUrl: string; notes?: string }) =>
    api.post(`/repairs/${id}/complete-signed`, data),
  // QR status sticker PDF
  generateSticker: (id: string) => api.post(`/repairs/${id}/sticker`),
  // Review link
  getReviewLink: (id: string) => api.get(`/repairs/${id}/review-link`),
  // Analytics
  getFailureRate: (days = 90) => api.get('/repairs/analytics/failure-rate', { params: { days } }),
  // Courier tracking
  saveCourierInfo: (id: string, data: { trackingNumber: string; carrier: string }) =>
    api.patch(`/repairs/${id}/courier-info`, data),
  getCourierTracking: (id: string, trackingNumber?: string, carrier?: string) =>
    api.get(`/repairs/${id}/courier-tracking`, { params: { trackingNumber, carrier } }),
};

// ─── Insights ─────────────────────────────────────────────────────────────────
export const insightsApi = {
  summary: () => api.get('/orders/insights/summary'),
};

// ─── Reservations ─────────────────────────────────────────────────────────────
export const reservationsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/orders/reservations', { params }),
  create: (data: {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    staffId: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
    expiresInHours?: number;
  }) => api.post('/orders/reservations', data),
  cancel: (id: string) => api.delete(`/orders/reservations/${id}`),
  convertToOrder: (id: string, orderId: string) =>
    api.post(`/orders/reservations/${id}/convert`, { orderId }),
};

// ─── POS Utilities ────────────────────────────────────────────────────────────
export const posApi = {
  smartDefaults: (cashierId: string) =>
    api.get('/orders/pos/smart-defaults', { params: { cashierId } }),
  validateRules: (data: {
    items: { productId: string; quantity: number; unitPrice: number; originalPrice: number }[];
    totalAmount: number;
  }) => api.post('/orders/pos/validate-rules', data),
  emergencySheet: (data: {
    cashierName: string;
    sheetNumber: string;
    products: { name: string; sku: string; price: number; stock: number }[];
  }) =>
    api.post(
      `${process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8000'}/api/v1/worker/pdf/emergency-sheet`,
      data,
    ),
};

// ─── Consent ──────────────────────────────────────────────────────────────────
export const consentApi = {
  getForCustomer: (customerId: string) => api.get(`/orders/consents/${customerId}`),
  record: (data: {
    customerId: string;
    type: string;
    granted: boolean;
    ipAddress?: string;
    userAgent?: string;
  }) => api.post('/orders/consents', data),
};

// ─── Customers / Loyalty ──────────────────────────────────────────────────────
export const customersApi = {
  list: (params?: Record<string, any>) => api.get('/customers', { params }),
  get: (id: string) => api.get(`/customers/${id}`),
  create: (data: any) => api.post('/customers', data),
  update: (id: string, data: any) => api.patch(`/customers/${id}`, data),
  getByPhone: (phone: string) => api.get(`/customers/by-phone/${phone}`),
  transactions: (id: string, params?: any) => api.get(`/customers/${id}/transactions`, { params }),
  earnPoints: (data: { customerId: string; points: number; type?: string; reference?: string }) =>
    api.post('/customers/loyalty/earn', {
      customerId: data.customerId,
      points: data.points,
      type: data.type ?? 'PURCHASE_EARN',
      reference: data.reference ?? 'MANUAL',
    }),
  redeemPoints: (data: { customerId: string; points: number; reference?: string }) =>
    api.post('/customers/loyalty/redeem', {
      customerId: data.customerId,
      points: data.points,
      reference: data.reference ?? 'MANUAL',
    }),
  adjustPoints: (data: { customerId: string; adjustment: number; reason: string }) =>
    api.post('/customers/loyalty/adjust', { customerId: data.customerId, points: data.adjustment, reason: data.reason }),
  delete: (id: string) => api.delete(`/customers/${id}`),
};

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const reviewsApi = {
  adminList: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/reviews/admin', { params }),
  moderate: (id: string, data: { status: 'APPROVED' | 'REJECTED'; adminNote?: string; featured?: boolean }) =>
    api.patch(`/reviews/${id}/moderate`, data),
  toggleFeatured: (id: string) => api.patch(`/reviews/${id}/feature`, {}),
  delete: (id: string) => api.delete(`/reviews/${id}`),
  stats: () => api.get('/reviews/stats'),
};

// ─── Warranty ─────────────────────────────────────────────────────────────────
export const warrantyApi = {
  /** Check warranty eligibility by IMEI/serial — backend: GET /warranty/check?imei= */
  validate: (imeiOrSerial: string) =>
    api.get('/warranty/check', { params: { imei: imeiOrSerial } }),
  /** File a warranty claim — backend expects { imei, issue, claimType } */
  claim: (data: { imeiOrSerial: string; issueDescription: string; claimType: string }) =>
    api.post('/warranty/claims', { imei: data.imeiOrSerial, issue: data.issueDescription, claimType: data.claimType }),
  listClaims: (params?: Record<string, any>) => api.get('/warranty/claims', { params }),
  getClaim: (id: string) => api.get(`/warranty/claims/${id}`),
  updateClaim: (id: string, data: any) => api.patch(`/warranty/claims/${id}`, data),
};

// ─── IMEI / Serial ────────────────────────────────────────────────────────────
export const imeiApi = {
  lookup: (imei: string) => api.get(`/imei/${encodeURIComponent(imei)}`),
  register: (data: { imei: string; productId: string; orderId?: string; serialNumber?: string }) =>
    api.post('/imei', data),
  list: (params?: Record<string, any>) => api.get('/imei', { params }),
  /** Get all registered devices for a specific product (from backend GET /imei/product/:productId) */
  getByProduct: (productId: string) => api.get(`/imei/product/${encodeURIComponent(productId)}`),
  /** Backend has no DELETE — to retire a device, update its status instead */
  updateStatus: (imei: string, status: 'SOLD' | 'RETURNED' | 'SCRAPPED') =>
    api.patch(`/imei/${imei}/status`, { status }),
  /** Bulk-register multiple IMEI / serial numbers for one product at once */
  bulkRegister: (data: { productId: string; numbers: string[]; mode: 'imei' | 'serial' }) =>
    api.post('/imei/bulk', data),
};

// ─── Compatibility ────────────────────────────────────────────────────────────
export const compatibilityApi = {
  check: (partProductId: string, deviceModelId: string) =>
    api.get('/compatibility/check', { params: { productId: partProductId, deviceModelId } }),
  listByProduct: (productId: string) => api.get(`/compatibility/product/${productId}`),
  /** Backend uses /compatibility/device/:deviceModelId (not /model/) */
  listByModel: (deviceModelId: string) => api.get(`/compatibility/device/${deviceModelId}`),
  /** Backend AddCompatibilityDto takes a single { productId, deviceModelId } — loop on caller side for multiple */
  create: (data: { productId: string; deviceModelId: string; notes?: string }) =>
    api.post('/compatibility', data),
  /** Backend @Delete(':id') takes the compatibility record ID */
  remove: (compatibilityRecordId: string) =>
    api.delete(`/compatibility/${compatibilityRecordId}`),
};

// ─── Device Models ────────────────────────────────────────────────────────────
export const deviceModelsApi = {
  list: (params?: Record<string, any>) => api.get('/device-models', { params }),
  get: (id: string) => api.get(`/device-models/${id}`),
  create: (data: any) => api.post('/device-models', data),
  update: (id: string, data: any) => api.patch(`/device-models/${id}`, data),
  delete: (id: string) => api.delete(`/device-models/${id}`),
};

// ─── Pricing / Promotions ─────────────────────────────────────────────────────
export const pricingApi = {
  listRules: (params?: Record<string, any>) => api.get('/pricing/rules', { params }),
  createRule: (data: any) => api.post('/pricing/rules', data),
  updateRule: (id: string, data: any) => api.patch(`/pricing/rules/${id}`, data),
  deleteRule: (id: string) => api.delete(`/pricing/rules/${id}`),
  /** Calculate final price with rules — backend: GET /pricing/calculate?productId=&qty= */
  evaluate: (productId: string, quantity?: number) =>
    api.get('/pricing/calculate', { params: { productId, qty: quantity ?? 1 } }),
  /** Validate manager PIN server-side */
  validatePin: (pin: string) => api.post('/pricing/validate-pin', { pin }),
};

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settingsApi = {
  // Manager PIN (product-service)
  getManagerPin: () => api.get('/pricing/settings/manager-pin'),
  setManagerPin: (pin: string) => api.put('/pricing/settings/manager-pin', { pin }),

  // SMTP
  getSmtp: () => api.get('/admin/settings/smtp'),
  saveSmtp: (data: {
    host: string; port: string; user: string; from: string; alertEmail: string; secure: boolean;
  }) => api.put('/admin/settings/smtp', data),

  // Business info
  getBusiness: () => api.get('/admin/settings/business'),
  saveBusiness: (data: {
    name: string; tagline: string; phone: string; email: string; address: string;
    city: string; country: string; regNumber: string; vatNumber: string; logo: string;
    currency: string; timezone: string; dateFormat: string;
  }) => api.put('/admin/settings/business', data),

  // Notification toggles
  getNotifications: () => api.get('/admin/settings/notifications'),
  saveNotifications: (data: {
    lowStockThreshold: string; sendLowStockAlert: boolean; sendRepairUpdates: boolean;
    sendInvoiceEmail: boolean; dailyReportEmail: string; adminAlertEmail: string;
  }) => api.put('/admin/settings/notifications', data),

  // Kiosk config
  getKiosk: () => api.get('/admin/settings/kiosk'),
  saveKiosk: (data: { exitPin: string; idleSeconds: number }) =>
    api.put('/admin/settings/kiosk', data),

  // Cache & export
  clearCache: () => api.post('/admin/cache/clear'),
  exportData: () => api.get('/admin/export'),
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: Record<string, any>) => api.get('/audit-logs', { params }),
  get: (id: string) => api.get(`/audit-logs/${id}`),
};

// ─── Mailer (via gateway) ─────────────────────────────────────────────────────
export const mailerApi = {
  sendInvoiceEmail: (data: { to: string; customerName: string; invoiceNo: string; pdfUrl: string }) =>
    api.post('/mailer/invoice', data),
  sendRepairStatus: (data: { to: string; customerName: string; ticketNo: string; status: string; trackUrl: string }) =>
    api.post('/mailer/repair-status', data),
  sendLowStockAlert: (data: { to: string; productName: string; sku: string; qty: number }) =>
    api.post('/mailer/low-stock-alert', data),
};

// ─── Employees / HR ───────────────────────────────────────────────────────────
export const employeesApi = {
  list: (params?: Record<string, any>) => api.get('/employees', { params }),
  get: (id: string) => api.get(`/employees/${id}`),
  getByUserId: (userId: string) => api.get(`/employees/by-user/${userId}`),
  create: (data: any) => api.post('/employees', data),
  update: (id: string, data: any) => api.patch(`/employees/${id}`, data),
  delete: (id: string) => api.delete(`/employees/${id}`),
  clockIn: (employeeId: string) => api.post('/employees/attendance/clock-in', { employeeId }),
  clockOut: (attendanceId: string) => api.patch(`/employees/attendance/${attendanceId}/clock-out`),
  /** Clock out using employee ID — finds today's open attendance record automatically */
  clockOutByEmployee: (employeeId: string) => api.patch(`/employees/attendance/employee/${employeeId}/clock-out`),
  attendance: (employeeId: string, params?: any) =>
    api.get(`/employees/attendance/${employeeId}`, { params }),
  shifts: (employeeId: string) => api.get(`/shifts/employee/${employeeId}`),
  createShift: (data: any) => api.post('/shifts', data),
  calculatePayroll: (data: { employeeId: string; year: number; month: number }) =>
    api.post('/employees/payroll/calculate', data),
  updatePayroll: (id: string, data: { commissionEarned?: number; deductions?: number }) =>
    api.patch(`/employees/payroll/${id}`, data),
  listPayroll: (params?: any) => api.get('/employees/payroll', { params }),
  approvePayroll: (id: string) => api.patch(`/employees/payroll/${id}/approve`),
  markPaid: (id: string) => api.patch(`/employees/payroll/${id}/mark-paid`),
};

// ─── Shifts ───────────────────────────────────────────────────────────────────
export const shiftsApi = {
  list: (params?: Record<string, any>) => api.get('/shifts', { params }),
  get: (id: string) => api.get(`/shifts/${id}`),
  create: (data: any) => api.post('/shifts', data),
  delete: (id: string) => api.delete(`/shifts/${id}`),
  getByEmployee: (employeeId: string, params?: any) =>
    api.get(`/shifts/employee/${employeeId}`, { params }),
};

// ─── Inventory Transfers ──────────────────────────────────────────────────────
export const transfersApi = {
  list: (params?: { status?: string; branchId?: string }) =>
    api.get('/inventory/transfers', { params }),
  stats: (branchId?: string) =>
    api.get('/inventory/transfers/stats', { params: branchId ? { branchId } : undefined }),
  get: (id: string) => api.get(`/inventory/transfers/${id}`),
  create: (data: {
    fromBranchId: string;
    toBranchId: string;
    productId: string;
    productName: string;
    qty: number;
    requestedBy: string;
    notes?: string;
  }) => api.post('/inventory/transfers', data),
  approve: (id: string, managerId: string) =>
    api.patch(`/inventory/transfers/${id}/approve`, { managerId }),
  reject: (id: string, managerId: string, reason?: string) =>
    api.patch(`/inventory/transfers/${id}/reject`, { managerId, reason }),
  markInTransit: (id: string) => api.patch(`/inventory/transfers/${id}/transit`),
  complete: (id: string, receivedBy: string) =>
    api.patch(`/inventory/transfers/${id}/complete`, { receivedBy }),
  cancel: (id: string, requestorId: string) =>
    api.delete(`/inventory/transfers/${id}`, { data: { requestorId } }),
};

// ─── System — SUPER_ADMIN user management ────────────────────────────────────
export const systemApi = {
  listUsers: () => api.get('/admin/users'),
  getUser: (id: string) => api.get(`/admin/users/${id}`),
  createUser: (data: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    roleName: string;
  }) => api.post('/admin/users', data),
  assignRole: (id: string, roleName: string) =>
    api.put(`/admin/users/${id}/role`, { roleName }),
  activateUser: (id: string) => api.patch(`/admin/users/${id}/activate`),
  deactivateUser: (id: string) => api.patch(`/admin/users/${id}/deactivate`),
  resetPassword: (id: string, newPassword: string) =>
    api.patch(`/admin/users/${id}/reset-password`, { newPassword }),
  // Lockdown
  lockdownStatus: () => api.get('/admin/lockdown/status'),
  activateLockdown: (reason?: string) => api.post('/admin/lockdown/activate', { reason }),
  deactivateLockdown: () => api.post('/admin/lockdown/deactivate'),
};

/**
 * Returns a Record<userId, displayName> by fetching all staff users.
 * Components can call this with useQuery and pass the result here:
 *   const { data: userMap } = useQuery({ queryKey: ['users-map'], queryFn: fetchUserMap })
 */
export async function fetchUserMap(): Promise<Record<string, string>> {
  try {
    const res = await systemApi.listUsers();
    const users: any[] = res.data ?? [];
    const map: Record<string, string> = {};
    users.forEach((u: any) => {
      map[u.id] = u.fullName || u.username || u.id;
    });
    return map;
  } catch {
    return {};
  }
}
