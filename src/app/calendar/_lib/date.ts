import { DateTime } from "luxon";

export const DEFAULT_CALENDAR_TIMEZONE = "Australia/Melbourne";
export const CALENDAR_FIRST_DAY_OF_WEEK = 1; // Monday
export const MONTH_PARAM_FORMAT = "yyyy-LL";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type MonthRange = {
  monthStart: DateTime;
  monthEnd: DateTime;
  queryStart: DateTime;
  queryEnd: DateTime;
};

export type CalendarCell = {
  date: DateTime;
  isCurrentMonth: boolean;
};

export function parseDateParam(value: string | undefined, timezone = DEFAULT_CALENDAR_TIMEZONE): DateTime {
  if (!value) {
    return DateTime.now().setZone(timezone).startOf("day");
  }

  const parsed = DateTime.fromISO(value, { zone: timezone });
  if (!parsed.isValid) {
    return DateTime.now().setZone(timezone).startOf("day");
  }

  return parsed.startOf("day");
}

export function parseMonthParam(value: string | undefined, timezone = DEFAULT_CALENDAR_TIMEZONE): DateTime {
  if (!value) {
    return DateTime.now().setZone(timezone).startOf("month");
  }

  const parsed = DateTime.fromFormat(value, MONTH_PARAM_FORMAT, { zone: timezone });
  if (!parsed.isValid) {
    return DateTime.now().setZone(timezone).startOf("month");
  }

  return parsed.startOf("month");
}

export function getMonthRange(reference: DateTime, timezone = DEFAULT_CALENDAR_TIMEZONE): MonthRange {
  const monthStart = reference.setZone(timezone).startOf("month");
  const monthEnd = monthStart.endOf("month");

  const queryStart = monthStart.minus({ days: 1 });
  const queryEnd = monthEnd.plus({ days: 1 });

  return { monthStart, monthEnd, queryStart, queryEnd };
}

export function buildCalendarMatrix(reference: DateTime, timezone = DEFAULT_CALENDAR_TIMEZONE): CalendarCell[] {
  const monthStart = reference.setZone(timezone).startOf("month");

  let gridStart = monthStart.startOf("week").set({ weekday: CALENDAR_FIRST_DAY_OF_WEEK });
  if (gridStart > monthStart) {
    gridStart = gridStart.minus({ weeks: 1 });
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = gridStart.plus({ days: index });
    return {
      date,
      isCurrentMonth: date.hasSame(monthStart, "month"),
    };
  });
}

export function shiftMonth(reference: DateTime, offset: number): DateTime {
  return reference.plus({ months: offset }).startOf("month");
}

export function shiftDay(reference: DateTime, offset: number): DateTime {
  return reference.plus({ days: offset }).startOf("day");
}

export function toDayKey(date: DateTime): string {
  return date.toFormat("yyyy-LL-dd");
}

export function formatMonthParam(date: DateTime): string {
  return date.toFormat(MONTH_PARAM_FORMAT);
}

export function isToday(date: DateTime, timezone = DEFAULT_CALENDAR_TIMEZONE): boolean {
  const today = DateTime.now().setZone(timezone).startOf("day");
  return today.hasSame(date, "day");
}

export function getWeekdayLabels(): string[] {
  if (CALENDAR_FIRST_DAY_OF_WEEK === 1) {
    return WEEKDAY_LABELS;
  }

  const offset = (CALENDAR_FIRST_DAY_OF_WEEK + 6) % 7; // shift relative to Monday baseline
  return WEEKDAY_LABELS.slice(offset).concat(WEEKDAY_LABELS.slice(0, offset));
}

