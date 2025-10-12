import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DaySummary as Summary } from "../_lib/events";
import { MonthGridKeyboardNav } from "./MonthGridKeyboardNav";

export type DaySummary = Summary;

export type MonthGridDay = {
  isoDate: string;
  label: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  summary?: DaySummary;
  href: string;
};

export type MonthGridProps = {
  gridId: string;
  days: MonthGridDay[];
  selectedIso: string;
};

export function MonthGrid({ gridId, days, selectedIso }: MonthGridProps) {
  return (
    <div className="space-y-2">
      <div
        id={gridId}
        data-calendar-grid
        role="grid"
        tabIndex={0}
        className="grid grid-cols-7 gap-1 text-xs text-slate-300 focus:outline-none"
      >
        {days.map((day) => (
          <Link
            key={day.isoDate}
            href={day.href}
            data-day={day.isoDate}
            role="gridcell"
            aria-selected={day.isSelected}
            className={cn(
              "relative flex h-24 flex-col items-start rounded-xl border border-white/5 bg-[#111728] p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
              !day.isCurrentMonth && "opacity-40",
              day.isSelected && "border-blue-500 bg-blue-500/10",
              day.isToday && !day.isSelected && "border-white/10"
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                day.isSelected
                  ? "bg-blue-500 text-white"
                  : day.isToday
                  ? "border border-blue-500 text-blue-300"
                  : "text-slate-200"
              )}
            >
              {day.label}
            </span>

            <div className="mt-auto flex h-6 items-center gap-1">
              {day.summary && day.summary.eventCount > 0 ? (
                createIndicators(day.isoDate, day.summary.eventCount).map((key) => (
                  <span key={key} className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                ))
              ) : (
                <span className="text-[10px] text-slate-500">&nbsp;</span>
              )}
            </div>

            {day.summary?.hasMore ? (
              <span className="absolute bottom-2 right-2 text-[10px] text-slate-500">
                +{Math.max(day.summary.eventCount - 3, 1)}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
      <MonthGridKeyboardNav gridId={gridId} days={days} selectedIso={selectedIso} />
    </div>
  );
}

export function WeekdayHeaders({ labels }: { labels: string[] }) {
  return (
    <div role="row" className="grid grid-cols-7 gap-1 text-xs font-semibold text-slate-400">
      {labels.map((weekday) => (
        <span key={weekday} role="columnheader" className="px-2 py-1 uppercase tracking-wide">
          {weekday}
        </span>
      ))}
    </div>
  );
}

export function MonthGridSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 42 }, (_, index) => (
        <div key={`month-grid-skeleton-${index}`} className="h-24 animate-pulse rounded-xl border border-white/5 bg-[#111728]/60" />
      ))}
    </div>
  );
}

function createIndicators(dayKey: string, eventCount: number): string[] {
  const visible = Math.min(eventCount, 3);
  return Array.from({ length: visible }, (_, index) => `${dayKey}-indicator-${index}`);
}

