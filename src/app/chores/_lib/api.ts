import { cookies } from "next/headers";

import { logger } from "@/lib/logging/logger";
import type { ChoreDto, ChoreFilters, ChorePriority, ChoreStatus, ChoreTag, HouseholdMember } from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.APP_URL ??
  "http://127.0.0.1:3000";

export type ListChoresResponse = {
  chores: ChoreDto[];
};

export async function listChores(filters: ChoreFilters = {}): Promise<ListChoresResponse> {
  const params = new URLSearchParams();
  if (filters.view) params.set("view", filters.view);
  if (filters.status) params.set("status", filters.status);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.tag) params.set("tag", filters.tag);

  const response = await fetchFromApp(`/api/chores${params.size ? `?${params.toString()}` : ""}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await safeJson(response);
    const message = payload?.error ?? `Failed to list chores (${response.status})`;
    throw new Error(message);
  }

  const json = await response.json();
  const rows = (json.data?.chores ?? json.chores ?? []) as Array<Record<string, unknown>>;

  return {
    chores: rows.map(mapChore),
  };
}

export async function createChore(payload: {
  title: string;
  description?: string | null;
  assignedTo?: string | null;
  dueAt?: string | null;
  category?: string | null;
  priority?: ChorePriority;
  rrule?: string | null;
  dtstart?: string | null;
  aiDifficulty?: number | null;
  aiEstimatedDuration?: number | null;
  aiPreferredTime?: string | null;
  aiEnergyLevel?: "low" | "medium" | "high" | null;
  aiSkillRequirements?: string[];
  assignmentStrategy?: "auto" | "round_robin" | "fairness" | "manual";
}): Promise<ChoreDto> {
  const response = await fetchFromApp(`/api/chores`, {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      description: payload.description,
      assigned_to: payload.assignedTo,
      due_at: payload.dueAt,
      category: payload.category,
      priority: payload.priority,
      rrule: payload.rrule,
      dtstart: payload.dtstart,
      ai_difficulty_rating: payload.aiDifficulty,
      ai_estimated_duration: payload.aiEstimatedDuration,
      ai_preferred_time: payload.aiPreferredTime,
      ai_energy_level: payload.aiEnergyLevel,
      ai_skill_requirements: payload.aiSkillRequirements,
      assignment_strategy: payload.assignmentStrategy,
    }),
  });

  if (!response.ok) {
    const payloadJson = await safeJson(response);
    throw new Error(payloadJson?.error ?? `Failed to create chore (${response.status})`);
  }

  const json = await response.json();
  const chore = json.data?.chore ?? json.chore ?? json;
  return mapChore(chore as Record<string, unknown>);
}

export async function updateChore({
  id,
  ...values
}: {
  id: string;
  title?: string;
  description?: string | null;
  assignedTo?: string | null;
  dueAt?: string | null;
  category?: string | null;
  priority?: ChorePriority;
  status?: ChoreStatus;
  rrule?: string | null;
  dtstart?: string | null;
}): Promise<void> {
  const response = await fetchFromApp(`/api/chores/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      title: values.title,
      description: values.description,
      assigned_to: values.assignedTo,
      due_at: values.dueAt,
      category: values.category,
      priority: values.priority,
      status: values.status,
      rrule: values.rrule,
      dtstart: values.dtstart,
    }),
  });

  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload?.error ?? `Failed to update chore (${response.status})`);
  }
}

export async function deleteChore({ id }: { id: string }): Promise<void> {
  const response = await fetchFromApp(`/api/chores/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload?.error ?? `Failed to delete chore (${response.status})`);
  }
}

export async function toggleChoreCompletion({
  id,
  completed,
  xp = 10,
}: {
  id: string;
  completed: boolean;
  xp?: number;
}): Promise<void> {
  const endpoint = completed ? `/api/chores/completions` : `/api/chores/completions/${id}`;
  const method = completed ? "POST" : "DELETE";

  const response = await fetchFromApp(endpoint, {
    method,
    body: JSON.stringify({
      choreId: id,
      xp,
    }),
  });

  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload?.error ?? `Failed to toggle completion (${response.status})`);
  }
}

export async function listMembers(): Promise<HouseholdMember[]> {
  const response = await fetchFromApp(`/api/household-members`, { cache: "no-store" });
  if (!response.ok) {
    const payload = await safeJson(response);
    throw new Error(payload?.error ?? `Failed to load members (${response.status})`);
  }

  const json = await response.json();
  const members = json.data?.members ?? json.members ?? json;
  return (members as Array<Record<string, unknown>>).map((member) => ({
    id: String(member.userId ?? member.user_id ?? member.id ?? ""),
    name: member.name ? String(member.name) : null,
    email: member.email ? String(member.email) : null,
    role: member.role ? String(member.role) : null,
  }));
}

export async function listTags(): Promise<ChoreTag[]> {
  const response = await fetchFromApp(`/api/chores/tags`, { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    const payload = await safeJson(response);
    throw new Error(payload?.error ?? `Failed to load tags (${response.status})`);
  }

  const json = await response.json();
  const tags = json.data?.tags ?? json.tags ?? [];
  return (tags as Array<Record<string, unknown>>).map((tag) => ({
    id: String(tag.id ?? tag.name ?? ""),
    label: String(tag.label ?? tag.name ?? ""),
    count: Number(tag.count ?? tag.total ?? 0),
  }));
}

function mapChore(raw: Record<string, unknown>): ChoreDto {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? "Untitled chore"),
    description: raw.description ? String(raw.description) : null,
    assignedTo: raw.assigned_to ? String(raw.assigned_to) : null,
    assignedToName: raw.assigned_to_name ? String(raw.assigned_to_name) : null,
    dueAt: raw.due_at ? String(raw.due_at) : null,
    completedAt: raw.completed_at ? String(raw.completed_at) : null,
    createdAt: raw.created_at ? String(raw.created_at) : null,
    category: raw.category ? String(raw.category) : null,
    priority: (raw.priority ? String(raw.priority) : "medium") as ChorePriority,
    status: (raw.status ? String(raw.status) : "pending") as ChoreStatus,
    xpReward: raw.xp_reward != null ? Number(raw.xp_reward) : null,
    repeatRrule: raw.rrule ? String(raw.rrule) : null,
    aiDifficulty: raw.ai_difficulty_rating != null ? Number(raw.ai_difficulty_rating) : null,
    aiEstimatedDuration: raw.ai_estimated_duration != null ? Number(raw.ai_estimated_duration) : null,
    aiEnergyLevel: raw.ai_energy_level ? (String(raw.ai_energy_level) as "low" | "medium" | "high") : null,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
  };
}

async function fetchFromApp(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const headers = await buildHeaders(init?.headers);
  return fetch(url, {
    ...init,
    headers,
  });
}

async function buildHeaders(base?: HeadersInit): Promise<HeadersInit> {
  const cookieStore = cookies();
  const headers = new Headers(base ?? {});
  headers.set("Content-Type", "application/json");

  const csrf = cookieStore.get("csrf-token");
  if (csrf) {
    headers.set("x-csrf-token", csrf.value);
  }

  const serialized = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  if (serialized) {
    headers.set("cookie", serialized);
  }

  return headers;
}

type ApiErrorPayload = {
  error?: string;
} & Record<string, unknown>;

async function safeJson(response: Response): Promise<ApiErrorPayload | undefined> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch (error) {
    logger.warn("chores adapter: failed to parse payload", { status: response.status, error });
    return undefined;
  }
}


