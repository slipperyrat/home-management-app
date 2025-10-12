import { cookies } from "next/headers";

import { logger } from "@/lib/logging/logger";

import type {
  BillDto,
  BillPriority,
  BillStatus,
  BillsFilter,
  BudgetEnvelopeDto,
  EnvelopesFilter,
  FinanceSummary,
  FinanceFeatureFlags,
  SpendEntryDto,
  SpendingFilter,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.APP_URL ??
  "http://127.0.0.1:3000";

async function fetchFromApp(path: string, init?: RequestInit): Promise<Response> {
  const cookieStore = cookies();
  const headers = new Headers(init?.headers ?? {});
  headers.set("Content-Type", "application/json");

  const serialized = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  if (serialized) {
    headers.set("cookie", serialized);
  }

  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  return fetch(url, {
    ...init,
    headers,
  });
}

async function safeJson<T>(response: Response): Promise<T | undefined> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    logger.warn("finance adapter: failed to parse JSON", {
      status: response.status,
      error,
    });
    return undefined;
  }
}

function mapBill(raw: Record<string, unknown>): BillDto {
  const status = (raw.status ? String(raw.status) : "pending") as BillStatus;
  const priority = (raw.priority ? String(raw.priority) : "medium") as BillPriority;

  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? raw.name ?? "Untitled bill"),
    description: raw.description ? String(raw.description) : null,
    amount: Number(raw.amount ?? 0),
    currency: String(raw.currency ?? "AUD"),
    dueAt: String(raw.due_date ?? raw.dueAt ?? new Date().toISOString()),
    issuedAt: raw.issued_date ? String(raw.issued_date) : null,
    paidAt: raw.paid_date ? String(raw.paid_date) : null,
    status,
    category: raw.category ? String(raw.category) : null,
    priority,
    source: raw.source ? String(raw.source) : null,
    createdAt: String(raw.created_at ?? new Date().toISOString()),
  };
}

function mapEnvelope(raw: Record<string, unknown>): BudgetEnvelopeDto {
  const allocated = Number(raw.allocated_amount ?? raw.allocatedAmount ?? 0);
  const spent = Number(raw.spent_amount ?? raw.spentAmount ?? 0);
  const remaining = Number(raw.remaining_amount ?? raw.remainingAmount ?? allocated - spent);
  const percentage = allocated > 0 ? (spent / allocated) * 100 : 0;

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Envelope"),
    description: raw.description ? String(raw.description) : null,
    allocatedAmount: allocated,
    spentAmount: spent,
    remainingAmount: remaining,
    spentPercentage: Number.isFinite(percentage) ? percentage : 0,
    periodStart: String(raw.period_start ?? new Date().toISOString()),
    periodEnd: String(raw.period_end ?? new Date().toISOString()),
    category: raw.category ? String(raw.category) : null,
    color: String(raw.color ?? "#3B82F6"),
    createdAt: String(raw.created_at ?? new Date().toISOString()),
  };
}

function mapSpendEntry(raw: Record<string, unknown>): SpendEntryDto {
  const envelope = raw.budget_envelopes ?? raw.envelope;
  const bill = raw.bills ?? raw.bill;

  return {
    id: String(raw.id ?? ""),
    amount: Number(raw.amount ?? 0),
    description: String(raw.description ?? "Expense"),
    category: raw.category ? String(raw.category) : null,
    transactionDate: String(raw.transaction_date ?? raw.transactionDate ?? new Date().toISOString()),
    merchant: raw.merchant ? String(raw.merchant) : null,
    paymentMethod: (raw.payment_method ? String(raw.payment_method) : "other") as SpendEntryDto["paymentMethod"],
    envelope: envelope
      ? {
          id: String(envelope.id ?? ""),
          name: String(envelope.name ?? "Envelope"),
          color: String(envelope.color ?? "#3B82F6"),
        }
      : null,
    bill: bill
      ? {
          id: String(bill.id ?? ""),
          title: String(bill.title ?? "Bill"),
          amount: Number(bill.amount ?? 0),
        }
      : null,
    createdAt: String(raw.created_at ?? new Date().toISOString()),
  };
}

async function handleResponse<T>(response: Response, fallback: T): Promise<T> {
  if (response.ok) {
    const payload = await safeJson<{ data?: unknown; [key: string]: unknown }>(response);
    const data = payload?.data ?? payload;
    return (data as T) ?? fallback;
  }

  const errorPayload = await safeJson<{ error?: string }>(response);
  const errorMessage = errorPayload?.error ?? `Finance request failed (${response.status})`;
  logger.error("finance adapter request failed", new Error(errorMessage), {
    status: response.status,
  });
  throw new Error(errorMessage);
}

export async function fetchBills(filters: BillsFilter = {}): Promise<BillDto[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.limit) params.set("limit", String(filters.limit));

  const response = await fetchFromApp(`/api/finance/bills${params.size ? `?${params.toString()}` : ""}`, {
    cache: "no-store",
  });

  const data = await handleResponse<{ bills?: Array<Record<string, unknown>> | BillDto[] }>(response, {});
  const rawBills = (data.bills ?? []) as Array<Record<string, unknown>>;
  return rawBills.map(mapBill);
}

export async function fetchBudgetEnvelopes(filters: EnvelopesFilter = {}): Promise<BudgetEnvelopeDto[]> {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.periodStart) params.set("period_start", filters.periodStart);
  if (filters.periodEnd) params.set("period_end", filters.periodEnd);
  if (filters.limit) params.set("limit", String(filters.limit));

  const response = await fetchFromApp(`/api/finance/budget-envelopes${params.size ? `?${params.toString()}` : ""}`, {
    cache: "no-store",
  });

  const data = await handleResponse<{ envelopes?: Array<Record<string, unknown>> | BudgetEnvelopeDto[] }>(response, {});
  const rawEnvelopes = (data.envelopes ?? []) as Array<Record<string, unknown>>;
  return rawEnvelopes.map(mapEnvelope);
}

export async function fetchSpendEntries(filters: SpendingFilter = {}): Promise<SpendEntryDto[]> {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.limit) params.set("limit", String(filters.limit));

  const response = await fetchFromApp(`/api/finance/spend-entries${params.size ? `?${params.toString()}` : ""}`, {
    cache: "no-store",
  });

  const data = await handleResponse<{ spend_entries?: Array<Record<string, unknown>> | SpendEntryDto[] }>(response, {});
  const rawEntries = (data.spend_entries ?? []) as Array<Record<string, unknown>>;
  return rawEntries.map(mapSpendEntry);
}

export async function fetchFinanceSummary(flags: FinanceFeatureFlags): Promise<FinanceSummary> {
  const [bills, envelopes, spending] = await Promise.all([
    flags.bills ? fetchBills({ status: "pending", limit: 50 }) : Promise.resolve([]),
    flags.envelopes ? fetchBudgetEnvelopes({ limit: 50 }) : Promise.resolve([]),
    flags.spending ? fetchSpendEntries({ limit: 10 }) : Promise.resolve([]),
  ]);

  return {
    bills: flags.bills
      ? {
          total: bills.length,
          pending: bills.filter((bill) => bill.status === "pending").length,
          overdue: bills.filter((bill) => bill.status === "overdue").length,
          amountDue: bills
            .filter((bill) => bill.status === "pending")
            .reduce((sum, bill) => sum + bill.amount, 0),
          upcoming: bills
            .filter((bill) => bill.status !== "paid")
            .sort((a, b) =>
              new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
            )
            .slice(0, 5),
        }
      : null,
    envelopes: flags.envelopes
      ? {
          total: envelopes.length,
          totalAllocated: envelopes.reduce((sum, env) => sum + env.allocatedAmount, 0),
          totalSpent: envelopes.reduce((sum, env) => sum + env.spentAmount, 0),
          totalRemaining: envelopes.reduce((sum, env) => sum + env.remainingAmount, 0),
        }
      : null,
    spending: flags.spending
      ? {
          recent: spending
            .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
            .slice(0, 5),
        }
      : null,
  };
}


