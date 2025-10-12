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

interface EnvelopeQuickAddProps {
  householdId: string;
}

type CreateEnvelopePayload = {
  name: string;
  allocated_amount: number;
  period_start: string;
  period_end: string;
};

async function createEnvelope(payload: CreateEnvelopePayload) {
  const response = await fetch("/api/finance/budget-envelopes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      color: "#3B82F6",
      category: "general",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create envelope");
  }

  return response.json();
}

export function EnvelopeQuickAdd({ householdId }: EnvelopeQuickAddProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().split("T")[0]);
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split("T")[0]);
  const [pending, startTransition] = useTransition();

  const mutation = useMutation({
    mutationFn: createEnvelope,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.byHousehold(householdId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("Envelope created");
      setName("");
      setAmount("");
      startTransition(() => router.refresh());
    },
    onError: () => {
      toast.error("Failed to create envelope");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim() || !amount) {
      toast.error("Enter a name and amount");
      return;
    }

    mutation.mutate({
      name: name.trim(),
      allocated_amount: Number.parseFloat(amount),
      period_start: periodStart,
      period_end: periodEnd,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/5 bg-[#101522] p-4">
      <div className="space-y-2">
        <Label htmlFor="quick-envelope-name" className="text-xs uppercase tracking-wide text-slate-400">
          Name
        </Label>
        <Input
          id="quick-envelope-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Groceries"
          className="rounded-xl border-white/10 bg-[#0b0f1a]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quick-envelope-amount" className="text-xs uppercase tracking-wide text-slate-400">
            Allocated amount
          </Label>
          <Input
            id="quick-envelope-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="500"
            className="rounded-xl border-white/10 bg-[#0b0f1a]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quick-envelope-start" className="text-xs uppercase tracking-wide text-slate-400">
            Period start
          </Label>
          <Input
            id="quick-envelope-start"
            type="date"
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
            className="rounded-xl border-white/10 bg-[#0b0f1a]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quick-envelope-end" className="text-xs uppercase tracking-wide text-slate-400">
            Period end
          </Label>
          <Input
            id="quick-envelope-end"
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
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
            Create Envelope
          </>
        )}
      </Button>
    </form>
  );
}
