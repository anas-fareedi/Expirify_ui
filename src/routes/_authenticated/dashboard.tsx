import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock, PackageSearch, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useItems } from "@/hooks/use-items";
import { daysLeft, statusOf, timelineLabel, type Product, type Status } from "@/lib/expiry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Expiry Dashboard — Expirify Inventory Timeline" },
      {
        name: "description",
        content:
          "See every scanned product with 7, 3 and 1 day expiry alerts, purchase dates and shelf-life progress in one dashboard.",
      },
      { property: "og:title", content: "Expiry Dashboard — Expirify" },
      {
        property: "og:description",
        content: "Track scanned products and get alerted before anything expires.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const filters = [
  { key: "all", label: "All" },
  { key: "critical", label: "≤ 1 day" },
  { key: "soon", label: "≤ 3 days" },
  { key: "watch", label: "≤ 7 days" },
  { key: "expired", label: "Expired" },
] as const;

const statusStyles: Record<Status, string> = {
  expired: "bg-destructive/15 text-destructive border-destructive/40",
  critical: "bg-destructive/15 text-destructive border-destructive/40",
  soon: "bg-warning/15 text-warning border-warning/40",
  watch: "bg-warning/10 text-warning border-warning/30",
  fresh: "bg-success/15 text-success border-success/40",
};

function Dashboard() {
  const { items, ready, removeItem } = useItems();
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...items].sort((a, b) => daysLeft(a.expiryDate) - daysLeft(b.expiryDate)),
    [items],
  );

  const counts = useMemo(() => {
    const c = { expired: 0, critical: 0, soon: 0, watch: 0, fresh: 0 } as Record<Status, number>;
    items.forEach((i) => (c[statusOf(i.expiryDate)] += 1));
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((item) => {
      const d = daysLeft(item.expiryDate);
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (filter === "all") return true;
      if (filter === "expired") return d < 0;
      if (filter === "critical") return d >= 0 && d <= 1;
      if (filter === "soon") return d >= 0 && d <= 3;
      return d >= 0 && d <= 7;
    });
  }, [sorted, query, filter]);

  const alerts = useMemo(() => sorted.filter((i) => daysLeft(i.expiryDate) <= 7), [sorted]);


  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Expiry dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} tracked item{items.length === 1 ? "" : "s"} · alerts at 7, 3 and 1 day
          </p>
        </div>
        <Button asChild>
          <Link to="/scan">
            <Plus className="mr-2 h-4 w-4" /> Scan a product
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Expired" value={counts.expired} tone="destructive" icon={AlertTriangle} />
        <StatCard label="1 day left" value={counts.critical} tone="destructive" icon={Clock} />
        <StatCard label="3 days left" value={counts.soon} tone="warning" icon={Bell} />
        <StatCard label="Safe" value={counts.fresh} tone="success" icon={CheckCircle2} />
      </div>

      {alerts.length > 0 && (
        <section className="surface-card mt-6 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </h2>
          <ul className="mt-4 space-y-3">
            {alerts.slice(0, 5).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{item.name}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs",
                    statusStyles[statusOf(item.expiryDate)],
                  )}
                >
                  {timelineLabel(item.expiryDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
              filter === f.key
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            {f.label}
          </button>
        ))}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products"
          className="ml-auto w-full max-w-56"
        />
      </div>

      <div className="mt-5 space-y-3">
        {ready && visible.length === 0 && (
          <div className="surface-card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <PackageSearch className="h-10 w-10 text-primary" />
            <h3 className="text-lg font-semibold">Nothing here yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Scan a barcode, QR code or printed label to store a product name, purchase date and
              expiry date.
            </p>
            <Button asChild variant="secondary">
              <Link to="/scan">Start scanning</Link>
            </Button>
          </div>
        )}

        {visible.map((item) => (
          <ItemRow key={item.id} item={item} onRemove={() => removeItem(item.id)} />
        ))}
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "destructive" | "warning" | "success";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneClass = {
    destructive: "text-destructive bg-destructive/15",
    warning: "text-warning bg-warning/15",
    success: "text-success bg-success/15",
  }[tone];

  return (
    <div className="surface-card flex items-center gap-4 p-5">
      <span className={cn("grid h-10 w-10 place-items-center rounded-lg", toneClass)}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ItemRow({ item, onRemove }: { item: Product; onRemove: () => void }) {
  const status = statusOf(item.expiryDate);
  const total = Math.max(
    1,
    Math.round(
      (new Date(item.expiryDate).getTime() - new Date(item.purchaseDate).getTime()) / 86_400_000,
    ),
  );
  const left = Math.max(0, daysLeft(item.expiryDate));
  const pct = Math.min(100, Math.round((left / total) * 100));

  return (
    <article className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-semibold">{item.name}</h3>
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs", statusStyles[status])}>
            {timelineLabel(item.expiryDate)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Purchased {item.purchaseDate} · Expires {item.expiryDate}
          {item.barcode ? ` · Code ${item.barcode}` : ""}
          {item.category ? ` · ${item.category}` : ""}
        </p>
        <Progress value={pct} className="mt-3 h-1.5" />
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${item.name}`}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </article>
  );
}
