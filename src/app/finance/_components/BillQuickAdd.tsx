"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryKeys } from "@/lib/react-query/config";

interface BillQuickAddProps {
  householdId: string;
}

type CreateBillPayload = {
  title: string;
  amount: number;
  due_date: string;
};

async function createBill(payload: CreateBillPayload) {
  const response = await fetch("/api/finance/bills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      currency: "AUD",
      priority: "medium",
      source: "manual",
      name: payload.title,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create bill");
  }

  return response.json();
}

export function BillQuickAdd({ householdId }: BillQuickAddProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [pending, startTransition] = useTransition();

  const mutation = useMutation({
    mutationFn: createBill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bills.byHousehold(householdId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bills.all });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("Bill created");
      setTitle("");
      setAmount("");
      startTransition(() => router.refresh());
    },
    onError: () => {
      toast.error("Failed to create bill");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim() || !amount) {
      toast.error("Enter a title and amount");
      return;
    }

    mutation.mutate({
      title: title.trim(),
      amount: Number.parseFloat(amount),
      due_date: dueDate,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/5 bg-[#101522] p-4">
      <div className="space-y-2">
        <Label htmlFor="quick-bill-title" className="text-xs uppercase tracking-wide text-slate-400">
          Title
        </Label>
        <Input
          id="quick-bill-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g., Electricity bill"
          className="rounded-xl border-white/10 bg-[#0b0f1a]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quick-bill-amount" className="text-xs uppercase tracking-wide text-slate-400">
            Amount
          </Label>
          <Input
            id="quick-bill-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="89.50"
            className="rounded-xl border-white/10 bg-[#0b0f1a]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quick-bill-due" className="text-xs uppercase tracking-wide text-slate-400">
            Due date
          </Label>
          <Input
            id="quick-bill-due"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="rounded-xl border-white/10 bg-[#0b0f1a]"
          />
        </div>
      </div>

      <Button type="submit" className="w-full rounded-xl" disabled={mutation.isPending || pending}>
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating…
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Add Bill
          </>
        )}
      </Button>
    </form>
  );
}
