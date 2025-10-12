import { cookies } from "next/headers";
import { DateTime } from "luxon";

import { logger } from "@/lib/logging/logger";
import type { RecipeSummary } from "./types";

export type MealType = "breakfast" | "lunch" | "dinner";

export type WeekPlanEntry = {
  id: string;
  date: string;
  mealType: MealType;
  title: string | null;
  recipeId: string | null;
  notes: string | null;
  eventId?: string | null;
};

export type MealPlanRecord = {
  id: string;
  household_id: string;
  week_start_date: string;
  meals: Record<string, Partial<Record<MealType, string | null>>> | null;
  manual_titles?: Record<string, Partial<Record<MealType, string | null>>> | null;
  notes?: Record<string, Partial<Record<MealType, string | null>>> | null;
};

function flattenMealPlan(plan: MealPlanRecord, weekStart: string): WeekPlanEntry[] {
  if (!plan.meals) {
    return [];
  }

  const entries: WeekPlanEntry[] = [];
  for (const [dayKey, slots] of Object.entries(plan.meals)) {
    if (!slots) continue;

    const dayOffset = weekdayIndex(dayKey);
    const date = DateTime.fromISO(weekStart).plus({ days: dayOffset }).toISODate();

    for (const [slot, value] of Object.entries(slots)) {
      if (!value) continue;

      const slotKey = slot as MealType;
      const recipeId = typeof value === "string" && value.length > 0 ? value : null;
      const manualTitle = plan.manual_titles?.[dayKey]?.[slotKey] ?? null;
      const note = plan.notes?.[dayKey]?.[slotKey] ?? null;

      const title = manualTitle ? String(manualTitle) : null;

      entries.push({
        id: `${plan.id}:${dayKey}:${slotKey}`,
        date,
        mealType: slotKey,
        title,
        recipeId,
        notes: note ? String(note) : null,
        eventId: null,
      });
    }
  }

  return entries;
}

const DEFAULT_BASE =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.APP_URL ??
  "http://127.0.0.1:3000";

export async function getWeekPlans({
  weekStart,
}: {
  weekStart: string;
}): Promise<WeekPlanEntry[]> {
  const response = await fetchFromApp(
    `/api/meal-planner?${new URLSearchParams({ week_start_date: weekStart }).toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }

    const errorText = await response.text();
    logger.error("getWeekPlans failed", new Error(errorText), {
      status: response.status,
      weekStart,
    });
    throw new Error(`Failed to fetch meal plan for ${weekStart}: ${response.status}`);
  }

  const payload = await response.json();
  const record = (payload.data?.mealPlan ?? payload.mealPlan ?? payload.plan ?? null) as MealPlanRecord | null;
  if (!record?.meals) {
    return [];
  }

  return flattenMealPlan(record, weekStart);
}

type CreateMealPlanInput = {
  weekStartISO: string;
  dayKey: string;
  mealType: MealType;
  recipeId?: string | null;
  title?: string | null;
  notes?: string | null;
  addToCalendar?: boolean;
};

export type CreateMealPlanInput = {
  weekStartISO: string;
  dayKey: string;
  mealType: MealType;
  recipeId?: string | null;
  title?: string | null;
  notes?: string | null;
  addToCalendar?: boolean;
};

export async function createMealPlan(input: CreateMealPlanInput): Promise<{ id: string; eventId?: string }>
{
  const response = await fetchFromApp("/api/meal-planner/assign", {
    method: "POST",
    body: JSON.stringify({
      week: input.weekStartISO,
      day: input.dayKey,
      slot: input.mealType,
      recipe_id: input.recipeId ?? undefined,
      title: input.title ?? undefined,
      notes: input.notes ?? undefined,
      alsoAddToList: input.addToCalendar ?? false,
      autoConfirm: input.addToCalendar ?? false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("createMealPlan failed", new Error(errorText), {
      status: response.status,
      weekStartISO,
      dayKey,
      mealType,
    });
    throw new Error(`Failed to create meal plan entry: ${response.status}`);
  }

  const json = await response.json();
  return {
    id: json.data?.plan?.id ?? json.plan?.id ?? "",
    eventId: json.data?.plan?.event_id ?? json.plan?.event_id ?? undefined,
  };
}

export async function listRecipes({
  query,
  tags,
  limit = 20,
  page = 1,
}: {
  query?: string;
  tags?: string[];
  limit?: number;
  page?: number;
}): Promise<RecipeSummary[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (tags?.length) params.set("tags", tags.join(","));
  params.set("limit", String(limit));
  params.set("page", String(page));

  const response = await fetchFromApp(`/api/recipes?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("listRecipes failed", new Error(errorText), {
      status: response.status,
      query,
      tags,
      page,
    });
    throw new Error(`Failed to list recipes: ${response.status}`);
  }

  const json = await response.json();
  const recipes = json.data?.recipes ?? json.recipes ?? [];

  return recipes.map(
    (recipe: Record<string, unknown>): RecipeSummary => ({
      id: String(recipe.id ?? ""),
      title: String(recipe.title ?? recipe.name ?? "Untitled"),
      imageUrl: (recipe.image_url ?? recipe.imageUrl) as string | null,
      tags: (recipe.tags as string[] | undefined) ?? [],
      prepMinutes: (recipe.prep_time as number | undefined) ?? null,
      servings: (recipe.servings as number | undefined) ?? null,
    })
  );
}

export async function importRecipeFromUrl(url: string): Promise<{ id: string; title: string; imageUrl?: string | null }>
{
  const response = await fetchFromApp("/api/recipes/import", {
    method: "POST",
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Failed to import recipe");
  }

  const json = await response.json();
  return {
    id: json.data?.recipe_id ?? json.recipe_id,
    title: json.data?.title ?? json.title ?? "Imported Recipe",
    imageUrl: json.data?.image_url ?? json.image_url ?? null,
  };
}

export async function generateShoppingListForWeek({
  weekStartISO,
}: {
  weekStartISO: string;
}): Promise<{ listId: string; message?: string }>
{
  const response = await fetchFromApp("/api/meal-planner/add-week-ingredients", {
    method: "POST",
    body: JSON.stringify({ week_start_date: weekStartISO }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Failed to generate shopping list");
  }

  const json = await response.json();
  const listId = json.data?.listId ?? json.listId ?? json.list_id;

  return {
    listId: typeof listId === "string" && listId.length > 0 ? listId : "groceries",
    message: json.message ?? json.data?.message ?? null,
  };
}

async function fetchFromApp(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith("http") ? path : `${DEFAULT_BASE}${path}`;
  const headers = await buildAuthenticatedHeaders(init?.headers);
  return fetch(url, {
    ...init,
    headers,
  });
}

async function buildAuthenticatedHeaders(base?: HeadersInit): Promise<HeadersInit> {
  const cookieStore = cookies();
  const headers = new Headers(base ?? {});
  headers.set("Content-Type", "application/json");

  const csrf = cookieStore.get("csrf-token");
  if (csrf) {
    headers.set("x-csrf-token", csrf.value);
  }

  const serializedCookies = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  if (serializedCookies) {
    headers.set("cookie", serializedCookies);
  }

  return headers;
}

function weekdayIndex(day: string): number {
  const order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const index = order.indexOf(day.toLowerCase());
  return index >= 0 ? index : 0;
}
