"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buildWeekMatrix, type WeekCell } from "../_lib/grid";
import type { GridMeal } from "../_lib/types";
import { NewMealDialog } from "./NewMealDialog";

export type WeekGridProps = {
  weekStart: string;
  meals: GridMeal[];
  onAttachRecipe?: (meal: GridMeal) => void;
};

const ROWS: Array<{ type: GridMeal["mealType"]; label: string }> = [
  { type: "breakfast", label: "Breakfast" },
  { type: "lunch", label: "Lunch" },
  { type: "dinner", label: "Dinner" },
];

export default function WeekGrid({ weekStart, meals, onAttachRecipe }: WeekGridProps) {
  const router = useRouter();
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<{ cell: WeekCell | null; open: boolean }>(
    () => ({ cell: null, open: false })
  );

  const matrix = useMemo(() => buildWeekMatrix(weekStart), [weekStart]);
  const mealMap = useMemo(() => new Map(meals.map((meal) => [`${meal.date}:${meal.mealType}`, meal])), [meals]);

  const closeDialog = useCallback(() => {
    setDialogState({ cell: null, open: false });
  }, []);

  const openDialog = useCallback((cell: WeekCell) => {
    setActiveCell(`${ROWS.findIndex((row) => row.type === cell.mealType)}:${cell.columnIndex}`);
    setDialogState({ cell, open: true });
  }, []);

  const handleAfterSubmit = useCallback(() => {
    router.refresh();
    closeDialog();
  }, [router, closeDialog]);

  const handleKeyNavigation = useCallback(
    (event: React.KeyboardEvent<HTMLTableElement>) => {
      if (!activeCell) {
        return;
      }

      const [rowIndex, colIndex] = activeCell.split(":").map((value) => Number.parseInt(value, 10));
      let nextRow = rowIndex;
      let nextCol = colIndex;

      switch (event.key) {
        case "ArrowUp":
          nextRow = Math.max(0, rowIndex - 1);
          break;
        case "ArrowDown":
          nextRow = Math.min(ROWS.length - 1, rowIndex + 1);
          break;
        case "ArrowLeft":
          nextCol = Math.max(0, colIndex - 1);
          break;
        case "ArrowRight":
          nextCol = Math.min(matrix.headers.length - 1, colIndex + 1);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          openDialog(matrix.cells[colIndex][rowIndex]);
          return;
        default:
          return;
      }

      event.preventDefault();
      const nextKey = `${nextRow}:${nextCol}`;
      setActiveCell(nextKey);
    },
    [activeCell, matrix, openDialog]
  );

  useEffect(() => {
    setActiveCell(null);
  }, [weekStart]);

  return (
    <>
      <table
        className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200"
        onKeyDown={handleKeyNavigation}
        role="grid"
      >
        <thead className="bg-[#0d121f]">
          <tr>
            <th className="p-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Meal</th>
            {matrix.headers.map((header) => (
              <th key={header.iso} className="p-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span className="block text-slate-200">{header.label}</span>
                <span className="text-xs text-slate-500">{DateTime.fromISO(header.iso).toFormat("LLL d")}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10 bg-[#0b101d]">
          {ROWS.map((row, rowIndex) => (
            <tr key={row.type}>
              <th scope="row" className="p-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                {row.label}
              </th>
              {matrix.headers.map((header, columnIndex) => {
                const cell = matrix.cells[columnIndex][rowIndex];
                const cellKey = `${rowIndex}:${columnIndex}`;
                const meal = mealMap.get(`${header.iso}:${row.type}`);
                const isActive = activeCell === cellKey;

                return (
                  <td key={cellKey} className="h-24 border border-white/5 p-3 align-top" role="gridcell">
                    {meal ? (
                      <button
                        type="button"
                        className={cn(
                          "w-full rounded-xl border border-blue-400/10 bg-blue-400/5 p-3 text-left text-sm text-white transition",
                          isActive && "ring-2 ring-blue-400"
                        )}
                        onClick={() => openDialog(cell)}
                        onFocus={() => setActiveCell(cellKey)}
                      >
                        <p className="font-medium">
                          {meal.title ?? (meal.recipeId ? "Linked recipe" : "Meal slot")}
                        </p>
                        {meal.notes ? (
                          <p className="mt-1 text-xs text-slate-400 line-clamp-2">{meal.notes}</p>
                        ) : null}
                      </button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                          "h-full w-full rounded-xl border border-dashed border-white/10 bg-transparent text-xs text-slate-400 transition hover:border-white/20 hover:text-white",
                          isActive && "border-white/40 text-white"
                        )}
                        onClick={() => openDialog(cell)}
                        onFocus={() => setActiveCell(cellKey)}
                      >
                        Add meal
                      </Button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <NewMealDialog
        open={dialogState.open}
        cell={dialogState.cell}
        onOpenChange={(open) => (open ? null : closeDialog())}
        onCompleted={() => {
          handleAfterSubmit();
          if (dialogState.cell) {
            const key = `${dialogState.cell.dateISO}:${dialogState.cell.mealType}`;
            const entry = mealMap.get(key);
            if (entry && onAttachRecipe) {
              onAttachRecipe(entry);
            }
          }
        }}
      />
    </>
  );
}

