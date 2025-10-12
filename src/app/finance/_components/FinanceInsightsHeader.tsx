import type { FinanceSummary } from "../_lib/types";

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

interface FinanceInsightsHeaderProps {
  summary: FinanceSummary;
}

export function FinanceInsightsHeader({ summary }: FinanceInsightsHeaderProps) {
  const nextBill = summary.bills?.upcoming?.[0];

  return (
    <section className="rounded-3xl border border-white/5 bg-[#101522] p-6 text-white">
      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <h2 className="text-sm uppercase tracking-wide text-slate-400">Upcoming</h2>
          {nextBill ? (
            <div className="mt-2 text-lg font-semibold">
              {nextBill.title}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">No upcoming bills</p>
          )}
          {nextBill ? (
            <p className="text-sm text-slate-400">
              Due {new Date(nextBill.dueAt).toLocaleDateString()} • {formatCurrency(nextBill.amount)}
            </p>
          ) : null}
        </div>

        <div>
          <h2 className="text-sm uppercase tracking-wide text-slate-400">Budget Remaining</h2>
          {summary.envelopes ? (
            <div className="mt-2 text-2xl font-semibold">
              {formatCurrency(summary.envelopes.totalRemaining)}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Budgets not enabled</p>
          )}
          {summary.envelopes ? (
            <p className="text-sm text-slate-400">
              {formatCurrency(summary.envelopes.totalSpent)} spent of {formatCurrency(summary.envelopes.totalAllocated)}
            </p>
          ) : null}
        </div>

        <div>
          <h2 className="text-sm uppercase tracking-wide text-slate-400">Recent Spend</h2>
          {summary.spending?.recent?.length ? (
            <div className="mt-2 text-lg font-semibold">
              {formatCurrency(summary.spending.recent.reduce((sum, entry) => sum + entry.amount, 0))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">No recent spending</p>
          )}
          <p className="text-sm text-slate-400">Rolling 5 transactions</p>
        </div>
      </div>
    </section>
  );
}
