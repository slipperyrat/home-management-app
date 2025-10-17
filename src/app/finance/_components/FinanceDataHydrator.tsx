"use client";

import { useMemo } from "react";
import { HydrationBoundary, QueryClient, QueryClientProvider, dehydrate } from "@tanstack/react-query";

import { queryKeys } from "@/lib/react-query/config";

import type { BillDto, BudgetEnvelopeDto, FinanceSummary, SpendEntryDto } from "../_lib/types";

interface FinanceDataHydratorProps {
  summary: FinanceSummary;
  bills: BillDto[];
  envelopes: BudgetEnvelopeDto[];
  spending: SpendEntryDto[];
  children?: React.ReactNode;
}

export function FinanceDataHydrator({ summary, bills, envelopes, spending, children }: FinanceDataHydratorProps) {
  const client = useMemo(() => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(queryKeys.bills.all, bills);
    queryClient.setQueryData(queryKeys.budgets?.all ?? ["budget-envelopes"], envelopes);
    queryClient.setQueryData(queryKeys.spending?.all ?? ["spend-entries"], spending);
    queryClient.setQueryData(["finance-summary"], summary);

    return queryClient;
  }, [bills, envelopes, spending, summary]);

  const dehydratedState = useMemo(() => dehydrate(client), [client]);

  return (
    <QueryClientProvider client={client}>
      <HydrationBoundary state={dehydratedState}>{children}</HydrationBoundary>
    </QueryClientProvider>
  );
}
