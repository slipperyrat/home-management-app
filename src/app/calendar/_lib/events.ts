import { unstable_cache } from "next/cache";
import { DateTime } from "luxon";
import { RRule, RRuleSet } from "rrule";
import { auth } from "@clerk/nextjs/server";
import { getDatabaseClient, getUserHouseholdId } from "@/lib/api/database";
import type { Database } from "@/types/database";
import { logger } from "@/lib/logging/logger";
import {
  DEFAULT_CALENDAR_TIMEZONE,
  getMonthRange,
  parseMonthParam,
  toDayKey,
  formatMonthParam,
} from "./date";

export const CALENDAR_MONTH_TAG = (monthKey: string) => `calendar:month:${monthKey}`;
export const CALENDAR_DAY_TAG = (timezone: string, isoDay: string) => `calendar:day:${timezone}:${isoDay}`;

export type DaySummary = {
  eventCount: number;
  hasMore: boolean;
};

export type CalendarInstance = {
  baseEventId: string;
  instanceId: string;
  title: string;
  description: string | null;
  location: string | null;
  timezone: string;
  isAllDay: boolean;
  source: string | null;
  startsAt: DateTime;
  endsAt: DateTime;
};

type EventRow = Database["public"]["Tables"]["events"]["Row"];

type MonthAgg = {
  monthKey: string;
  eventsByDay: Record<string, CalendarInstance[]>;
  summaries: Record<string, DaySummary>;
};

const MAX_EVENTS_PER_DAY = 99;

export async function getMonthData({
  monthParam,
  timezone = DEFAULT_CALENDAR_TIMEZONE,
}: {
  monthParam?: string;
  timezone?: string;
}): Promise<MonthAgg> {
  const reference = parseMonthParam(monthParam, timezone);
  const { monthStart, monthEnd, queryStart, queryEnd } = getMonthRange(reference, timezone);
  const monthKey = formatMonthParam(monthStart);

  const loadMonth = unstable_cache(
    async () =>
      loadMonthFromDatabase({
        monthKey,
        monthStart,
        monthEnd,
        queryStart,
        queryEnd,
      }),
    ["calendar-month-data", monthKey, timezone],
    { tags: [CALENDAR_MONTH_TAG(monthKey)] }
  );

  return loadMonth();
}

export async function getDayEvents({
  monthParam,
  timezone = DEFAULT_CALENDAR_TIMEZONE,
  dayISO,
}: {
  monthParam?: string;
  timezone?: string;
  dayISO: string;
}): Promise<CalendarInstance[]> {
  const reference = parseMonthParam(monthParam, timezone);
  const monthKey = formatMonthParam(reference);

  const loadDay = unstable_cache(
    async () => {
      const monthData = await getMonthData({ monthParam: monthKey, timezone });
      return monthData.eventsByDay[dayISO] ?? [];
    },
    ["calendar-day-data", monthKey, timezone, dayISO],
    { tags: [CALENDAR_DAY_TAG(timezone, dayISO)] }
  );

  return loadDay();
}

async function loadMonthFromDatabase({
  monthKey,
  monthStart,
  monthEnd,
  queryStart,
  queryEnd,
}: {
  monthKey: string;
  monthStart: DateTime;
  monthEnd: DateTime;
  queryStart: DateTime;
  queryEnd: DateTime;
}): Promise<MonthAgg> {
  const rows = await queryEvents(queryStart, queryEnd);
  const instances = expandEvents(rows, monthStart, monthEnd);

  const eventsByDay: Record<string, CalendarInstance[]> = Object.create(null);
  const summaries: Record<string, DaySummary> = Object.create(null);

  for (const instance of instances) {
    const localKey = toDayKey(instance.startsAt.setZone(instance.timezone));
    eventsByDay[localKey] ||= [];

    if (eventsByDay[localKey].length < MAX_EVENTS_PER_DAY) {
      eventsByDay[localKey].push(instance);
    }

    const summary = summaries[localKey] || { eventCount: 0, hasMore: false };
    summary.eventCount += 1;
    summary.hasMore = summary.eventCount > 3;
    summaries[localKey] = summary;
  }

  for (const key of Object.keys(eventsByDay)) {
    eventsByDay[key].sort((a, b) => a.startsAt.toMillis() - b.startsAt.toMillis());
  }

  return {
    monthKey,
    eventsByDay,
    summaries,
  };
}

async function queryEvents(rangeStart: DateTime, rangeEnd: DateTime): Promise<EventRow[]> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return [];
    }

    const householdId = await getUserHouseholdId(userId);
    if (!householdId) {
      return [];
    }

    const supabase = getDatabaseClient();
    const startIso = rangeStart.minus({ days: 1 }).toUTC().toISO();
    const endIso = rangeEnd.plus({ days: 1 }).toUTC().toISO();

    const baseQuery = supabase
      .from("events")
      .select("*")
      .or(`household_id.eq.${householdId},attendee_user_id.eq.${userId}`)
      .gte("start_at", startIso)
      .lte("start_at", endIso)
      .order("start_at", { ascending: true });

    const recurringQuery = supabase
      .from("events")
      .select("*")
      .or(`household_id.eq.${householdId},attendee_user_id.eq.${userId}`)
      .not("rrule", "is", null);

    const [{ data: base, error: baseError }, { data: recurring, error: recurringError }] = await Promise.all([
      baseQuery,
      recurringQuery,
    ]);

    if (baseError) {
      logger.error("Failed to load calendar events", baseError, { start: startIso, end: endIso, userId });
      return [];
    }

    if (recurringError) {
      logger.error("Failed to load recurring events", recurringError, { userId });
    }

    const unique = new Map<string, EventRow>();
    for (const row of [...(base ?? []), ...(recurring ?? [])]) {
      if (
        row.household_id === householdId ||
        row.attendee_user_id === userId ||
        (row.is_public && row.household_id === householdId)
      ) {
        unique.set(row.id, row);
      }
    }

    return Array.from(unique.values());
  } catch (error) {
    logger.error("Unexpected error loading events", error as Error);
    return [];
  }
}

export function expandEvents(rows: EventRow[], monthStart: DateTime, monthEnd: DateTime): CalendarInstance[] {
  const windowStart = monthStart.startOf("day");
  const windowEnd = monthEnd.endOf("day");
  const instances: CalendarInstance[] = [];

  for (const row of rows) {
    const timezone = row.timezone || DEFAULT_CALENDAR_TIMEZONE;
    const start = DateTime.fromISO(row.start_at, { zone: timezone });
    const end = DateTime.fromISO(row.end_at, { zone: timezone });
    const duration = end.diff(start, ["hours", "minutes", "seconds"]);

    if (!start.isValid || !end.isValid) {
      continue;
    }

    if (row.rrule) {
      const ruleSet = createRuleSet(row, timezone, start);
      const between = ruleSet.between(windowStart.toJSDate(), windowEnd.toJSDate(), true);

      for (const occurrence of between) {
        const occurrenceStart = DateTime.fromJSDate(occurrence, { zone: timezone });
        const occurrenceEnd = occurrenceStart.plus(duration);
        instances.push(toInstance(row, occurrenceStart, occurrenceEnd, `${row.id}:${occurrenceStart.toISO()}`));
      }
    }

    if (!row.rrule && start <= windowEnd && end >= windowStart) {
      instances.push(toInstance(row, start, end, row.id));
    }

    if (!row.rrule) {
      for (const rdateIso of row.rdates ?? []) {
        const explicitStart = DateTime.fromISO(rdateIso, { zone: timezone });
        if (!explicitStart.isValid) {
          continue;
        }

        const explicitEnd = explicitStart.plus(duration);
        if (explicitStart <= windowEnd && explicitEnd >= windowStart) {
          instances.push(toInstance(row, explicitStart, explicitEnd, `${row.id}:${explicitStart.toISO()}`));
        }
      }
    }
  }

  return instances;
}

function createRuleSet(row: EventRow, timezone: string, start: DateTime): RRuleSet {
  const ruleSet = new RRuleSet();

  const baseRule = new RRule({
    ...RRule.parseString(row.rrule ?? ""),
    dtstart: start.toJSDate(),
  });

  ruleSet.rrule(baseRule);

  (row.exdates ?? []).forEach((iso) => {
    const date = DateTime.fromISO(iso, { zone: timezone });
    if (date.isValid) {
      ruleSet.exdate(date.toJSDate());
    }
  });

  (row.rdates ?? []).forEach((iso) => {
    const date = DateTime.fromISO(iso, { zone: timezone });
    if (date.isValid) {
      ruleSet.rdate(date.toJSDate());
    }
  });

  return ruleSet;
}

function toInstance(row: EventRow, startsAt: DateTime, endsAt: DateTime, instanceId: string): CalendarInstance {
  return {
    baseEventId: row.id,
    instanceId,
    title: row.title,
    description: row.description,
    location: row.location,
    timezone: row.timezone || DEFAULT_CALENDAR_TIMEZONE,
    isAllDay: row.is_all_day,
    source: row.source,
    startsAt,
    endsAt,
  };
}

