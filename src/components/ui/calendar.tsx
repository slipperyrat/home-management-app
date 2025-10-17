"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = DayPickerProps;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button:
          "inline-flex items-center justify-center rounded-md border border-transparent bg-transparent p-1 text-sm text-slate-400 transition-colors hover:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:ring-offset-1",
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "w-9 text-center text-xs font-normal text-slate-400",
        row: "flex w-full mt-2",
        cell: cn(
          "relative h-9 w-9 text-center text-sm focus-within:relative focus-within:z-20",
          props.mode === "range"
            ? "[&:has([aria-selected='true'])]:bg-slate-800 [&:has([aria-selected='true'])]:text-white first:[&:has([aria-selected='true'])]:rounded-l-md last:[&:has([aria-selected='true'])]:rounded-r-md"
            : ""
        ),
        day: cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-normal transition-all hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:ring-offset-1",
          "aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-blue-500 text-white hover:bg-blue-500 hover:text-white focus:bg-blue-500 focus:text-white",
        day_today: "text-blue-400",
        day_outside: "text-slate-600 opacity-50",
        day_disabled: "text-slate-600 opacity-50",
        day_range_middle:
          "aria-selected:bg-slate-800 aria-selected:text-white",
        day_hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

