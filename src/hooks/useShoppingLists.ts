import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ShoppingList } from "@/types/shopping";

const SHOPPING_LISTS_QUERY_KEY = ["shopping-lists", "all"] as const;

async function fetchShoppingLists(): Promise<ShoppingList[]> {
  const response = await fetch("/api/shopping-lists", { cache: "no-store" });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error ?? "Failed to load shopping lists");
  }

  const payload = (await response.json()) as { data?: { shoppingLists?: ShoppingList[] } };
  return payload.data?.shoppingLists ?? [];
}

async function postShoppingList(input: { name: string; description?: string }): Promise<ShoppingList> {
  const response = await fetch("/api/shopping-lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: input.name, description: input.description }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error ?? "Failed to create shopping list");
  }

  const payload = (await response.json()) as { data?: { shoppingList?: ShoppingList } };
  return payload.data?.shoppingList as ShoppingList;
}

export function useShoppingLists() {
  return useQuery({
    queryKey: SHOPPING_LISTS_QUERY_KEY,
    queryFn: fetchShoppingLists,
  });
}

export function useCreateShoppingList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postShoppingList,
    onSuccess: (createdList) => {
      queryClient.setQueryData<ShoppingList[] | undefined>(SHOPPING_LISTS_QUERY_KEY, (existing) => {
        if (!existing) {
          return [createdList];
        }
        return [createdList, ...existing];
      });
      queryClient.invalidateQueries({ queryKey: SHOPPING_LISTS_QUERY_KEY });
    },
  });
}

export function useOptimisticShoppingLists() {
  const queryClient = useQueryClient();

  const addOptimisticList = (list: ShoppingList) => {
    queryClient.setQueryData<ShoppingList[] | undefined>(SHOPPING_LISTS_QUERY_KEY, (existing) => {
      if (!existing) {
        return [list];
      }
      return [list, ...existing];
    });
  };

  const removeOptimisticList = (id: string) => {
    queryClient.setQueryData<ShoppingList[] | undefined>(SHOPPING_LISTS_QUERY_KEY, (existing) => {
      if (!existing) {
        return existing;
      }
      return existing.filter((list) => list.id !== id);
    });
  };

  return { addOptimisticList, removeOptimisticList };
}
