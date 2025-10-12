import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";

import { expandEvents } from "@/app/calendar/_lib/events";

type EventRow = Parameters<typeof expandEvents>[0][number];

const TIMEZONE = "Australia/Melbourne";

function buildEvent(overrides: Partial<EventRow> = {}): EventRow {
  const base: EventRow = {
    id: "event-base",
    household_id: "household-1",
    calendar_id: null,
    title: "Sample",
    description: null,
    start_at: "2024-05-01T09:00:00+10:00",
    end_at: "2024-05-01T10:00:00+10:00",
    timezone: TIMEZONE,
    is_all_day: false,
    rrule: null,
    exdates: [],
    rdates: [],
    location: null,
    created_by: "user-1",
    updated_at: "2024-04-01T00:00:00+10:00",
    created_at: "2024-04-01T00:00:00+10:00",
    is_public: false,
    attendee_user_id: null,
    source: "first_party",
  };

  return { ...base, ...overrides };
}

describe("expandEvents", () => {
  const monthStart = DateTime.fromISO("2024-05-01", { zone: TIMEZONE });
  const monthEnd = monthStart.endOf("month");

  it("includes single non-recurring events within the visible window", () => {
    const rows: EventRow[] = [buildEvent()];

    const instances = expandEvents(rows, monthStart, monthEnd);

    expect(instances).toHaveLength(1);
    expect(instances[0].startsAt.toISO()).toContain("2024-05-01T09:00:00");
    expect(instances[0].endsAt.toISO()).toContain("2024-05-01T10:00:00");
  });

  it("expands recurring events while applying exdates and rdates", () => {
    const recurring = buildEvent({
      id: "event-recurring",
      start_at: "2024-05-03T09:00:00+10:00",
      end_at: "2024-05-03T10:00:00+10:00",
      rrule: "FREQ=DAILY;COUNT=5",
      exdates: ["2024-05-05T09:00:00+10:00"],
      rdates: ["2024-05-10T09:00:00+10:00"],
    });

    const instances = expandEvents([recurring], monthStart, monthEnd);

    const isoDates = instances.map((instance) => instance.startsAt.toISODate());

    expect(isoDates).toEqual([
      "2024-05-03",
      "2024-05-04",
      "2024-05-06",
      "2024-05-07",
      "2024-05-10",
    ]);
    expect(isoDates).not.toContain("2024-05-05");
  });

  it("includes recurring instances that begin before the month window", () => {
    const recurring = buildEvent({
      id: "event-recurring-offset",
      start_at: "2024-04-28T09:00:00+10:00",
      end_at: "2024-04-28T10:00:00+10:00",
      rrule: "FREQ=DAILY;COUNT=10",
    });

    const instances = expandEvents([recurring], monthStart, monthEnd);

    const isoDates = instances.map((instance) => instance.startsAt.toISODate());

    expect(isoDates).toEqual([
      "2024-05-01",
      "2024-05-02",
      "2024-05-03",
      "2024-05-04",
      "2024-05-05",
      "2024-05-06",
      "2024-05-07",
    ]);
  });

  it("ignores events that fall completely outside the month window", () => {
    const outside = buildEvent({
      id: "event-outside",
      start_at: "2024-04-20T09:00:00+10:00",
      end_at: "2024-04-20T10:00:00+10:00",
    });

    const instances = expandEvents([outside], monthStart, monthEnd);

    expect(instances).toHaveLength(0);
  });

  it("includes non-recurring events that overlap the window", () => {
    const spanning = buildEvent({
      id: "event-spanning",
      start_at: "2024-04-30T23:30:00+10:00",
      end_at: "2024-05-01T00:30:00+10:00",
    });

    const instances = expandEvents([spanning], monthStart, monthEnd);

    expect(instances).toHaveLength(1);
    expect(instances[0].startsAt.toISO()).toContain("2024-04-30T23:30:00");
  });

  it("adds explicit rdates for standalone events", () => {
    const singleWithRdates = buildEvent({
      id: "event-with-rdates",
      start_at: "2024-04-10T09:00:00+10:00",
      end_at: "2024-04-10T10:00:00+10:00",
      rdates: [
        "2024-05-02T09:00:00+10:00",
        "2024-05-15T09:00:00+10:00",
      ],
    });

    const instances = expandEvents([singleWithRdates], monthStart, monthEnd);

    const isoDates = instances.map((instance) => instance.startsAt.toISODate());

    expect(isoDates).toEqual(["2024-05-02", "2024-05-15"]);
  });

  it("skips events with invalid timestamps", () => {
    const invalid = buildEvent({
      id: "event-invalid",
      start_at: "totally-invalid",
      end_at: "also-invalid",
    });

    const instances = expandEvents([invalid], monthStart, monthEnd);

    expect(instances).toHaveLength(0);
  });
});

