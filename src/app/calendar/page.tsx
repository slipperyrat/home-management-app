import { type ReactNode, Suspense } from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { DateTime } from "luxon";

import { WeekdayHeaders, MonthGrid, MonthGridSkeleton } from "./_components/MonthGrid";
import { DayPanel } from "./_components/DayPanel";
import { DayPanelSkeleton } from "./_components/DayPanelSkeleton";
import { NewEventDialog } from "./_components/NewEventDialog";
import { getMonthData, getDayEvents } from "./_lib/events";
import {
  DEFAULT_CALENDAR_TIMEZONE,
  parseMonthParam,
  parseDateParam,
  buildCalendarMatrix,
  toDayKey,
  formatMonthParam,
  shiftMonth,
  getWeekdayLabels,
} from "./_lib/date";

export const runtime = "nodejs";

type CalendarPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function CalendarPage({ searchParams = {} }: CalendarPageProps) {
  const timezone = await detectTimezone();
  const monthParam = typeof searchParams.month === "string" ? searchParams.month : undefined;
  const dateParam = typeof searchParams.date === "string" ? searchParams.date : undefined;

  const reference = parseMonthParam(monthParam, timezone);
  const today = DateTime.now().setZone(timezone).startOf("day");
  const selectedDate = parseDateParam(dateParam, timezone);
  const monthKey = formatMonthParam(reference);
  const selectedIso = selectedDate?.toISODate?.() ?? today.toISODate();
  if (!selectedIso) {
    throw new Error("Unable to determine selected ISO date");
  }
  const weekdayLabels = getWeekdayLabels();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Calendar</h1>
          <p className="text-sm text-slate-400">Household schedule and upcoming events</p>
        </div>
        <NewEventDialog monthKey={monthKey} />
      </div>

      <section className="rounded-3xl border border-white/5 bg-[#101522] p-4 shadow-lg shadow-black/20">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Month</p>
            <h2 className="text-xl font-semibold text-white">{reference.toFormat("LLLL yyyy")}</h2>
          </div>
          <nav className="flex items-center gap-2">
            <NavButton
              href={buildNavHref({
                month: formatMonthParam(today),
                date: today.toISODate() ?? today.toFormat("yyyy-MM-dd"),
              })}
            >
              Today
            </NavButton>
            <NavButton
              href={buildNavHref({
                month: formatMonthParam(shiftMonth(reference, -1)),
                date: selectedIso,
              })}
            >
              Previous
            </NavButton>
            <NavButton
              href={buildNavHref({
                month: formatMonthParam(shiftMonth(reference, 1)),
                date: selectedIso,
              })}
            >
              Next
            </NavButton>
          </nav>
        </header>

        <div className="mt-4 space-y-3">
          <WeekdayHeaders labels={weekdayLabels} />
          <Suspense key={`${monthKey}-${timezone}`} fallback={<MonthGridSkeleton />}>
            <MonthSection
              timezone={timezone}
              monthKey={monthKey}
              selectedIso={selectedIso}
              monthReferenceISO={reference.toISO() ?? reference.toFormat("yyyy-MM-01")}
            />
          </Suspense>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Suspense key={`${monthKey}-${selectedIso}-${timezone}`} fallback={<DayPanelSkeleton />}>
          <DaySection timezone={timezone} monthKey={monthKey} dayIso={selectedIso} />
        </Suspense>

        <aside className="rounded-3xl border border-white/5 bg-[#101522] p-4 shadow-lg shadow-black/20">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Upcoming</h2>
            <Link className="text-xs text-blue-400 hover:text-blue-200" href="/calendar/sync">
              Sync settings →
            </Link>
          </header>
          <p className="mt-3 text-sm text-slate-400">
            Week view, drag-and-drop, and deeper integrations are on the roadmap. Manage connected calendars from the sync page.
          </p>
        </aside>
      </section>
    </div>
  );
}

function buildNavHref(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  if (params.month) searchParams.set("month", params.month);
  if (params.date) searchParams.set("date", params.date);
  const query = searchParams.toString();
  return query ? `/calendar?${query}` : "/calendar";
}

async function MonthSection({
  timezone,
  monthKey,
  selectedIso,
  monthReferenceISO,
}: {
  timezone: string;
  monthKey: string;
  selectedIso: string;
  monthReferenceISO: string;
}) {
  const reference = DateTime.fromISO(monthReferenceISO, { zone: timezone }).startOf("month");
  const { summaries } = await getMonthData({ monthParam: monthKey, timezone });
  const selectedDayKey = selectedIso;
  const days = buildCalendarMatrix(reference, timezone).map(({ date, isCurrentMonth }) => {
    const isoDate = date.toISODate() ?? date.toFormat("yyyy-MM-dd");
    const dayKey = toDayKey(date);

    return {
      isoDate,
      label: date.day,
      isCurrentMonth,
      isSelected: dayKey === selectedDayKey,
      isToday: date.hasSame(DateTime.now().setZone(timezone), "day"),
      summary: summaries[dayKey] ?? null,
      href: buildNavHref({ month: monthKey, date: isoDate }),
    };
  });

  return <MonthGrid gridId="calendar-month-grid" days={days} selectedIso={selectedIso} />;
}

async function DaySection({
  timezone,
  monthKey,
  dayIso,
}: {
  timezone: string;
  monthKey: string;
  dayIso: string;
}) {
  const events = await getDayEvents({ monthParam: monthKey, timezone, dayISO: dayIso });
  const date = DateTime.fromISO(dayIso, { zone: timezone }).startOf("day");

  return <DayPanel date={date} timezone={timezone} events={events} />;
}

function NavButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-white/20 hover:text-white"
    >
      {children}
    </Link>
  );
}

async function detectTimezone(): Promise<string> {
  const headerTz = (await headers()).get("x-user-timezone");
  if (headerTz) {
    return headerTz;
  }

  const cookieTz = (await cookies()).get("tz");
  if (cookieTz?.value) {
    return cookieTz.value;
  }

  return DEFAULT_CALENDAR_TIMEZONE;
}

