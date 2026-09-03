import { History, RotateCcw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion";
import { useItemEvents, type ItemEvent } from "@/hooks/use-items";
import { useMembers } from "@/hooks/use-lists";
import type { Item } from "@/lib/expiry";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

const actionLabel: Record<ItemEvent["action"], string> = {
  created: "added",
  updated: "edited",
  deleted: "moved to trash",
  restored: "restored",
  purged: "deleted permanently",
};

const actionTone: Record<ItemEvent["action"], string> = {
  created: "bg-success/15 text-success border-success/40",
  updated: "bg-primary/15 text-primary border-primary/40",
  deleted: "bg-warning/15 text-warning border-warning/40",
  restored: "bg-success/15 text-success border-success/40",
  purged: "bg-destructive/15 text-destructive border-destructive/40",
};

/** Soft-deleted items that can still be brought back. */
export function TrashPanel({
  items,
  onRestore,
  onPurge,
}: {
  items: Item[];
  onRestore: (id: string) => Promise<void>;
  onPurge: (id: string) => Promise<void>;
}) {
  if (items.length === 0) return null;

  return (
    <Reveal delay={60} as="section">
      <div className="surface-card mt-6 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Trash2 className="h-4 w-4 text-warning" /> Recently deleted ({items.length})
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Deleted products stay here so nothing is lost by accident. Restore them any time.
        </p>
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  Deleted {item.deleted_at ? relativeTime(item.deleted_at) : ""} · expired/expires{" "}
                  {item.expiry_date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await onRestore(item.id);
                    toast.success(`${item.name} restored`);
                  }}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    await onPurge(item.id);
                    toast.success(`${item.name} deleted permanently`);
                  }}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" /> Delete forever
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

/** Audit trail for the active list. */
export function ActivityLog({ listId }: { listId: string | undefined }) {
  const { data: events } = useItemEvents(listId, 40);
  const { data: members } = useMembers(listId);

  const nameFor = (actorId: string | null) => {
    if (!actorId) return "System";
    const m = members?.find((x) => x.user_id === actorId);
    return m?.display_name || m?.email || "A member";
  };

  return (
    <Reveal delay={120} as="section">
      <div className="surface-card mt-6 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <History className="h-4 w-4 text-primary" /> Activity &amp; audit trail
        </h2>
        {!events || events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Every add, edit, delete and restore in this list will appear here with the exact time and
            the member who did it.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${actionTone[e.action]}`}
                >
                  {actionLabel[e.action]}
                </span>
                <span className="truncate font-medium">{e.item_name ?? "Item"}</span>
                <span className="text-xs text-muted-foreground">
                  by {nameFor(e.actor_id)} · {relativeTime(e.created_at)}
                </span>
                {e.action === "updated" && Object.keys(e.changes ?? {}).length > 0 && (
                  <span className="w-full text-xs text-muted-foreground">
                    {Object.entries(e.changes).map(([field, pair]) => (
                      <span key={field} className="mr-3">
                        {field.replace(/_/g, " ")}: {String(pair?.[0] ?? "—")} →{" "}
                        {String(pair?.[1] ?? "—")}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Reveal>
  );
}
