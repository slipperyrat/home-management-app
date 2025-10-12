import { cookies } from "next/headers";

import type { RecipeDetail, RecipeFormInput, RecipeImportResult, RecipeSummary } from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.APP_URL ??
  "http://127.0.0.1:3000";

export async function listRecipes({
  tag,
  favorites,
  query,
  limit,
  offset,
}: {
  tag?: string;
  favorites?: boolean;
  query?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<RecipeSummary[]> {
  const searchParams = new URLSearchParams();
  if (tag) searchParams.set("tag", tag);
  if (favorites) searchParams.set("favorites", "true");
  if (typeof limit === "number") searchParams.set("limit", String(limit));
  if (typeof offset === "number") searchParams.set("offset", String(offset));

  const path = `/api/recipes${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`;
  const response = await fetchFromApp(path, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to list recipes: ${response.status}`);
  }

  const json = await response.json();
  const payload = json.data ?? json;
  let recipes = (payload.recipes ?? payload.data?.recipes ?? []) as Array<Record<string, unknown>>;

  if (query) {
    const needle = query.trim().toLowerCase();
    if (needle) {
      recipes = recipes.filter((recipe) => {
        const title = String(recipe.name ?? recipe.title ?? "").toLowerCase();
        const description = String(recipe.description ?? "").toLowerCase();
        return title.includes(needle) || description.includes(needle);
      });
    }
  }

  if (typeof limit === "number") {
    const start = Math.max(0, offset ?? 0);
    recipes = recipes.slice(start, start + limit);
  }

  return recipes.map(mapRecipeSummary);
}

export async function getRecipe({ id }: { id: string }): Promise<RecipeDetail> {
  const response = await fetchFromApp(`/api/recipes/${id}`, { cache: "no-store" });

  if (!response.ok) {
    if (response.status === 404) {
      throw Object.assign(new Error("Recipe not found"), { status: 404 });
    }
    throw new Error(`Failed to fetch recipe: ${response.status}`);
  }

  const json = await response.json();
  const recipe = json.data?.recipe ?? json.recipe ?? json;
  return mapRecipeDetail(recipe as Record<string, unknown>);
}

export async function createRecipe(payload: RecipeFormInput): Promise<RecipeDetail> {
  const response = await fetchFromApp(`/api/recipes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await safeJson(response);
    throw new Error(error?.error ?? "Failed to create recipe");
  }

  const json = await response.json();
  const recipe = json.data?.recipe ?? json.recipe ?? json;
  return mapRecipeDetail(recipe as Record<string, unknown>);
}

export async function updateRecipe({ id, ...payload }: RecipeFormInput & { id: string }): Promise<RecipeDetail> {
  const response = await fetchFromApp(`/api/recipes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await safeJson(response);
    throw new Error(error?.error ?? "Failed to update recipe");
  }

  const json = await response.json();
  const recipe = json.data?.recipe ?? json.recipe ?? json;
  return mapRecipeDetail(recipe as Record<string, unknown>);
}

export async function deleteRecipe({ id }: { id: string }): Promise<void> {
  const response = await fetchFromApp(`/api/recipes/${id}`, { method: "DELETE" });

  if (!response.ok) {
    const error = await safeJson(response);
    throw new Error(error?.error ?? "Failed to delete recipe");
  }
}

export async function toggleRecipeFavorite({ id }: { id: string }): Promise<{ isFavorite: boolean }> {
  const response = await fetchFromApp(`/api/recipes/${id}/favorite`, { method: "PATCH" });

  if (!response.ok) {
    const error = await safeJson(response);
    throw new Error(error?.error ?? "Failed to toggle favorite");
  }

  const json = await response.json();
  const isFavorite = json.data?.is_favorite ?? json.is_favorite ?? json.success ?? false;
  return { isFavorite: Boolean(isFavorite) };
}

export async function importRecipeFromUrl({ url }: { url: string }): Promise<RecipeImportResult> {
  const response = await fetchFromApp(`/api/recipes/import`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await safeJson(response);
    throw new Error(error?.error ?? "Failed to import recipe");
  }

  const json = await response.json();
  const recipe = json.data?.recipe ?? json.recipe ?? json;
  return {
    recipe: mapRecipeDetail(recipe as Record<string, unknown>),
    didCreate: Boolean(json.data?.did_create ?? json.did_create ?? true),
  };
}

function mapRecipeSummary(raw: Record<string, unknown>): RecipeSummary {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.name ?? raw.title ?? "Untitled recipe"),
    description: raw.description ? String(raw.description) : null,
    prepMinutes: raw.prep_time != null ? Number(raw.prep_time) : null,
    cookMinutes: raw.cook_time != null ? Number(raw.cook_time) : null,
    servings: raw.servings != null ? Number(raw.servings) : null,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    imageUrl: raw.image_url ? String(raw.image_url) : null,
    difficulty: raw.difficulty ? String(raw.difficulty) : null,
    isFavorite: Boolean(raw.is_favorite ?? false),
    updatedAt: raw.updated_at ? String(raw.updated_at) : new Date().toISOString(),
  };
}

function mapRecipeDetail(raw: Record<string, unknown>): RecipeDetail {
  return {
    ...mapRecipeSummary(raw),
    ingredients: Array.isArray(raw.ingredients) ? (raw.ingredients as unknown[]) : [],
    instructions: Array.isArray(raw.instructions) ? (raw.instructions as unknown[]) : [],
    householdId: raw.household_id ? String(raw.household_id) : null,
    createdBy: raw.created_by ? String(raw.created_by) : null,
    createdAt: raw.created_at ? String(raw.created_at) : new Date().toISOString(),
    notes: raw.notes ? String(raw.notes) : null,
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

async function safeJson(response: Response): Promise<unknown | undefined> {
  try {
    return await response.json();
  } catch (parseError) {
    if (parseError instanceof Error) {
      console.warn("recipes adapter: failed to parse error payload", {
        message: parseError.message,
        status: response.status,
      });
    }
    return undefined;
  }
}
