"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { ChoreDto, HouseholdMember } from "../_lib/types";
import { toggleChoreCompletion } from "../_lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RowActions } from "./RowActions";

type ChoreRowProps = {
  chore: ChoreDto;
  members: HouseholdMember[];
  onNavigate?: (direction: "next" | "previous") => void;
};

export function ChoreRow({ chore, members, onNavigate }: ChoreRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localCompleted, setLocalCompleted] = useState(Boolean(chore.completedAt));
  const rowRef = useRef<HTMLDivElement>(null);
  const xpEnabled = useMemo(() => chore.xpReward != null && chore.xpReward > 0, [chore.xpReward]);
  const xpBadgeText = useMemo(() => {
    if (!xpEnabled) return null;
    return `+${chore.xpReward ?? 0} XP`;
  }, [chore.xpReward, xpEnabled]);

  const handleToggle = useCallback(() => {
    const nextCompleted = !localCompleted;
    setLocalCompleted(nextCompleted);

    startTransition(async () => {
      try {
        await toggleChoreCompletion({ id: chore.id, completed: nextCompleted, xp: chore.xpReward ?? 10 });
        if (nextCompleted && xpEnabled) {
          toast.success(`Chore completed! +${chore.xpReward ?? 0} XP`);
        } else {
          toast.success(nextCompleted ? "Chore completed" : "Chore reopened");
        }
        router.refresh();
      } catch (error) {
        setLocalCompleted(!nextCompleted);
        const message = error instanceof Error ? error.message : "Failed to update chore";
        toast.error(message);
      }
    });
  }, [chore.id, chore.xpReward, localCompleted, router, xpEnabled]);

  const dueLabel = chore.dueAt
    ? formatDistanceToNowStrict(new Date(chore.dueAt), { addSuffix: true })
    : "No due date";

  useEffect(() => {
    const node = rowRef.current;
    if (!node) return;

    node.setAttribute("tabindex", "0");

    const handleKeydown = (event: KeyboardEvent) => {
      if (!node.contains(document.activeElement)) {
        return;
      }

      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        handleToggle();
      }

      if (event.key === "j" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        onNavigate?.("next");
      }

      if (event.key === "k" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        onNavigate?.("previous");
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [handleToggle, onNavigate]);

  return (
    <div
      ref={rowRef}
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-transparent bg-[#121a2b] p-4 text-sm transition",
        localCompleted ? "opacity-60" : "hover:border-white/10"
      )}
      data-chores-row
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        disabled={pending}
        className={cn(
          "h-9 w-9 rounded-full border border-white/10 text-slate-300 hover:bg-white/10",
          localCompleted && "border-blue-500 bg-blue-500/10 text-blue-400"
        )}
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
      </Button>

      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("font-medium", localCompleted ? "text-slate-400 line-through" : "text-white")}>{chore.title}</p>
          <Badge variant="outline" className="border-white/10 bg-white/5 text-[11px] uppercase tracking-wide text-slate-300">
            {chore.priority}
          </Badge>
          {chore.category ? (
            <Badge variant="outline" className="border-white/10 bg-white/5 text-[11px] text-slate-300">
              {chore.category}
            </Badge>
          ) : null}
          {xpBadgeText ? (
            <Badge variant="secondary" className="border-blue-500/40 bg-blue-500/10 text-[10px] text-blue-300">
              {xpBadgeText}
            </Badge>
          ) : null}
        </div>
        {chore.description ? <p className="mt-1 text-xs text-slate-400">{chore.description}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{dueLabel}</span>
          {chore.assignedToName ? <span>• Assigned to {chore.assignedToName}</span> : null}
          {chore.tags.length ? (
            <span>
              • Tags: {chore.tags.join(", ")}
            </span>
          ) : null}
        </div>
      </div>

      <RowActions chore={chore} members={members} onChange={() => router.refresh()} />
    </div>
  );
}


