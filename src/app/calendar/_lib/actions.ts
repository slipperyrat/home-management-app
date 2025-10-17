"use server";

import { DateTime } from "luxon";
import { revalidateTag } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getDatabaseClient, getUserHouseholdId } from "@/lib/api/database";
import type { Database } from "@/types/supabase.generated";
import { logger } from "@/lib/logging/logger";
import { DEFAULT_CALENDAR_TIMEZONE } from "./date";
import { CALENDAR_DAY_TAG, CALENDAR_MONTH_TAG } from "./events";

type CreateEventResult = {
  error?: string;
};

export async function createEventAction(monthKey: string, formData: FormData): Promise<CreateEventResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: "You must be signed in to create events." };
    }

    const householdId = await getUserHouseholdId(userId);
    if (!householdId) {
      return { error: "You are not associated with a household." };
    }

    const title = String(formData.get("title") ?? "").trim();
    const date = String(formData.get("date") ?? "");
    const startTime = formData.get("startTime") ? String(formData.get("startTime")) : undefined;
    const endTime = formData.get("endTime") ? String(formData.get("endTime")) : undefined;
    const description = String(formData.get("description") ?? "").trim() || null;
    const location = String(formData.get("location") ?? "").trim() || null;
    const timezone = String(formData.get("timezone") ?? DEFAULT_CALENDAR_TIMEZONE);
    const rrule = String(formData.get("rrule") ?? "").trim() || null;
    const calendarId = String(formData.get("calendarId") ?? "").trim() || null;
    const isAllDay = Boolean(formData.get("allDay"));

    if (!title || !date) {
      return { error: "Title and date are required." };
    }

    const startsAt = computeDateTime(date, startTime ?? (isAllDay ? "00:00" : undefined), timezone);
    const endsAt = computeDateTime(date, endTime ?? (isAllDay ? "23:59" : undefined), timezone);

    if (!startsAt || !endsAt) {
      return { error: "Invalid date or time." };
    }

    if (endsAt <= startsAt) {
      return { error: "End time must be after start time." };
    }

    const supabase = getDatabaseClient();

    const startIso = startsAt.toUTC().toISO();
    const endIso = endsAt.toUTC().toISO();

    if (!startIso || !endIso) {
      return { error: "Failed to format event timestamps." };
    }

    const insertPayload: Database["public"]["Tables"]["events"]["Insert"] = {
      household_id: householdId,
      calendar_id: calendarId || null,
      title,
      description,
      start_at: startIso,
      end_at: endIso,
      timezone,
      is_all_day: isAllDay,
      rrule,
      location,
      created_by: userId,
      source: "first_party",
    };

    const { error } = await supabase.from("events").insert(insertPayload);

    if (error) {
      logger.error("Failed to create event", new Error(error.message), { userId, householdId });
      return { error: "Failed to create event." };
    }

    revalidateTag(CALENDAR_MONTH_TAG(monthKey));
    revalidateTag(CALENDAR_DAY_TAG(timezone, date));

    return {};
  } catch (error) {
    logger.error("Unexpected error creating event", error as Error);
    return { error: "Unexpected error creating event." };
  }
}

function computeDateTime(date: string, time: string | undefined, timezone: string): DateTime | null {
  try {
    const iso = time ? `${date}T${time}` : `${date}T00:00`;
    const dt = DateTime.fromISO(iso, { zone: timezone });
    return dt.isValid ? dt : null;
  } catch {
    return null;
  }
}

