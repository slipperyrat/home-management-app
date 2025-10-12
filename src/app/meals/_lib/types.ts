import { DateTime } from "luxon";

import type { WeekPlanEntry } from "./api";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;

export type MealType = (typeof MEAL_TYPES)[number];

export const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export type GridMeal = {
  id: string;
  date: string; // ISO date (yyyy-MM-dd)
  mealType: MealType;
  title?: string | null;
  recipeId?: string | null;
  notes?: string | null;
  eventId?: string | null;
};

export type RecipeSummary = {
  id: string;
  title: string;
  imageUrl?: string | null;
  tags?: string[];
  prepMinutes?: number | null;
  servings?: number | null;
};

export type WeekHeader = {
  columnIndex: number;
  iso: string;
  label: string;
};

export type WeekCell = {
  columnIndex: number;
  rowIndex: number;
  dateISO: string;
  mealType: MealType;
};

export type WeekMatrix = {
  headers: WeekHeader[];
  cells: WeekCell[][]; // column-major: cells[columnIndex][rowIndex]
};

export function mapPlanEntriesToGridMeals(entries: WeekPlanEntry[]): GridMeal[] {
  return entries.map((entry) => ({
    id: entry.id,
    date: entry.date,
    mealType: entry.mealType,
    title: entry.title ?? null,
    recipeId: entry.recipeId ?? null,
    notes: entry.notes ?? null,
    eventId: entry.eventId ?? null,
  }));
}

export function isoToWeekStart(iso: string): string {
  const date = DateTime.fromISO(iso);
  if (!date.isValid) {
    return DateTime.now().startOf("week").set({ weekday: 1 }).toISODate();
  }
  return date.startOf("week").set({ weekday: 1 }).toISODate();
}

export function isoToDayKey(iso: string): DayKey {
  const date = DateTime.fromISO(iso);
  if (!date.isValid) {
    return "monday";
  }
  const index = date.weekday - 1; // weekday: Monday=1
  return DAY_KEYS[index] ?? "monday";
}

