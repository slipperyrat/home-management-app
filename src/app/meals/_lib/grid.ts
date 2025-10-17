import { DateTime } from "luxon";

import { MEAL_TYPES, type MealType, type WeekCell, type WeekHeader, type WeekMatrix } from "./types";

const DAYS_IN_WEEK = 7;

export function buildWeekMatrix(weekStartISO: string): WeekMatrix {
  const fallback = DateTime.now().startOf("week");
  const base = weekStartISO
    ? DateTime.fromISO(weekStartISO).startOf("day")
    : fallback;
  const start = base.isValid ? base : fallback;

  const headers: WeekHeader[] = Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const date = start.plus({ days: index });
    const iso = date.toISODate() ?? fallback.toISODate() ?? "";
    const label = date.toFormat("ccc dd");
    return {
      columnIndex: index,
      iso,
      label,
    } satisfies WeekHeader;
  });

  const cells: WeekCell[][] = headers.map((header) =>
    MEAL_TYPES.map((mealType, rowIndex) => ({
      columnIndex: header.columnIndex,
      rowIndex,
      dateISO: header.iso,
      mealType,
    }))
  );

  return { headers, cells };
}

export type { WeekCell } from "./types";

export function mealTypeLabel(value: MealType): string {
  switch (value) {
    case "breakfast":
      return "Breakfast";
    case "lunch":
      return "Lunch";
    case "dinner":
      return "Dinner";
    default:
      return value;
  }
}

