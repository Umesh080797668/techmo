/**
 * Offline POS Queue — backed by IndexedDB via Dexie.js.
 *
 * When the network is unavailable, POS transactions are queued here.
 * On reconnect, the queue drains automatically (useOfflineQueue hook).
 *
 * Install: `npm install dexie`  (in apps/admin)
 */
import Dexie, { type Table } from 'dexie';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OfflineOrderPayload {
  cashierId: string;
  customerId?: string;
  redeemPoints?: number;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER';
  notes?: string;
  items: Array<{
    inventoryId: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    imeiNumber?: string;
  }>;
  /** Calculated totals stored for receipt display */
  totals: { subtotal: number; tax: number; total: number };
  cashTendered?: number;
}

export interface QueuedOrder {
  id?: number;                    // Dexie auto-increment key
  localRef: string;               // client-generated e.g. "OFFLINE-1718295600000"
  payload: OfflineOrderPayload;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  failReason?: string;
  createdAt: number;              // epoch ms
  syncedAt?: number;
  remoteOrderId?: string;         // assigned after successful sync
}

// ─── Dexie DB ─────────────────────────────────────────────────────────────────

class OfflineQueueDb extends Dexie {
  orders!: Table<QueuedOrder, number>;

  constructor() {
    super('TechMoOfflineQueue');
    this.version(1).stores({
      orders: '++id, localRef, status, createdAt',
    });
  }
}

export const offlineDb = new OfflineQueueDb();

// ─── Queue helpers ────────────────────────────────────────────────────────────

export async function enqueueOrder(payload: OfflineOrderPayload): Promise<string> {
  const localRef = `OFFLINE-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  await offlineDb.orders.add({
    localRef,
    payload,
    status: 'pending',
    createdAt: Date.now(),
  });
  return localRef;
}

export async function getPendingOrders(): Promise<QueuedOrder[]> {
  return offlineDb.orders.where('status').anyOf(['pending', 'failed']).toArray();
}

export async function getAllQueuedOrders(): Promise<QueuedOrder[]> {
  return offlineDb.orders.orderBy('createdAt').reverse().toArray();
}

export async function markSyncing(id: number) {
  await offlineDb.orders.update(id, { status: 'syncing' });
}

export async function markSynced(id: number, remoteOrderId: string) {
  await offlineDb.orders.update(id, { status: 'synced', remoteOrderId, syncedAt: Date.now() });
}

export async function markFailed(id: number, reason: string) {
  await offlineDb.orders.update(id, { status: 'failed', failReason: reason });
}

export async function clearSyncedOrders() {
  await offlineDb.orders.where('status').equals('synced').delete();
}

export function pendingCount(): Promise<number> {
  return offlineDb.orders.where('status').anyOf(['pending', 'failed']).count();
}
