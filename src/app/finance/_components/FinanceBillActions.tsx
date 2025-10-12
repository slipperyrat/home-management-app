"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCcw, Plus, CheckCircle, FilterX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FinanceBillActionsProps {
  onMarkAllPaid?: () => Promise<void>;
  onResetFilters?: () => void;
}

export function FinanceBillActions({ onMarkAllPaid, onResetFilters }: FinanceBillActionsProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
      toast.success("Finance data refreshed");
    });
  };

  const handleMarkAllPaid = async () => {
    if (!onMarkAllPaid) {
      toast.error("Bulk mark paid is unavailable");
      return;
    }

    try {
      await onMarkAllPaid();
      toast.success("All pending bills marked as paid");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mark bills";
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleRefresh} disabled={refreshing}>
        <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      </Button>

      {onResetFilters ? (
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={onResetFilters}>
          <FilterX className="h-4 w-4" />
        </Button>
      ) : null}

      {onMarkAllPaid ? (
        <Button variant="secondary" size="sm" className="rounded-xl" onClick={handleMarkAllPaid}>
          <CheckCircle className="mr-2 h-4 w-4" />
          Mark all paid
        </Button>
      ) : null}

      <Button
        variant="secondary"
        size="sm"
        className="rounded-xl"
        onClick={() => router.push("/finance/bills/new")}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Bill
      </Button>
    </div>
  );
}
