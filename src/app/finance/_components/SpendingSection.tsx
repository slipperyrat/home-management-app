'use client';

import { useMemo, useState } from "react";
import { DollarSign, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { SpendEntryDto } from "../_lib/types";

interface SpendingSectionProps {
  entries: SpendEntryDto[];
}

export function SpendingSection({ entries }: SpendingSectionProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "amount">("newest");

  const categories = useMemo(() => {
    const unique = new Set<string>();
    entries.forEach((entry) => {
      if (entry.category) {
        unique.add(entry.category);
      }
    });
    return Array.from(unique).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalized = searchValue.trim().toLowerCase();

    return entries
      .filter((entry) => {
        const matchesCategory = categoryFilter === "all" || entry.category === categoryFilter;
        if (!matchesCategory) return false;

        if (!normalized) return true;
        return (
          entry.description.toLowerCase().includes(normalized) ||
          (entry.merchant?.toLowerCase().includes(normalized) ?? false)
        );
      })
      .slice()
      .sort((left, right) => {
        if (sortOrder === "amount") {
          return right.amount - left.amount;
        }
        return new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime();
      });
  }, [entries, categoryFilter, searchValue, sortOrder]);

  return (
    <Card className="rounded-3xl border-white/5 bg-[#0b101d]">
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-white">Spending</CardTitle>
            <CardDescription className="text-sm text-slate-400">
              Latest transactions across your household
            </CardDescription>
          </div>
          <Button variant="secondary" className="rounded-2xl" onClick={() => router.push("/finance/spending/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search transactions"
            className="rounded-2xl border-white/10 bg-[#101522] text-white placeholder:text-slate-500"
          />

          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as typeof categoryFilter)}>
            <SelectTrigger className="rounded-2xl border-white/10 bg-[#101522] text-left text-sm text-white">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#101522] text-slate-100">
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as typeof sortOrder)}>
            <SelectTrigger className="rounded-2xl border-white/10 bg-[#101522] text-left text-sm text-white">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#101522] text-slate-100">
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="amount">Highest amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-[#101522] p-10 text-center">
            <div className="rounded-2xl bg-white/5 p-4 text-4xl">🧾</div>
            <div className="space-y-1">
              <p className="text-lg font-medium text-white">No spending found</p>
              <p className="text-sm text-slate-400">
                {entries.length === 0 ? "Add your first expense to begin tracking spending." : "Adjust your search or filters to see other entries."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#101522] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex flex-1 items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
                    <DollarSign className="h-4 w-4 text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{entry.description}</p>
                    <p className="text-xs text-slate-400">
                      {entry.merchant ? `${entry.merchant} • ` : ""}
                      {new Date(entry.transactionDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {entry.envelope ? (
                    <Badge variant="outline" className="border border-white/10 text-xs text-slate-200">
                      {entry.envelope.name}
                    </Badge>
                  ) : null}
                  <span className="text-base font-semibold text-rose-300">
                    -${entry.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
