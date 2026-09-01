import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ACTIVE_LIST_KEY } from "@/lib/expiry";

export type List = {
  id: string;
  name: string;
  owner_id: string;
  join_code: string;
  created_at: string;
};

export type Member = {
  user_id: string;
  role: "owner" | "member";
  display_name: string | null;
  email: string | null;
};

async function fetchUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function useCurrentUserId() {
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchUserId });
  return data ?? null;
}

export function useLists() {
  return useQuery({
    queryKey: ["lists"],
    queryFn: async (): Promise<List[]> => {
      const { data, error } = await supabase
        .from("lists")
        .select("id, name, owner_id, join_code, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Selected list, persisted per device; falls back to the first available list. */
export function useActiveList() {
  const { data: lists, isLoading } = useLists();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActiveId(window.localStorage.getItem(ACTIVE_LIST_KEY));
  }, []);

  const select = useCallback((id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_LIST_KEY, id);
  }, []);

  const resolved =
    lists?.find((l) => l.id === activeId) ?? lists?.[0] ?? null;

  return { lists: lists ?? [], activeList: resolved, select, isLoading };
}

export function useCreateList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const userId = await fetchUserId();
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("lists")
        .insert({ name, owner_id: userId })
        .select("id, name, owner_id, join_code, created_at")
        .single();
      if (error) throw error;
      return data as List;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lists"] }),
  });
}

export function useJoinList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("join_list_by_code", {
        _code: code.trim().toUpperCase(),
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}

export function useMembers(listId: string | undefined) {
  return useQuery({
    queryKey: ["members", listId],
    enabled: !!listId,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("list_members")
        .select("user_id, role")
        .eq("list_id", listId!);
      if (error) throw error;
      const ids = (data ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids);
      return (data ?? []).map((m) => {
        const p = profiles?.find((x) => x.id === m.user_id);
        return {
          user_id: m.user_id,
          role: m.role as Member["role"],
          display_name: p?.display_name ?? null,
          email: p?.email ?? null,
        };
      });
    },
  });
}

export function useLeaveList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (listId: string) => {
      const userId = await fetchUserId();
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("list_members")
        .delete()
        .eq("list_id", listId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
