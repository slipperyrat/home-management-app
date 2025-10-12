import { DateTime } from "luxon";

export type BillStatus = "pending" | "paid" | "overdue" | "cancelled";
export type BillPriority = "low" | "medium" | "high" | "urgent";

export type BillDto = {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  dueAt: string;
  issuedAt: string | null;
  paidAt: string | null;
  status: BillStatus;
  category: string | null;
  priority: BillPriority;
  source: string | null;
  createdAt: string;
};

export type BudgetEnvelopeDto = {
  id: string;
  name: string;
  description: string | null;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  spentPercentage: number;
  periodStart: string;
  periodEnd: string;
  category: string | null;
  color: string;
  createdAt: string;
};

export type SpendEntryDto = {
  id: string;
  amount: number;
  description: string;
  category: string | null;
  transactionDate: string;
  merchant: string | null;
  paymentMethod: "cash" | "card" | "bank_transfer" | "other";
  envelope: { id: string; name: string; color: string } | null;
  bill: { id: string; title: string; amount: number } | null;
  createdAt: string;
};

export type FinanceFeatureFlags = {
  bills: boolean;
  envelopes: boolean;
  spending: boolean;
};

export type FinanceSummary = {
  bills: {
    total: number;
    pending: number;
    overdue: number;
    amountDue: number;
    upcoming: BillDto[];
  } | null;
  envelopes: {
    total: number;
    totalAllocated: number;
    totalSpent: number;
    totalRemaining: number;
  } | null;
  spending: {
    recent: SpendEntryDto[];
  } | null;
};

export type BillsFilter = {
  status?: BillStatus;
  limit?: number;
};

export type EnvelopesFilter = {
  category?: string;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
};

export type SpendingFilter = {
  category?: string;
  limit?: number;
};

export function parseIsoDate(value: string | null | undefined): DateTime | null {
  if (!value) {
    return null;
  }
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? parsed : null;
}


