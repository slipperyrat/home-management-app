import { DateTime } from "luxon";

import { MEAL_TYPES, type MealType, type WeekCell, type WeekMatrix } from "./types";

export function buildWeekMatrix(weekStartISO: string): WeekMatrix {
  const start = DateTime.fromISO(weekStartISO, { setZone: true }).startOf("day");
  const headers = Array.from({ length: 7 }, (_, index) => {
    const date = start.plus({ days: index });
    return {
      columnIndex: index,
      iso: date.toISODate(),
      label: date.toFormat("ccc"),
    };
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

