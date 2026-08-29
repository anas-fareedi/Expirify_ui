export type Product = {
  id: string;
  name: string;
  barcode?: string;
  batch?: string;
  purchaseDate: string; // yyyy-mm-dd
  expiryDate: string; // yyyy-mm-dd
  category?: string;
  notes?: string;
  createdAt: string;
};

export const STORAGE_KEY = "expirify.items.v1";

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

export const statusLabel: Record<Status, string> = {
  expired: "Expired",
  critical: "1 day left",
  soon: "3 days left",
  watch: "7 days left",
  fresh: "Fresh",
};

export function timelineLabel(expiryDate: string): string {
  const d = daysLeft(expiryDate);
  if (d < 0) return `Expired ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ago`;
  if (d === 0) return "Expires today";
  if (d === 1) return "1 day left";
  return `${d} days left`;
}

export function loadItems(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Product[]) : [];
  } catch {
    return [];
  }
}

export function saveItems(items: Product[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
