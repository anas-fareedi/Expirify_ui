export type Item = {
  id: string;
  list_id: string;
  created_by: string;
  name: string;
  barcode: string | null;
  category: string | null;
  purchase_date: string; // yyyy-mm-dd (real date column)
  expiry_date: string; // yyyy-mm-dd (real date column)
  created_at: string;
  updated_at?: string;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

/** Milliseconds a deleted item stays recoverable in the undo window. */
export const UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;


/** Legacy shape used by the pre-database localStorage store (migrated once). */
export type LegacyProduct = {
  id: string;
  name: string;
  barcode?: string;
  purchaseDate: string;
  expiryDate: string;
  category?: string;
  createdAt: string;
};

export const STORAGE_KEY = "expirify.items.v1";
export const MIGRATED_KEY = "expirify.migrated.v1";
export const ACTIVE_LIST_KEY = "expirify.activeList.v1";

/** Whole days between today (local midnight) and the expiry date. */
export function daysLeft(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expiryDate + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export type Status = "expired" | "critical" | "soon" | "watch" | "fresh";

export function statusOf(expiryDate: string): Status {
  const d = daysLeft(expiryDate);
  if (d < 0) return "expired";
  if (d <= 1) return "critical";
  if (d <= 3) return "soon";
  if (d <= 7) return "watch";
  return "fresh";
}

/** Real, date-derived label — never a fixed bucket string. */
export function timelineLabel(expiryDate: string): string {
  const d = daysLeft(expiryDate);
  if (d < 0) {
    const n = Math.abs(d);
    return `Expired ${n} day${n === 1 ? "" : "s"} ago`;
  }
  if (d === 0) return "Expires today";
  if (d === 1) return "1 day left";
  return `${d} days left`;
}

export function statusLabel(expiryDate: string): string {
  return timelineLabel(expiryDate);
}

export function shelfLifePercent(purchaseDate: string, expiryDate: string): number {
  const total = Math.max(
    1,
    Math.round(
      (new Date(expiryDate + "T00:00:00").getTime() -
        new Date(purchaseDate + "T00:00:00").getTime()) /
        86_400_000,
    ),
  );
  const left = Math.max(0, daysLeft(expiryDate));
  return Math.min(100, Math.round((left / total) * 100));
}

export function loadLegacyItems(): LegacyProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LegacyProduct[]) : [];
  } catch {
    return [];
  }
}

export function clearLegacyItems() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.setItem(MIGRATED_KEY, "1");
}

export function legacyMigrationDone(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MIGRATED_KEY) === "1";
}
