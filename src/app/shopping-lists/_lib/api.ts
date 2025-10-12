import { cookies } from "next/headers";

import { logger } from "@/lib/logging/logger";
import type { SidebarList, ShoppingListDetail, ShoppingListItem } from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.APP_URL ??
  "http://127.0.0.1:3000";

export async function listAll(): Promise<SidebarList[]> {
  const response = await fetchFromApp(`/api/shopping-lists`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to list shopping lists: ${response.status}`);
  }

  const json = await response.json();
  const lists = json.data?.shoppingLists ?? json.shoppingLists ?? [];

  return lists.map((list: Record<string, unknown>) => ({
    id: String(list.id),
    title: String(list.name ?? list.title ?? "Untitled"),
    itemCount: Number(list.total_items ?? 0),
    updatedAt: String(list.updated_at ?? list.created_at ?? new Date().toISOString()),
  }));
}

export async function getList({ id }: { id: string }): Promise<ShoppingListDetail> {
  const [listRes, itemsRes] = await Promise.all([
    fetchFromApp(`/api/shopping-lists/${id}`, { cache: "no-store" }),
    fetchFromApp(`/api/shopping-lists/${id}/items`, { cache: "no-store" }),
  ]);

  if (!listRes.ok) {
    throw new Error(`Failed to fetch list meta (${listRes.status})`);
  }
  if (!itemsRes.ok) {
    throw new Error(`Failed to fetch list items (${itemsRes.status})`);
  }

  const listJson = await listRes.json();
  const itemsJson = await itemsRes.json();

  const list = listJson.data?.list ?? listJson.list;
  if (!list) {
    throw new Error("Shopping list not found");
  }

  const items = (itemsJson.data?.items ?? itemsJson.items ?? []) as Array<Record<string, unknown>>;

  return {
    id: String(list.id),
    title: String(list.name ?? list.title ?? "Untitled"),
    notes: typeof list.notes === "string" ? list.notes : list.description ? String(list.description) : null,
    updatedAt: String(list.updated_at ?? list.created_at ?? new Date().toISOString()),
    items: items.map((item) => mapApiItem(item)),
  };
}

export async function createList({ title }: { title: string }): Promise<{ id: string }> {
  const response = await fetchFromApp(`/api/shopping-lists`, {
    method: "POST",
    body: JSON.stringify({ name: title }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Failed to create list");
  }

  const json = await response.json();
  return { id: json.data?.shoppingList?.id ?? json.shoppingList?.id ?? json.id };
}

export async function renameList({ id, title }: { id: string; title: string }): Promise<void> {
  const response = await fetchFromApp(`/api/shopping-lists/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name: title }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Failed to rename list");
  }
}

export async function deleteList({ id }: { id: string }): Promise<void> {
  const response = await fetchFromApp(`/api/shopping-lists/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Failed to delete list");
  }
}

export async function addItem({
  listId,
  name,
  quantity,
  category,
}: {
  listId: string;
  name: string;
  quantity?: string;
  category?: string;
}): Promise<{ id: string }> {
  const response = await fetchFromApp(`/api/shopping-lists/${listId}/items`, {
    method: "POST",
    body: JSON.stringify({ name, quantity, category }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Failed to add item");
  }

  const json = await response.json();
  return { id: json.data?.item?.id ?? json.item?.id ?? json.id };
}

export async function toggleItem({ id, isComplete }: { id: string; isComplete: boolean }): Promise<void> {
  const response = await fetchFromApp(`/api/shopping-items/toggle`, {
    method: "POST",
    body: JSON.stringify({ id, is_complete: isComplete }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Failed to toggle item");
  }
}

export async function updateItem({
  id,
  name,
  quantity,
  category,
}: {
  id: string;
  name?: string;
  quantity?: string;
  category?: string;
}): Promise<void> {
  const response = await fetchFromApp(`/api/shopping-items/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, quantity, category }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Failed to update item");
  }
}

export async function markAllComplete({ listId }: { listId: string }): Promise<void> {
  try {
    const list = await getList({ id: listId });
    const incomplete = list.items.filter((item) => !item.isComplete);
    if (incomplete.length === 0) {
      return;
    }

    await Promise.all(
      incomplete.map((item) =>
        fetchFromApp(`/api/shopping-items/toggle`, {
          method: "POST",
          body: JSON.stringify({ id: item.id, is_complete: true }),
        })
      )
    );
  } catch (error) {
    logger.error("markAllComplete failed", { error, listId });
    throw error instanceof Error ? error : new Error("Failed to mark items complete");
  }
}

export async function updateNotes({ listId, notes }: { listId: string; notes: string }): Promise<void> {
  const response = await fetchFromApp(`/api/shopping-lists/${listId}`, {
    method: "PUT",
    body: JSON.stringify({ description: notes }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Failed to update notes");
  }
}

export async function generateFromMeals({ weekStartISO }: { weekStartISO: string }): Promise<{ listId: string }> {
  const response = await fetchFromApp(`/api/meal-planner/add-week-ingredients`, {
    method: "POST",
    body: JSON.stringify({ week_start_date: weekStartISO }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Failed to generate shopping list from meals");
  }

  const json = await response.json();
  return {
    listId: json.data?.listId ?? json.listId ?? json.list_id ?? "",
  };
}

function mapApiItem(item: Record<string, unknown>): ShoppingListItem {
  return {
    id: String(item.id),
    name: String(item.name ?? "Item"),
    quantity: item.quantity ? String(item.quantity) : null,
    category: item.category ? String(item.category) : null,
    notes: item.notes ? String(item.notes) : null,
    isComplete: Boolean(item.is_complete ?? item.completed ?? false),
  };
}

async function fetchFromApp(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const headers = await buildHeaders(init?.headers);
  return fetch(url, {
    ...init,
    headers,
  });
}

async function buildHeaders(base?: HeadersInit): Promise<HeadersInit> {
  const cookieStore = cookies();
  const headers = new Headers(base ?? {});
  headers.set("Content-Type", "application/json");

  const csrf = cookieStore.get("csrf-token");
  if (csrf) {
    headers.set("x-csrf-token", csrf.value);
  }

  const serialized = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  if (serialized) {
    headers.set("cookie", serialized);
  }

  return headers;
}

