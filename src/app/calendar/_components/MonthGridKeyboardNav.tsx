"use client";

import { useCallback, useEffect } from "react";

import type { MonthGridDay } from "./MonthGrid";

const KEY_TO_OFFSET: Record<string, number> = {
  ArrowUp: -7,
  ArrowDown: 7,
  ArrowLeft: -1,
  ArrowRight: 1,
};

export function MonthGridKeyboardNav({
  gridId,
  days,
  selectedIso,
}: {
  gridId: string;
  days: MonthGridDay[];
  selectedIso: string;
}) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const offset = KEY_TO_OFFSET[event.key];
      if (offset === undefined) {
        if (event.key === "Home") {
          focusDay(days[0]?.isoDate);
          event.preventDefault();
        } else if (event.key === "End") {
          focusDay(days[days.length - 1]?.isoDate);
          event.preventDefault();
        }
        return;
      }

      const currentIndex = days.findIndex((day) => day.isoDate === selectedIso);
      if (currentIndex === -1) {
        return;
      }

      const nextIndex = currentIndex + offset;
      if (nextIndex < 0 || nextIndex >= days.length) {
        return;
      }

      focusDay(days[nextIndex].isoDate);
      event.preventDefault();
    },
    [days, selectedIso]
  );

  useEffect(() => {
    const grid = document.getElementById(gridId);
    if (!grid) {
      return undefined;
    }

    grid.addEventListener("keydown", handleKeyDown);
    return () => {
      grid.removeEventListener("keydown", handleKeyDown);
    };
  }, [gridId, handleKeyDown]);

  return null;
}

function focusDay(isoDate?: string) {
  if (!isoDate) {
    return;
  }

  const target = document.querySelector<HTMLAnchorElement>(`a[data-day="${isoDate}"]`);
  target?.focus();
}
