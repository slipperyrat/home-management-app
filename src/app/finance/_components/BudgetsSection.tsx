import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import type { BudgetEnvelopeDto, FinanceSummary } from "../_lib/types";

interface BudgetsSectionProps {
  envelopes: BudgetEnvelopeDto[];
  summary: FinanceSummary["envelopes"];
}

export function BudgetsSection({ envelopes, summary }: BudgetsSectionProps) {
  return (
    <Card className="rounded-3xl border-white/5 bg-[#0b101d]">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-white">Budget Envelopes</CardTitle>
          <CardDescription className="text-sm text-slate-400">
            {summary
              ? `${summary.totalRemaining.toFixed(2)} remaining of ${summary.totalAllocated.toFixed(2)} allocated`
              : "Track spending across envelopes"}
          </CardDescription>
        </div>
        <Button variant="secondary" className="rounded-2xl">
          <Plus className="mr-2 h-4 w-4" />
          New Envelope
        </Button>
      </CardHeader>
      <CardContent>
        {envelopes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-[#101522] p-10 text-center">
            <div className="rounded-2xl bg-white/5 p-4 text-4xl">🏦</div>
            <div className="space-y-1">
              <p className="text-lg font-medium text-white">No envelopes created</p>
              <p className="text-sm text-slate-400">
                Create envelopes to track budgets like groceries, utilities, or subscriptions.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {envelopes.map((envelope) => {
                const progress = Math.min(envelope.spentPercentage, 100);
                return (
                  <div
                    key={envelope.id}
                    className="space-y-3 rounded-2xl border border-white/5 bg-[#101522] p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: envelope.color }}
                        />
                        <div>
                          <p className="text-sm font-medium text-white">{envelope.name}</p>
                          <p className="text-xs text-slate-400">
                            {envelope.category ? envelope.category : "Uncategorized"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">
                          ${envelope.remainingAmount.toFixed(2)} remaining
                        </p>
                        <p className="text-xs text-slate-400">
                          ${envelope.spentAmount.toFixed(2)} of ${envelope.allocatedAmount.toFixed(2)} used
                        </p>
                      </div>
                    </div>
                    <Progress value={progress} className="h-2 rounded-full bg-white/5" />
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-dashed border-white/10 bg-[#101522] p-6 text-center text-sm text-slate-400">
              Budget trend visualization coming soon
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
