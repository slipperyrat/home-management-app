import { DateTime } from "luxon";

export type ChoreStatus = "pending" | "assigned" | "in_progress" | "completed" | "skipped";

export type ChorePriority = "low" | "medium" | "high" | "urgent";

export type ChoreDto = {
  id: string;
  title: string;
  description: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  category: string | null;
  priority: ChorePriority;
  status: ChoreStatus;
  xpReward: number | null;
  repeatRrule: string | null;
  aiDifficulty: number | null;
  aiEstimatedDuration: number | null;
  aiEnergyLevel: "low" | "medium" | "high" | null;
  tags: string[];
};

export type ChoreFilters = {
  view?: "assigned" | "created" | "completed" | "all";
  status?: ChoreStatus | "active";
  assignee?: string;
  tag?: string;
};

export type HouseholdMember = {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  role: string | null;
};

export type ChoreTag = {
  id: string;
  label: string;
  count: number;
};

export type ChoreBucketKey =
  | "overdue"
  | "today"
  | "tomorrow"
  | "this_week"
  | "later"
  | "no_due";

export type ChoreBucket = {
  key: ChoreBucketKey;
  label: string;
  chores: ChoreDto[];
};

export type GroupedChores = ChoreBucket[];

export function parseIsoDate(value: string | null | undefined): DateTime | null {
  if (!value) return null;
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? parsed : null;
}


