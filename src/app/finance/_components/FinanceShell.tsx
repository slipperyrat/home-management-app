import { DateTime } from "luxon";
import type {
  BillDto,
  BudgetEnvelopeDto,
  FinanceFeatureFlags,
  FinanceSummary,
  SpendEntryDto,
} from "../_lib/types";
import { FinanceOverview } from "./FinanceOverview";
import { BillsSection } from "./BillsSection";
import { BudgetsSection } from "./BudgetsSection";
import { SpendingSection } from "./SpendingSection";
import { FinanceDataHydrator } from "./FinanceDataHydrator";
import { FinanceInsightsHeader } from "./FinanceInsightsHeader";
import { FinanceQuickActionsDrawer } from "./FinanceQuickActionsDrawer";

interface FinanceShellProps {
  billsPromise: Promise<BillDto[]>;
  envelopesPromise: Promise<BudgetEnvelopeDto[]>;
  spendingPromise: Promise<SpendEntryDto[]>;
  featureFlags: FinanceFeatureFlags;
  householdId: string;
}

function buildSummary(
  featureFlags: FinanceFeatureFlags,
  bills: BillDto[],
  envelopes: BudgetEnvelopeDto[],
  spending: SpendEntryDto[],
): FinanceSummary {
  const pendingBills = bills.filter((bill) => bill.status === "pending");
  const overdueBills = bills.filter((bill) => bill.status === "overdue");
  const amountDue = pendingBills.reduce((sum, bill) => sum + bill.amount, 0);

  const upcomingBills = bills
    .filter((bill) => bill.status !== "paid")
    .slice()
    .sort((a, b) => {
      const left = DateTime.fromISO(a.dueAt).toMillis();
      const right = DateTime.fromISO(b.dueAt).toMillis();
      return left - right;
    })
    .slice(0, 5);

  const summary: FinanceSummary = {
    bills: featureFlags.bills
      ? {
          total: bills.length,
          pending: pendingBills.length,
          overdue: overdueBills.length,
          amountDue,
          upcoming: upcomingBills,
        }
      : null,
    envelopes: featureFlags.envelopes
      ? {
          total: envelopes.length,
          totalAllocated: envelopes.reduce((sum, env) => sum + env.allocatedAmount, 0),
          totalSpent: envelopes.reduce((sum, env) => sum + env.spentAmount, 0),
          totalRemaining: envelopes.reduce((sum, env) => sum + env.remainingAmount, 0),
        }
      : null,
    spending: featureFlags.spending
      ? {
          recent: spending
            .slice()
            .sort((a, b) => DateTime.fromISO(b.transactionDate).toMillis() - DateTime.fromISO(a.transactionDate).toMillis())
            .slice(0, 5),
        }
      : null,
  };

  return summary;
}

export async function FinanceShell({
  billsPromise,
  envelopesPromise,
  spendingPromise,
  featureFlags,
  householdId,
}: FinanceShellProps) {
  const [bills, envelopes, spending] = await Promise.all([
    billsPromise,
    envelopesPromise,
    spendingPromise,
  ]);

  const summary = buildSummary(featureFlags, bills, envelopes, spending);

  return (
    <FinanceDataHydrator summary={summary} bills={bills} envelopes={envelopes} spending={spending}>
      <div className="space-y-8">
        <FinanceQuickActionsDrawer />

        <FinanceInsightsHeader summary={summary} />

        <FinanceOverview summary={summary} featureFlags={featureFlags} />

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            {featureFlags.bills ? (
              <BillsSection bills={bills} summary={summary.bills} householdId={householdId} />
            ) : null}

            {featureFlags.spending ? (
              <SpendingSection entries={spending} />
            ) : null}
          </div>

          <div className="space-y-6">
            {featureFlags.envelopes ? (
              <BudgetsSection envelopes={envelopes} summary={summary.envelopes} />
            ) : null}
          </div>
        </div>
      </div>
    </FinanceDataHydrator>
  );
}
