"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Command, PiggyBank, Receipt, PlusCircle, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function FinanceQuickActionsDrawer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleNavigate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="group flex items-center gap-2 rounded-3xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
          <Command className="h-4 w-4" />
          Quick Actions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl border border-white/10 bg-[#0b101d] text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Finance shortcuts</DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            Jump straight into common finance tasks like adding expenses or creating envelopes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-2xl border border-white/10 bg-white/5 text-left text-white hover:bg-white/10"
            onClick={() => handleNavigate("/finance/bills/new")}
          >
            <PlusCircle className="h-4 w-4" />
            Add bill
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-2xl border border-white/10 bg-white/5 text-left text-white hover:bg-white/10"
            onClick={() => handleNavigate("/finance/spending/new")}
          >
            <Receipt className="h-4 w-4" />
            Add expense
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-2xl border border-white/10 bg-white/5 text-left text-white hover:bg-white/10"
            onClick={() => handleNavigate("/finance/budgets/new")}
          >
            <PiggyBank className="h-4 w-4" />
            Create envelope
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-2xl border border-white/10 bg-white/5 text-left text-white hover:bg-white/10"
            onClick={() => handleNavigate("/finance/settings")}
          >
            <Settings2 className="h-4 w-4" />
            Finance settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
