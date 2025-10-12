"use client";

import { useMemo, useTransition } from "react";
import { CalendarIcon, MoreVertical, Repeat2, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { DateTime } from "luxon";

import type { ChoreDto, HouseholdMember } from "../_lib/types";
import { deleteChore, updateChore } from "../_lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";

type RowActionsProps = {
  chore: ChoreDto;
  members: HouseholdMember[];
  onChange?: () => void;
};

const REPEAT_PRESETS: Array<{ label: string; value: string | null }> = [
  { label: "No repeat", value: null },
  { label: "Daily", value: "FREQ=DAILY" },
  { label: "Weekly", value: "FREQ=WEEKLY" },
  { label: "Every 2 weeks", value: "FREQ=WEEKLY;INTERVAL=2" },
  { label: "Monthly", value: "FREQ=MONTHLY" },
];

export function RowActions({ chore, members, onChange }: RowActionsProps) {
  const [pending, startTransition] = useTransition();

  const formattedDueDate = useMemo(() => {
    return chore.dueAt ? DateTime.fromISO(chore.dueAt).toFormat("DDD") : "No due date";
  }, [chore.dueAt]);

  const handleAssign = (assigneeId: string | null) => {
    startTransition(async () => {
      try {
        await updateChore({ id: chore.id, assignedTo: assigneeId });
        toast.success(assigneeId ? "Assignee updated" : "Chore unassigned");
        onChange?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update assignee";
        toast.error(message);
      }
    });
  };

  const handleDueDate = (date: Date | undefined) => {
    startTransition(async () => {
      try {
        await updateChore({ id: chore.id, dueAt: date ? date.toISOString() : null });
        toast.success(date ? "Due date updated" : "Due date cleared");
        onChange?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update due date";
        toast.error(message);
      }
    });
  };

  const handleRepeat = (rrule: string | null) => {
    startTransition(async () => {
      try {
        await updateChore({ id: chore.id, rrule });
        toast.success(rrule ? "Repeat schedule updated" : "Repeat removed");
        onChange?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update repeat";
        toast.error(message);
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteChore({ id: chore.id });
        toast.success("Chore deleted");
        onChange?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete chore";
        toast.error(message);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-white" disabled={pending}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 border-white/10 bg-[#101522] text-slate-200">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-slate-400">Manage chore</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <User className="mr-2 h-4 w-4" /> Assign
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64 border-white/10 bg-[#101522] text-slate-100">
            <Select value={chore.assignedTo ?? ""} onValueChange={(value) => handleAssign(value || null)} disabled={pending}>
              <SelectTrigger className="h-9 w-full bg-[#101522] text-left text-sm text-white">
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#101522] text-slate-100">
                <SelectItem value="">Unassigned</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name ?? member.email ?? "Household member"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CalendarIcon className="mr-2 h-4 w-4" /> Due date
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="border-white/10 bg-[#101522] p-3 text-slate-100">
            <p className="mb-2 text-xs text-slate-400">Current: {formattedDueDate}</p>
            <Calendar
              mode="single"
              selected={chore.dueAt ? DateTime.fromISO(chore.dueAt).toJSDate() : undefined}
              onSelect={(date) => handleDueDate(date ?? undefined)}
              initialFocus
            />
            <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => handleDueDate(undefined)}>
              Clear due date
            </Button>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Repeat2 className="mr-2 h-4 w-4" /> Repeat
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="border-white/10 bg-[#101522] text-slate-100">
            <Select value={chore.repeatRrule ?? ""} onValueChange={(value) => handleRepeat(value || null)} disabled={pending}>
              <SelectTrigger className="h-9 w-full bg-[#101522] text-left text-sm text-white">
                <SelectValue placeholder="No repeat" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#101522] text-slate-100">
                {REPEAT_PRESETS.map((preset) => (
                  <SelectItem key={preset.label} value={preset.value ?? ""}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="bg-white/10" />

        <DropdownMenuItem className="text-red-400 focus:text-red-300" onClick={handleDelete} disabled={pending}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete chore
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


