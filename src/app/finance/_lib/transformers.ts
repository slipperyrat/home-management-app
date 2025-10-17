import type {
  BillDto,
  BillPriority,
  BillStatus,
  BudgetEnvelopeDto,
  SpendEntryDto,
} from "./types";

type RawRecord = Record<string, unknown> | null | undefined;

function getRecord(value: RawRecord): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function mapBill(rawInput: RawRecord): BillDto {
  const raw = getRecord(rawInput) ?? {};
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

export function mapBudgetEnvelope(rawInput: RawRecord): BudgetEnvelopeDto {
  const raw = getRecord(rawInput) ?? {};
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

export function mapSpendEntry(rawInput: RawRecord): SpendEntryDto {
  const raw = getRecord(rawInput) ?? {};
  const container = raw as Record<string, unknown>;
  const envelopeSource = (container["budget_envelopes"] ?? container["envelope"]) as RawRecord;
  const billSource = (container["bills"] ?? container["bill"]) as RawRecord;
  const envelopeRaw = getRecord(envelopeSource);
  const billRaw = getRecord(billSource);

  return {
    id: String(raw.id ?? ""),
    amount: Number(raw.amount ?? 0),
    description: String(raw.description ?? "Expense"),
    category: raw.category ? String(raw.category) : null,
    transactionDate: String(raw.transaction_date ?? raw.transactionDate ?? new Date().toISOString()),
    merchant: raw.merchant ? String(raw.merchant) : null,
    paymentMethod: (raw.payment_method ? String(raw.payment_method) : "other") as SpendEntryDto["paymentMethod"],
    envelope: envelopeRaw
      ? {
          id: String(envelopeRaw.id ?? ""),
          name: String(envelopeRaw.name ?? "Envelope"),
          color: String(envelopeRaw.color ?? "#3B82F6"),
        }
      : null,
    bill: billRaw
      ? {
          id: String(billRaw.id ?? ""),
          title: String(billRaw.title ?? "Bill"),
          amount: Number(billRaw.amount ?? 0),
        }
      : null,
    createdAt: String(raw.created_at ?? new Date().toISOString()),
  };
}
