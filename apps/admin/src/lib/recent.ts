/**
 * Recently Viewed — per-staff localStorage tracker.
 * Tracks recently viewed products, customers, and repair tickets.
 */

export type RecentItemType = 'product' | 'customer' | 'repair';

export interface RecentItem {
  type: RecentItemType;
  id: string;
  label: string;        // Display name / ticket number / SKU
  sublabel?: string;    // secondary info (phone, model, etc.)
  href: string;         // navigation target
  viewedAt: number;     // epoch ms
}

const MAX_ITEMS = 20;
const STORAGE_PREFIX = 'techmo_recent_';

function storageKey(staffId: string): string {
  return `${STORAGE_PREFIX}${staffId}`;
}

export function pushRecentItem(staffId: string, item: Omit<RecentItem, 'viewedAt'>) {
  if (typeof window === 'undefined' || !staffId) return;

  const key = storageKey(staffId);
  const existing: RecentItem[] = getRecentItems(staffId);

  // Remove if already present (dedup by id + type)
  const filtered = existing.filter(e => !(e.id === item.id && e.type === item.type));

  // Prepend new item
  const updated: RecentItem[] = [
    { ...item, viewedAt: Date.now() },
    ...filtered,
  ].slice(0, MAX_ITEMS);

  localStorage.setItem(key, JSON.stringify(updated));
}

export function getRecentItems(staffId: string): RecentItem[] {
  if (typeof window === 'undefined' || !staffId) return [];
  try {
    const raw = localStorage.getItem(storageKey(staffId));
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

export function getRecentByType(staffId: string, type: RecentItemType, limit = 5): RecentItem[] {
  return getRecentItems(staffId)
    .filter(i => i.type === type)
    .slice(0, limit);
}

export function clearRecentItems(staffId: string) {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(storageKey(staffId));
  }
}
