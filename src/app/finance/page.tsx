import { Suspense } from "react";

import { canAccessFeature, getCurrentHousehold } from "@/lib/server/canAccessFeature";

import { FinanceShell } from "./_components/FinanceShell";
import { FinanceShellSkeleton } from "./_components/FinanceShellSkeleton";
import { fetchBills, fetchBudgetEnvelopes, fetchFinanceSummary, fetchSpendEntries } from "./_lib/api";
import type { FinanceFeatureFlags } from "./_lib/types";

export const dynamic = "force-dynamic";

function resolveFeatureFlags(plan: "free" | "pro"): FinanceFeatureFlags {
  return {
    bills: canAccessFeature(plan, "bill_management"),
    envelopes: canAccessFeature(plan, "budget_envelopes"),
    spending: canAccessFeature(plan, "spending_tracking"),
  };
}

export default async function FinancePage() {
  const household = await getCurrentHousehold();

  if (!household) {
    return (
      <div className="px-4 py-10">
        <div className="rounded-3xl border border-white/5 bg-[#101522] p-12 text-center text-slate-200">
          You need a household to manage finances.
        </div>
      </div>
    );
  }

  const featureFlags = resolveFeatureFlags(household.plan);

  if (!featureFlags.bills && !featureFlags.envelopes && !featureFlags.spending) {
    return (
      <div className="px-4 py-10">
        <div className="rounded-3xl border border-white/5 bg-[#101522] p-12 text-center text-slate-200">
          Upgrade your plan to access household finance features.
        </div>
      </div>
    );
  }

  const summaryPromise = fetchFinanceSummary(featureFlags);
  const billsPromise = featureFlags.bills ? fetchBills({ limit: 100 }) : Promise.resolve([]);
  const envelopesPromise = featureFlags.envelopes ? fetchBudgetEnvelopes({ limit: 100 }) : Promise.resolve([]);
  const spendingPromise = featureFlags.spending ? fetchSpendEntries({ limit: 100 }) : Promise.resolve([]);

  return (
    <div className="px-4 py-6 lg:px-8">
      <Suspense fallback={<FinanceShellSkeleton />}>
        <FinanceShell
          summaryPromise={summaryPromise}
          billsPromise={billsPromise}
          envelopesPromise={envelopesPromise}
          spendingPromise={spendingPromise}
          featureFlags={featureFlags}
          householdId={household.id}
        />
      </Suspense>
    </div>
  );
}
