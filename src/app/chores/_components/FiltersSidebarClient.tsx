"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ChoreFilters, ChoreTag, HouseholdMember } from "../_lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VIEW_OPTIONS: Array<{ value: NonNullable<ChoreFilters["view"]>; label: string }> = [
  { value: "all", label: "All chores" },
  { value: "assigned", label: "Assigned to me" },
  { value: "created", label: "Created by me" },
  { value: "completed", label: "Completed" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "active", label: "Active" },
];

type FilterUpdate = {
  view?: ChoreFilters["view"] | null;
  status?: ChoreFilters["status"] | null;
  assignee?: string | null;
  tag?: string | null;
};

export function FiltersSidebarClient({
  filters,
  members,
  tags,
}: {
  filters: ChoreFilters;
  members: HouseholdMember[];
  tags: ChoreTag[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";

  const updateFilters = useCallback(
    (next: FilterUpdate) => {
      const params = new URLSearchParams(searchParamsString);

      (["view", "status", "assignee", "tag"] as const).forEach((key) => {
        const value = next[key];
        if (value === undefined) {
          return;
        }

        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      const queryString = params.toString();
      const targetPath = pathname ?? "/chores";
      router.push(queryString ? `${targetPath}?${queryString}` : targetPath);
    },
    [pathname, router, searchParamsString],
  );

  const focusQuickAdd = () => {
    const input = document.querySelector<HTMLInputElement>("[data-chores-quick-add-input]");
    if (input) {
      input.focus();
    }
  };

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "a" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        focusQuickAdd();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  return (
    <aside className="flex h-full flex-col gap-6 rounded-3xl border border-white/5 bg-[#0b101d] p-6">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">View</h2>
        <Select
          value={filters.view ?? "all"}
          onValueChange={(value) =>
            updateFilters({ view: (value as ChoreFilters["view"]) ?? null })
          }
        >
          <SelectTrigger className="h-9 w-full bg-[#101522] text-left text-sm text-white">
            <SelectValue placeholder="Choose view" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#101522] text-slate-100">
            {VIEW_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Status</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => {
            const isActive = filters.status === option.value;
            return (
              <Badge
                key={option.value}
                variant={isActive ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() =>
                  updateFilters({
                    status: isActive
                      ? null
                      : (option.value as NonNullable<ChoreFilters["status"]>),
                  })
                }
              >
                {option.label}
              </Badge>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assignee</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-400"
            onClick={() => updateFilters({ assignee: null })}
          >
            Reset
          </Button>
        </div>
        <Select
          value={filters.assignee ?? ""}
          onValueChange={(value) => updateFilters({ assignee: value || null })}
        >
          <SelectTrigger className="h-9 w-full bg-[#101522] text-left text-sm text-white">
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
      </section>

      <section className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tags</h2>
          <span className="text-[11px] text-slate-500">{tags.length} tag(s)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag.id}
              variant={filters.tag === tag.id ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                updateFilters({ tag: filters.tag === tag.id ? null : tag.id })
              }
            >
              {tag.label}
              <span className="ml-2 text-[10px] text-slate-400">{tag.count}</span>
            </Badge>
          ))}
          {tags.length === 0 ? <span className="text-xs text-slate-500">No tags yet</span> : null}
        </div>
      </section>

      <footer className="rounded-2xl border border-dashed border-white/10 bg-[#101522] p-4 text-xs text-slate-400">
        <p className="mb-2 font-semibold text-slate-300">Tips</p>
        <p className="mb-1">Press <kbd className="rounded bg-white/10 px-1">a</kbd> to quick-add a chore.</p>
        <p className="mb-1">Use <kbd className="rounded bg-white/10 px-1">j</kbd>/<kbd className="rounded bg-white/10 px-1">k</kbd> to move between chores.</p>
        <p>Hit <kbd className="rounded bg-white/10 px-1">space</kbd> to toggle completion.</p>
      </footer>
    </aside>
  );
}


