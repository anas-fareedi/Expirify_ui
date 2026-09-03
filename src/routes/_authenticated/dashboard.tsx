import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock, PackageSearch, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ListSwitcher } from "@/components/ListSwitcher";
import { ActivityLog, TrashPanel } from "@/components/ItemHistory";
import { useItems, useLegacyMigration } from "@/hooks/use-items";
import { useActiveList, useCreateList } from "@/hooks/use-lists";
import {
  daysLeft,
  shelfLifePercent,
  statusOf,
  timelineLabel,
  type Item,
  type Status,
} from "@/lib/expiry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CountUp, MotionCard, Reveal } from "@/components/motion";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Expiry Dashboard — Expirify Shared Inventory Timeline" },
      {
        name: "description",
        content:
          "See every scanned product in your shared list with exact days left, purchase dates and shelf-life progress in one live dashboard.",
      },
      { property: "og:title", content: "Expiry Dashboard — Expirify" },
      {
        property: "og:description",
        content: "Track shared products and get alerted before anything expires.",
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
  const { lists, activeList, select, isLoading: listsLoading } = useActiveList();
  const createList = useCreateList();
  const { items, deletedItems, ready, removeItem, restoreItem, purgeItem } = useItems(activeList?.id);
  useLegacyMigration(activeList?.id);

  const handleRemove = async (item: Item) => {
    await removeItem(item.id);
    toast.success(`${item.name} deleted`, {
      description: "It stays in Recently deleted until you remove it for good.",
      duration: 10000,
      action: {
        label: "Undo",
        onClick: () => {
          restoreItem(item.id).then(() => toast.success(`${item.name} restored`));
        },
      },
    });
  };



  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...items].sort((a, b) => daysLeft(a.expiry_date) - daysLeft(b.expiry_date)),
    [items],
  );

  const counts = useMemo(() => {
    const c = { expired: 0, critical: 0, soon: 0, watch: 0, fresh: 0 } as Record<Status, number>;
    items.forEach((i) => (c[statusOf(i.expiry_date)] += 1));
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((item) => {
      const d = daysLeft(item.expiry_date);
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (filter === "all") return true;
      if (filter === "expired") return d < 0;
      if (filter === "critical") return d >= 0 && d <= 1;
      if (filter === "soon") return d >= 0 && d <= 3;
      return d >= 0 && d <= 7;
    });
  }, [sorted, query, filter]);

  const alerts = useMemo(() => sorted.filter((i) => daysLeft(i.expiry_date) <= 7), [sorted]);

  if (!listsLoading && lists.length === 0) {
    return (
      <AppShell>
        <div className="surface-card animate-rise mx-auto mt-10 max-w-md space-y-4 p-8 text-center">
          <PackageSearch className="mx-auto h-10 w-10 text-primary" />
          <h1 className="text-xl font-semibold">Create your first list</h1>
          <p className="text-sm text-muted-foreground">
            Lists hold your scanned products. Share one with family or roommates so everyone gets
            the same expiry alerts.
          </p>
          <Button
            className="w-full"
            disabled={createList.isPending}
            onClick={async () => {
              const list = await createList.mutateAsync("Home");
              select(list.id);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Create “Home”
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link to="/lists">Join a list with a code</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="animate-rise mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Expiry dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeList ? `${activeList.name} · ` : ""}
            {items.length} tracked item{items.length === 1 ? "" : "s"} · exact days left, live for
            every member
          </p>
        </div>
        <Button asChild>
          <Link to="/scan">
            <Plus className="mr-2 h-4 w-4" /> Scan a product
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <ListSwitcher lists={lists} activeList={activeList} onSelect={select} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Expired" value={counts.expired} tone="destructive" icon={AlertTriangle} delay={0} />
        <StatCard label="1 day left" value={counts.critical} tone="destructive" icon={Clock} delay={90} />
        <StatCard label="Within 3 days" value={counts.soon} tone="warning" icon={Bell} delay={180} />
        <StatCard label="Safe" value={counts.fresh} tone="success" icon={CheckCircle2} delay={270} />
      </div>

      {alerts.length > 0 && (
        <section className="surface-card animate-rise mt-6 p-5" style={{ animationDelay: "340ms" }}>
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
                    statusStyles[statusOf(item.expiry_date)],
                  )}
                >
                  {timelineLabel(item.expiry_date)}
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
              "rounded-full border px-3.5 py-1.5 text-xs transition-all duration-300 hover:scale-105",
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

        {visible.map((item, i) => (
          <ItemRow
            key={item.id}
            item={item}
            delay={Math.min(i, 8) * 60}
            onRemove={() => handleRemove(item)}
          />
        ))}
      </div>

      <TrashPanel items={deletedItems} onRestore={restoreItem} onPurge={purgeItem} />
      <ActivityLog listId={activeList?.id} />
    </AppShell>

  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: number;
  tone: "destructive" | "warning" | "success";
  icon: React.ComponentType<{ className?: string }>;
  delay?: number;
}) {
  const toneClass = {
    destructive: "text-destructive bg-destructive/15",
    warning: "text-warning bg-warning/15",
    success: "text-success bg-success/15",
  }[tone];

  return (
    <Reveal delay={delay}>
      <MotionCard className="surface-card group flex items-center gap-4 p-5">
        <span
          className={cn(
            "grid h-10 w-10 place-items-center rounded-lg transition-transform duration-500 group-hover:rotate-[8deg] group-hover:scale-110",
            toneClass,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-2xl font-semibold">
            <CountUp value={value} />
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </MotionCard>
    </Reveal>
  );
}

function ItemRow({
  item,
  onRemove,
  delay = 0,
}: {
  item: Item;
  onRemove: () => void;
  delay?: number;
}) {
  const status = statusOf(item.expiry_date);
  const pct = shelfLifePercent(item.purchase_date, item.expiry_date);
  const urgent = status === "critical" || status === "expired";

  return (
    <Reveal delay={delay} as="article">
      <MotionCard
        strength={0.4}
        className={cn(
          "surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center",
          urgent && "flow-border",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{item.name}</h3>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-transform duration-300",
                statusStyles[status],
                urgent && "animate-pulse-ring",
              )}
            >
              {timelineLabel(item.expiry_date)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Purchased {item.purchase_date} · Expires {item.expiry_date}
            {item.barcode ? ` · Code ${item.barcode}` : ""}
            {item.category ? ` · ${item.category}` : ""}
          </p>
          <Progress value={pct} className="mt-3 h-1.5 transition-all duration-700" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="transition-transform duration-300 hover:scale-110 hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remove ${item.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </MotionCard>
    </Reveal>
  );
}
