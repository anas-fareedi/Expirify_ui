import { useCallback, useEffect, useState } from "react";
import { loadItems, saveItems, type Product } from "@/lib/expiry";

export function useItems() {
  const [items, setItems] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(loadItems());
    setReady(true);
  }, []);

  const persist = useCallback((next: Product[]) => {
    setItems(next);
    saveItems(next);
  }, []);

  const addItem = useCallback(
    (item: Omit<Product, "id" | "createdAt">) => {
      const next = [
        ...loadItems(),
        { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ];
      persist(next);
    },
    [persist],
  );

  const removeItem = useCallback(
    (id: string) => persist(loadItems().filter((i) => i.id !== id)),
    [persist],
  );

  return { items, ready, addItem, removeItem };
}
