import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import type { List } from "@/hooks/use-lists";
import { cn } from "@/lib/utils";

export function ListSwitcher({
  lists,
  activeList,
  onSelect,
}: {
  lists: List[];
  activeList: List | null;
  onSelect: (id: string) => void;
}) {
  if (lists.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {lists.map((list) => (
        <button
          key={list.id}
          onClick={() => onSelect(list.id)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs transition-all duration-300 hover:scale-105",
            activeList?.id === list.id
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:bg-secondary",
          )}
        >
          {list.name}
        </button>
      ))}
      <Link
        to="/lists"
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-primary"
      >
        <Users className="h-3.5 w-3.5" /> Manage & share
      </Link>
    </div>
  );
}
