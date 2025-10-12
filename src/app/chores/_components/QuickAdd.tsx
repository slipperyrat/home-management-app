"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { createChore } from "../_lib/api";
import type { ChoreFilters, HouseholdMember } from "../_lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type QuickAddProps = {
  filters: ChoreFilters;
  members: HouseholdMember[];
};

export function QuickAdd({ filters, members }: QuickAddProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | undefined>(filters.assignee ?? undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (filters.assignee) {
      setAssigneeId(filters.assignee);
    }
  }, [filters.assignee]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "a" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const input = document.querySelector<HTMLInputElement>("[data-chores-quick-add-input]");
        if (input) {
          event.preventDefault();
          input.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const dueDateLabel = useMemo(() => {
    if (!dueDate) return "Due date (optional)";
    return format(dueDate, "PPP");
  }, [dueDate]);

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Add a chore title to continue");
      return;
    }

    startTransition(async () => {
      try {
        await createChore({
          title: title.trim(),
          assignedTo: assigneeId ?? filters.assignee ?? null,
          category: filters.tag ?? null,
          dueAt: dueDate ? dueDate.toISOString() : null,
        });
        setTitle("");
        setDueDate(undefined);
        toast.success("Chore created");
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create chore";
        toast.error(message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#0b101d] p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="quick-add-title" className="text-xs uppercase tracking-wide text-slate-400">
          Quick add chore
        </Label>
        <Input
          id="quick-add-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Take out trash"
          className="h-10 rounded-xl border-white/10 bg-[#101522] text-sm text-white placeholder:text-slate-500"
          data-chores-quick-add-input
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-slate-400">Assignee</Label>
          <Select value={assigneeId ?? ""} onValueChange={(value) => setAssigneeId(value || undefined)}>
            <SelectTrigger className="h-10 rounded-xl border-white/10 bg-[#101522] text-left text-sm text-white">
              <SelectValue placeholder="Anyone" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#101522] text-slate-100">
              <SelectItem value="">Anyone</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name ?? member.email ?? "Household member"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-slate-400">Due date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-10 w-full justify-start rounded-xl border-white/10 bg-[#101522] text-sm text-white",
                  !dueDate && "text-slate-500"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dueDateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto border-white/10 bg-[#101522] p-0 text-slate-100" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={(date) => setDueDate(date ?? undefined)}
                initialFocus
              />
              <div className="flex items-center justify-between border-t border-white/10 p-2 text-xs text-slate-400">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setDueDate(undefined)}>
                  Clear
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={pending}
        className="rounded-xl bg-blue-500 text-white"
        data-chores-quick-add
      >
        <Plus className="mr-2 h-4 w-4" /> {pending ? "Adding..." : "Add chore"}
      </Button>
    </div>
  );
}


