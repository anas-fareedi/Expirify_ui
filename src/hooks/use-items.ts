import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearLegacyItems,
  legacyMigrationDone,
  loadLegacyItems,
  type Item,
} from "@/lib/expiry";

export type NewItem = {
  name: string;
  barcode?: string;
  category?: string;
  purchaseDate: string;
  expiryDate: string;
};

export type ItemEvent = {
  id: string;
  item_id: string;
  action: "created" | "updated" | "deleted" | "restored" | "purged";
  item_name: string | null;
  actor_id: string | null;
  changes: Record<string, [unknown, unknown]>;
  created_at: string;
};

const ITEM_COLUMNS =
  "id, list_id, created_by, name, barcode, category, purchase_date, expiry_date, created_at, updated_at, updated_by, deleted_at, deleted_by";

export function useItems(listId: string | undefined) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["items", listId] });
    queryClient.invalidateQueries({ queryKey: ["deleted-items", listId] });
    queryClient.invalidateQueries({ queryKey: ["item-events", listId] });
  };

  const query = useQuery({
    queryKey: ["items", listId],
    enabled: !!listId,
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("items")
        .select(ITEM_COLUMNS)
        .eq("list_id", listId!)
        .is("deleted_at", null)
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const deletedQuery = useQuery({
    queryKey: ["deleted-items", listId],
    enabled: !!listId,
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("items")
        .select(ITEM_COLUMNS)
        .eq("list_id", listId!)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  // Live updates so every member's device stays in sync.
  useEffect(() => {
    if (!listId) return;
    const channel = supabase
      .channel(`items-${listId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `list_id=eq.${listId}` },
        () => invalidate(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, queryClient]);

  const addItem = useMutation({
    mutationFn: async (item: NewItem) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId || !listId) throw new Error("No list selected");
      const { error } = await supabase.from("items").insert({
        list_id: listId,
        created_by: userId,
        name: item.name,
        barcode: item.barcode?.trim() || null,
        category: item.category?.trim() || null,
        purchase_date: item.purchaseDate,
        expiry_date: item.expiryDate,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Soft delete: the row stays recoverable until it is purged. */
  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;
      const { error } = await supabase
        .from("items")
        .update({ deleted_at: new Date().toISOString(), deleted_by: userId, updated_by: userId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const restoreItem = useMutation({
    mutationFn: async (id: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;
      const { error } = await supabase
        .from("items")
        .update({ deleted_at: null, deleted_by: null, updated_by: userId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const purgeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    items: query.data ?? [],
    deletedItems: deletedQuery.data ?? [],
    ready: !!listId && !query.isLoading,
    isLoading: query.isLoading,
    addItem: (item: NewItem) => addItem.mutateAsync(item),
    removeItem: (id: string) => removeItem.mutateAsync(id),
    restoreItem: (id: string) => restoreItem.mutateAsync(id),
    purgeItem: (id: string) => purgeItem.mutateAsync(id),
  };
}

/** Audit trail: who created, edited, deleted or restored each item, and when. */
export function useItemEvents(listId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ["item-events", listId, limit],
    enabled: !!listId,
    queryFn: async (): Promise<ItemEvent[]> => {
      const { data, error } = await supabase
        .from("item_events")
        .select("id, item_id, action, item_name, actor_id, changes, created_at")
        .eq("list_id", listId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as ItemEvent[];
    },
  });
}

/** One-time move of items saved in this browser before the shared lists existed. */
export function useLegacyMigration(listId: string | undefined) {
  const queryClient = useQueryClient();
  const done = useRef(false);

  useEffect(() => {
    if (!listId || done.current || legacyMigrationDone()) return;
    const legacy = loadLegacyItems();
    if (legacy.length === 0) {
      clearLegacyItems();
      return;
    }
    done.current = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      const rows = legacy
        .filter((l) => l.name && l.expiryDate)
        .map((l) => ({
          list_id: listId,
          created_by: userId,
          name: l.name,
          barcode: l.barcode || null,
          category: l.category || null,
          purchase_date: l.purchaseDate || new Date().toISOString().slice(0, 10),
          expiry_date: l.expiryDate,
        }));
      const { error } = await supabase.from("items").insert(rows);
      if (!error) {
        clearLegacyItems();
        queryClient.invalidateQueries({ queryKey: ["items", listId] });
      }
    })();
  }, [listId, queryClient]);
}
