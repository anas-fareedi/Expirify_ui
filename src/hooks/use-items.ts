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

export function useItems(listId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["items", listId],
    enabled: !!listId,
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("items")
        .select("id, list_id, created_by, name, barcode, category, purchase_date, expiry_date, created_at")
        .eq("list_id", listId!)
        .order("expiry_date", { ascending: true });
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
        () => queryClient.invalidateQueries({ queryKey: ["items", listId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items", listId] }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items", listId] }),
  });

  return {
    items: query.data ?? [],
    ready: !!listId && !query.isLoading,
    isLoading: query.isLoading,
    addItem: (item: NewItem) => addItem.mutateAsync(item),
    removeItem: (id: string) => removeItem.mutateAsync(id),
  };
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
