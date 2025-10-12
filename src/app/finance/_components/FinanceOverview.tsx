import { CreditCard, DollarSign, PiggyBank, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { FinanceFeatureFlags, FinanceSummary } from "../_lib/types";

interface FinanceOverviewProps {
  summary: FinanceSummary;
  featureFlags: FinanceFeatureFlags;
}

export function FinanceOverview({ summary, featureFlags }: FinanceOverviewProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {featureFlags.bills && summary.bills ? (
        <>
          <Card className="rounded-3xl border-white/5 bg-[#101522]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Total Bills</CardTitle>
              <CreditCard className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-white">{summary.bills.total}</p>
              <CardDescription className="mt-1 text-xs text-slate-400">
                {summary.bills.pending} pending, {summary.bills.overdue} overdue
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/5 bg-[#101522]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Amount Due</CardTitle>
              <DollarSign className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-white">
                ${summary.bills.amountDue.toFixed(2)}
              </p>
              <CardDescription className="mt-1 text-xs text-slate-400">
                From {summary.bills.pending} pending bills
              </CardDescription>
            </CardContent>
          </Card>
        </>
      ) : null}

      {featureFlags.envelopes && summary.envelopes ? (
        <>
          <Card className="rounded-3xl border-white/5 bg-[#101522]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Budget Envelopes</CardTitle>
              <PiggyBank className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-white">{summary.envelopes.total}</p>
              <CardDescription className="mt-1 text-xs text-slate-400">
                ${summary.envelopes.totalRemaining.toFixed(2)} remaining
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/5 bg-[#101522]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">Spent This Period</CardTitle>
              <TrendingUp className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-white">
                ${summary.envelopes.totalSpent.toFixed(2)}
              </p>
              <CardDescription className="mt-1 text-xs text-slate-400">
                of ${summary.envelopes.totalAllocated.toFixed(2)} allocated
              </CardDescription>
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}
