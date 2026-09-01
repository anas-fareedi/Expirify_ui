import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, LogOut, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MotionCard, Reveal } from "@/components/motion";
import {
  useActiveList,
  useCreateList,
  useCurrentUserId,
  useJoinList,
  useLeaveList,
  useMembers,
} from "@/hooks/use-lists";

export const Route = createFileRoute("/_authenticated/lists")({
  head: () => ({
    meta: [
      { title: "Shared Lists — Expirify Family & Roommate Expiry Alerts" },
      {
        name: "description",
        content:
          "Create named Expirify lists like Home or Office, invite family or roommates with a join code, and everyone gets the same expiry alerts on their own device.",
      },
      { property: "og:title", content: "Shared Lists — Expirify" },
      {
        property: "og:description",
        content: "Share an expiry list with family or roommates using a join code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListsPage,
});

function ListsPage() {
  const userId = useCurrentUserId();
  const { lists, activeList, select } = useActiveList();
  const createList = useCreateList();
  const joinList = useJoinList();
  const leaveList = useLeaveList();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [openMembers, setOpenMembers] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) {
      toast.error("Give the list a name");
      return;
    }

    try {
      const list = await createList.mutateAsync(name.trim());
      select(list.id);
      setName("");
      toast.success(`${list.name} created`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the list");
    }
  };

  const join = async () => {
    if (!code.trim()) {
      toast.error("Enter a join code");
      return;
    }

    try {
      const id = await joinList.mutateAsync(code);
      select(id);
      setCode("");
      toast.success("You joined the list");
    } catch {
      toast.error("That join code doesn't match any list");
    }
  };

  return (
    <AppShell>
      <div className="animate-rise mb-8">
        <h1 className="text-2xl font-semibold sm:text-3xl">Shared lists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a list per space, then share its join code so everyone sees the same items and
          alerts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Reveal>
          <MotionCard className="surface-card space-y-3 p-5">
            <Label htmlFor="listName">New list</Label>
            <div className="flex gap-2">
              <Input
                id="listName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Home, Office, Store shelf"
              />
              <Button onClick={create} disabled={createList.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </MotionCard>
        </Reveal>
        <Reveal delay={100}>
          <MotionCard className="surface-card space-y-3 p-5">
            <Label htmlFor="joinCode">Join with a code</Label>
            <div className="flex gap-2">
              <Input
                id="joinCode"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="AB12CD"
                maxLength={6}
              />
              <Button variant="secondary" onClick={join} disabled={joinList.isPending}>
                Join
              </Button>
            </div>
          </MotionCard>
        </Reveal>
      </div>

      <div className="mt-6 space-y-3">
        {lists.length === 0 && (
          <div className="surface-card px-6 py-12 text-center text-sm text-muted-foreground">
            You don't have any lists yet — create your first one above.
          </div>
        )}
        {lists.map((list, i) => (
          <Reveal key={list.id} delay={Math.min(i, 6) * 60} as="article">
            <MotionCard
              strength={0.4}
              className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold">{list.name}</h3>
                  {activeList?.id === list.id && (
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
                      Active
                    </span>
                  )}
                  {list.owner_id === userId && (
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                      Owner
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(list.join_code);
                    toast.success("Join code copied");
                  }}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 font-mono text-xs tracking-widest transition hover:border-primary/50 hover:text-primary"
                >
                  <Copy className="h-3.5 w-3.5" /> {list.join_code}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenMembers(openMembers === list.id ? null : list.id)}
                >
                  <Users className="mr-2 h-4 w-4" /> Members
                </Button>
                {activeList?.id !== list.id && (
                  <Button variant="secondary" size="sm" onClick={() => select(list.id)}>
                    Use
                  </Button>
                )}
                {list.owner_id !== userId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Leave ${list.name}`}
                    onClick={async () => {
                      await leaveList.mutateAsync(list.id);
                      toast.success(`Left ${list.name}`);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {openMembers === list.id && <MemberList listId={list.id} />}
            </MotionCard>
          </Reveal>
        ))}
      </div>
    </AppShell>
  );
}

function MemberList({ listId }: { listId: string }) {
  const { data: members, isLoading } = useMembers(listId);
  return (
    <ul className="w-full space-y-2 border-t border-border/60 pt-3 text-sm sm:w-auto">
      {isLoading && <li className="text-muted-foreground">Loading members…</li>}
      {members?.map((m) => (
        <li key={m.user_id} className="flex items-center justify-between gap-4">
          <span className="truncate">{m.display_name || m.email || "Member"}</span>
          <span className="text-xs text-muted-foreground">{m.role}</span>
        </li>
      ))}
    </ul>
  );
}
