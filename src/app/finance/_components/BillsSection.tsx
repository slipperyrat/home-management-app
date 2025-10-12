'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, AlertCircle, Clock, Calendar } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { BillDto, FinanceSummary } from "../_lib/types";
import { FinanceBillActions } from "./FinanceBillActions";
import { BillQuickAdd } from "./BillQuickAdd";
import { SpendingQuickAdd } from "./SpendingQuickAdd";

const STATUS_ORDER: BillDto["status"][] = ["pending", "overdue", "paid", "cancelled"];
const STATUS_LABEL: Record<BillDto["status"], string> = {
  pending: "Pending",
  overdue: "Overdue",
  paid: "Paid",
  cancelled: "Cancelled",
};

function statusIcon(status: BillDto["status"]) {
  switch (status) {
    case "paid":
      return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    case "overdue":
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    case "pending":
      return <Clock className="h-4 w-4 text-amber-400" />;
    default:
      return <Calendar className="h-4 w-4 text-slate-500" />;
  }
}

function statusBadge(status: BillDto["status"]) {
  const variants = {
    paid: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    overdue: "bg-red-500/10 text-red-300 border-red-500/20",
    pending: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    cancelled: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  } as const;

  return variants[status] ?? variants.pending;
}

interface BillsSectionProps {
  bills: BillDto[];
  summary: FinanceSummary["bills"];
  householdId: string;
}

export function BillsSection({ bills, summary, householdId }: BillsSectionProps) {
  const [billState, setBillState] = useState<BillDto[]>(bills);
  const [statusFilter, setStatusFilter] = useState<BillDto["status"] | "all">("all");
  const [searchValue, setSearchValue] = useState("");
  const [sortOrder, setSortOrder] = useState<"dueDate" | "amount">("dueDate");

  useEffect(() => {
    setBillState(bills);
  }, [bills]);

  const resetFilters = useCallback(() => {
    setStatusFilter("all");
    setSearchValue("");
    setSortOrder("dueDate");
  }, []);

  const filteredBills = useMemo(() => {
    const normalized = searchValue.trim().toLowerCase();

    return billState
      .filter((bill) => {
        const matchesStatus = statusFilter === "all" || bill.status === statusFilter;
        if (!matchesStatus) {
          return false;
        }

        if (!normalized) {
          return true;
        }

        return (
          bill.title.toLowerCase().includes(normalized) ||
          (bill.description?.toLowerCase().includes(normalized) ?? false)
        );
      })
      .slice()
      .sort((left, right) => {
        if (sortOrder === "amount") {
          return right.amount - left.amount;
        }

        return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
      });
  }, [billState, searchValue, sortOrder, statusFilter]);

  const filteredSummary = useMemo(() => {
    const pending = filteredBills.filter((bill) => bill.status === "pending");
    const overdue = filteredBills.filter((bill) => bill.status === "overdue");
    const amountDue = pending.reduce((sum, bill) => sum + bill.amount, 0);

    return {
      total: filteredBills.length,
      pending: pending.length,
      overdue: overdue.length,
      amountDue,
    };
  }, [filteredBills]);

  const updateBillStatus = useCallback(async (billId: string, status: BillDto["status"], optimistic?: boolean) => {
    setBillState((prev) =>
      prev.map((bill) => (bill.id === billId ? { ...bill, status } : bill)),
    );

    try {
      const response = await fetch(`/api/finance/bills/${billId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update bill");
      }

      if (!optimistic) {
        toast.success("Bill updated");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update bill";
      toast.error(message);
      setBillState((prev) =>
        prev.map((bill) =>
          bill.id === billId ? { ...bill, status: bills.find((b) => b.id === billId)?.status ?? bill.status } : bill,
        ),
      );
    }
  }, [bills]);

  const handleStatusSelect = useCallback(
    async (billId: string, nextStatus: BillDto["status"]) => {
      if (billState.find((bill) => bill.id === billId)?.status === nextStatus) {
        return;
      }
      await updateBillStatus(billId, nextStatus);
    },
    [billState, updateBillStatus],
  );

  const markAllPaid = useCallback(async () => {
    const pendingBills = billState.filter((bill) => bill.status === "pending");
    if (pendingBills.length === 0) {
      toast.info("No pending bills to mark as paid");
      return;
    }

    try {
      await Promise.all(pendingBills.map((bill) => updateBillStatus(bill.id, "paid", true)));
      toast.success("All pending bills marked as paid");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mark bills";
      toast.error(message);
    }
  }, [billState, updateBillStatus]);

  return (
    <Card className="rounded-3xl border-white/5 bg-[#0b101d]">
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-white">Bills</CardTitle>
            <CardDescription className="text-sm text-slate-400">
              {filteredSummary.total > 0
                ? `${filteredSummary.pending} pending • ${filteredSummary.overdue} overdue • $${filteredSummary.amountDue.toFixed(2)} due`
                : summary
                ? `${summary.pending} pending • ${summary.overdue} overdue`
                : "Manage household bills"}
            </CardDescription>
          </div>
          <FinanceBillActions
            householdId={householdId}
            onMarkAllPaid={markAllPaid}
            onResetFilters={resetFilters}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search bills"
            className="rounded-2xl border-white/10 bg-[#101522] text-white placeholder:text-slate-500"
          />

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className="rounded-2xl border-white/10 bg-[#101522] text-left text-sm text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#101522] text-slate-100">
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_ORDER.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as typeof sortOrder)}>
            <SelectTrigger className="rounded-2xl border-white/10 bg-[#101522] text-left text-sm text-white">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#101522] text-slate-100">
              <SelectItem value="dueDate">Due date</SelectItem>
              <SelectItem value="amount">Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <BillQuickAdd householdId={householdId} />
          <SpendingQuickAdd />
        </div>
        {filteredBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-[#101522] p-12 text-center">
            <div className="rounded-2xl bg-white/5 p-4 text-4xl">💳</div>
            <div className="space-y-1">
              <p className="text-lg font-medium text-white">No bills found</p>
              <p className="text-sm text-slate-400">
                {billState.length === 0
                  ? "Create your first bill to start tracking due dates."
                  : "Adjust your search or filters to see other bills."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBills.map((bill) => (
              <div
                key={bill.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-[#101522] p-4 shadow-sm shadow-black/10 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex flex-1 items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
                    {statusIcon(bill.status)}
                  </div>
                  <div>
                    <p className="text-base font-medium text-white">{bill.title}</p>
                    <p className="text-sm text-slate-400">
                      {bill.description ? `${bill.description} • ` : ""}
                      Due {new Date(bill.dueAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-base font-semibold text-white">${bill.amount.toFixed(2)}</p>
                    <Badge variant="outline" className={`mt-1 border ${statusBadge(bill.status)}`}>
                      {STATUS_LABEL[bill.status]}
                    </Badge>
                  </div>

                  <Select value={bill.status} onValueChange={(value) => handleStatusSelect(bill.id, value as BillDto["status"]) }>
                    <SelectTrigger className="w-[140px] rounded-xl border-white/10 bg-[#0b111f] text-sm text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#101522] text-slate-100">
                      {STATUS_ORDER.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
