"use client";

import { useState, useTransition } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryKeys } from "@/lib/react-query/config";

type CreateSpendPayload = {
  description: string;
  amount: number;
  transaction_date: string;
};

async function createSpendEntry(payload: CreateSpendPayload) {
  const response = await fetch("/api/finance/spend-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      payment_method: "other",
      source: "manual",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create spend entry");
  }

  return response.json();
}

export function SpendingQuickAdd() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [pending, startTransition] = useTransition();

  const mutation = useMutation({
    mutationFn: createSpendEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spending.all });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("Expense added");
      setDescription("");
      setAmount("");
      startTransition(() => router.refresh());
    },
    onError: () => {
      toast.error("Failed to add expense");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!description.trim() || !amount) {
      toast.error("Enter a description and amount");
      return;
    }

    mutation.mutate({
      description: description.trim(),
      amount: Number.parseFloat(amount),
      transaction_date: transactionDate,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/5 bg-[#101522] p-4">
      <div className="space-y-2">
        <Label htmlFor="quick-spend-description" className="text-xs uppercase tracking-wide text-slate-400">
          Description
        </Label>
        <Input
          id="quick-spend-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="e.g., Grocery run"
          className="rounded-xl border-white/10 bg-[#0b0f1a]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quick-spend-amount" className="text-xs uppercase tracking-wide text-slate-400">
            Amount
          </Label>
          <Input
            id="quick-spend-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="120.75"
            className="rounded-xl border-white/10 bg-[#0b0f1a]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quick-spend-date" className="text-xs uppercase tracking-wide text-slate-400">
            Date
          </Label>
          <Input
            id="quick-spend-date"
            type="date"
            value={transactionDate}
            onChange={(event) => setTransactionDate(event.target.value)}
            className="rounded-xl border-white/10 bg-[#0b0f1a]"
          />
        </div>
      </div>

      <Button type="submit" className="w-full rounded-xl" disabled={mutation.isPending || pending}>
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Adding…
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </>
        )}
      </Button>
    </form>
  );
}
