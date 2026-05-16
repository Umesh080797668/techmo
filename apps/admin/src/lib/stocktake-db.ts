/**
 * stocktake-db.ts
 * ---------------
 * Dexie.js (IndexedDB) schema for the Offline-First Stocktake Mode.
 * Staff walk a warehouse with zero Wi-Fi, scan items into the local DB,
 * then trigger a bulk sync when connectivity is restored.
 */

import Dexie, { Table } from 'dexie';

export type StocktakeScanStatus = 'pending' | 'synced' | 'conflict' | 'error';

export interface StocktakeScan {
  id?: number;               // auto-incremented local ID
  sessionId: string;         // UUID for the current stocktake session
  sku: string;               // scanned barcode / QR value
  barcodeFormat: string;     // e.g. 'ean_13', 'qr_code'
  countedQty: number;        // how many units staff physically counted
  binLocation?: string;      // optional shelf / bin tag
  notes?: string;
  scannedAt: Date;
  status: StocktakeScanStatus;
  serverQty?: number;        // filled in after sync (from PostgreSQL)
  variance?: number;         // countedQty - serverQty
  syncedAt?: Date;
}

export interface StocktakeSession {
  id: string;                // UUID (generated client-side)
  branchId: string;
  staffId: string;
  startedAt: Date;
  endedAt?: Date;
  totalScans: number;
  syncedAt?: Date;
  status: 'in-progress' | 'completed' | 'synced';
}

export class StocktakeDB extends Dexie {
  scans!: Table<StocktakeScan, number>;
  sessions!: Table<StocktakeSession, string>;

  constructor() {
    super('techmoStocktake');

    this.version(1).stores({
      scans:    '++id, sessionId, sku, status, scannedAt',
      sessions: 'id, branchId, staffId, status, startedAt',
    });
  }
}

export const stocktakeDB = new StocktakeDB();

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function addScan(
  scan: Omit<StocktakeScan, 'id' | 'status' | 'scannedAt'>,
): Promise<number> {
  return stocktakeDB.scans.add({
    ...scan,
    status: 'pending',
    scannedAt: new Date(),
  });
}

export async function getPendingScans(sessionId: string): Promise<StocktakeScan[]> {
  return stocktakeDB.scans
    .where({ sessionId, status: 'pending' })
    .toArray();
}

export async function bulkSyncSession(
  sessionId: string,
  apiPost: (body: unknown) => Promise<{ results: Array<{ localId: number; serverQty: number; variance: number; status: StocktakeScanStatus }> }>,
): Promise<{ synced: number; conflicts: number; errors: number }> {
  const pending = await getPendingScans(sessionId);
  if (!pending.length) return { synced: 0, conflicts: 0, errors: 0 };

  const payload = pending.map(s => ({
    localId:   s.id,
    sku:       s.sku,
    countedQty: s.countedQty,
    binLocation: s.binLocation,
    notes:     s.notes,
    scannedAt: s.scannedAt,
  }));

  const { results } = await apiPost({ sessionId, scans: payload });

  let synced = 0, conflicts = 0, errors = 0;
  for (const r of results) {
    await stocktakeDB.scans.update(r.localId, {
      status:    r.status,
      serverQty: r.serverQty,
      variance:  r.variance,
      syncedAt:  new Date(),
    });
    if (r.status === 'synced')   synced++;
    if (r.status === 'conflict') conflicts++;
    if (r.status === 'error')    errors++;
  }

  await stocktakeDB.sessions.update(sessionId, {
    syncedAt: new Date(),
    status:   'synced',
  });

  return { synced, conflicts, errors };
}
