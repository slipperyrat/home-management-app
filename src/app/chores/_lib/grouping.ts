import { DateTime } from "luxon";

import type { ChoreBucket, ChoreBucketKey, ChoreDto } from "./types";

const BUCKET_LABELS: Record<ChoreBucketKey, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This Week",
  later: "Later",
  no_due: "No Due Date",
};

export function groupChores(chores: ChoreDto[], now: DateTime = DateTime.now()): ChoreBucket[] {
  const buckets: Record<ChoreBucketKey, ChoreDto[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    this_week: [],
    later: [],
    no_due: [],
  };

  const startOfToday = now.startOf("day");
  const endOfToday = now.endOf("day");
  const endOfTomorrow = now.plus({ days: 1 }).endOf("day");
  const endOfWeek = now.endOf("week");

  for (const chore of chores) {
    const bucketKey = getBucketKey(chore.dueAt, startOfToday, endOfToday, endOfTomorrow, endOfWeek);
    buckets[bucketKey].push(chore);
  }

  return (Object.keys(buckets) as ChoreBucketKey[])
    .map((key) => ({
      key,
      label: BUCKET_LABELS[key],
      chores: sortBucket(key, buckets[key]),
    }))
    .filter((bucket) => bucket.chores.length > 0);
}

function getBucketKey(
  dueAt: string | null,
  startOfToday: DateTime,
  endOfToday: DateTime,
  endOfTomorrow: DateTime,
  endOfWeek: DateTime,
): ChoreBucketKey {
  if (!dueAt) {
    return "no_due";
  }

  const dueDate = DateTime.fromISO(dueAt);
  if (!dueDate.isValid) {
    return "no_due";
  }

  if (dueDate < startOfToday) {
    return "overdue";
  }

  if (dueDate <= endOfToday) {
    return "today";
  }

  if (dueDate <= endOfTomorrow) {
    return "tomorrow";
  }

  if (dueDate <= endOfWeek) {
    return "this_week";
  }

  return "later";
}

function sortBucket(bucket: ChoreBucketKey, chores: ChoreDto[]): ChoreDto[] {
  const sorter = getBucketSorter(bucket);
  return [...chores].sort(sorter);
}

function getBucketSorter(bucket: ChoreBucketKey): (a: ChoreDto, b: ChoreDto) => number {
  if (bucket === "no_due") {
    return (a, b) => a.title.localeCompare(b.title);
  }

  return (a, b) => {
    const dateA = a.dueAt ? DateTime.fromISO(a.dueAt).toMillis() : Number.MAX_SAFE_INTEGER;
    const dateB = b.dueAt ? DateTime.fromISO(b.dueAt).toMillis() : Number.MAX_SAFE_INTEGER;

    if (dateA === dateB) {
      return a.title.localeCompare(b.title);
    }

    return dateA - dateB;
  };
}


