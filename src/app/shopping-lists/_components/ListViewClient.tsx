"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Utensils, Plus, MoreVertical, Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  normalizeCategory,
  timeSince,
  type ShoppingListDetail,
  type ShoppingListItem,
} from "../_lib/types";
import { markAllComplete, toggleItem, generateFromMeals } from "../_lib/api";
import { AddItemDialog } from "./AddItemDialog";
import { NotesArea } from "./NotesArea";

export function ListViewClient({ list }: { list: ShoppingListDetail }) {
  const router = useRouter();
  const [isMarkingAll, startMarking] = useTransition();
  const [generatePending, startGenerate] = useTransition();
  const [togglingItemIds, setTogglingItemIds] = useState<string[]>([]);
  const [addItemOpen, setAddItemOpen] = useState(false);

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        key: category,
        label: CATEGORY_LABELS[category],
        items: list.items.filter((item) => normalizeCategory(item.category) === category),
      })).filter((bucket) => bucket.items.length > 0),
    [list.items]
  );

  const handleMarkAllComplete = () => {
    startMarking(async () => {
      try {
        await markAllComplete({ listId: list.id });
        toast.success("All items marked complete");
        router.refresh();
      } catch (error) {
        handleError(error, "Failed to mark all items complete");
      }
    });
  };

  const handleToggleItem = (itemId: string, isComplete: boolean) => {
    setTogglingItemIds((prev) => [...prev, itemId]);
    void toggleItem({ id: itemId, isComplete })
      .then(() => {
        toast.success(isComplete ? "Item completed" : "Item reopened");
        router.refresh();
      })
      .catch((error) => {
        handleError(error, "Failed to update item");
      })
      .finally(() => {
        setTogglingItemIds((prev) => prev.filter((id) => id !== itemId));
      });
  };

  const handleGenerateFromMeals = () => {
    startGenerate(async () => {
      try {
        const currentWeek = new Date(list.updatedAt ?? Date.now()).toISOString().slice(0, 10);
        const { listId } = await generateFromMeals({ weekStartISO: currentWeek });
        toast.success("Generated ingredients from meal plan");
        if (listId && listId !== list.id) {
          router.push(`/shopping-lists/${listId}`);
        }
        router.refresh();
      } catch (error) {
        handleError(error, "Failed to generate from meals");
      }
    });
  };

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-[#101522] p-6 shadow-lg shadow-black/20">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Shopping List</p>
          <h1 className="text-2xl font-semibold text-white">{list.title}</h1>
          <p className="text-xs text-slate-500">Updated {getRelativeTime(list.updatedAt)} ago</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Button variant="outline" size="sm" onClick={() => setAddItemOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
          <Button variant="outline" size="sm" onClick={handleMarkAllComplete} disabled={isMarkingAll}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> {isMarkingAll ? "Marking..." : "Mark All Complete"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateFromMeals} disabled={generatePending}>
            <Utensils className="mr-2 h-4 w-4" /> {generatePending ? "Generating..." : "Generate from Meals"}
          </Button>
        </div>
      </header>

      <Separator className="bg-white/5" />

      <div className="space-y-6">
        {grouped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-slate-400">
            No items yet. Use the Add Item action to start building your list.
          </div>
        ) : (
          grouped.map((group) => (
            <CategorySection
              key={group.key}
              label={group.label}
              items={group.items}
              onToggle={handleToggleItem}
              pendingItems={togglingItemIds}
            />
          ))
        )}
      </div>

      <Separator className="bg-white/5" />

      <NotesArea listId={list.id} initialValue={list.notes} onSaved={() => router.refresh()} />

      <AddItemDialog
        listId={list.id}
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        onCompleted={() => router.refresh()}
      />
    </section>
  );
}

function CategorySection({
  label,
  items,
  onToggle,
  pendingItems,
}: {
  label: string;
  items: ShoppingListItem[];
  onToggle: (itemId: string, isComplete: boolean) => void;
  pendingItems: string[];
}) {
  const completedCount = items.filter((item) => item.isComplete).length;
  return (
    <section className="rounded-2xl border border-white/5 bg-[#0b101d] p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</h3>
        <Badge variant="secondary" className="bg-white/5 text-[11px] text-slate-400">
          {completedCount}/{items.length} complete
        </Badge>
      </header>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border border-transparent bg-[#121a2b] p-3 text-sm transition",
              item.isComplete ? "opacity-60" : "hover:border-white/10"
            )}
          >
            <div className="flex items-center gap-3">
              <Checkbox
                id={`item-${item.id}`}
                checked={item.isComplete}
                disabled={pendingItems.includes(item.id)}
                onCheckedChange={(checked) => onToggle(item.id, Boolean(checked))}
                className="h-5 w-5 rounded border-white/20 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500"
              />
              <label htmlFor={`item-${item.id}`} className="cursor-pointer">
                <p className={cn("font-medium", item.isComplete ? "text-slate-400 line-through" : "text-white")}>{item.name}</p>
                {item.quantity ? <p className="text-xs text-slate-500">{item.quantity}</p> : null}
                {item.notes ? <p className="text-[11px] text-slate-500">{item.notes}</p> : null}
              </label>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 border-white/10 bg-[#101522] text-slate-200">
                <DropdownMenuItem disabled className="cursor-not-allowed">
                  <Edit className="mr-2 h-4 w-4" /> Edit (soon)
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="cursor-not-allowed text-red-400">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete (soon)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    </section>
  );
}

function getRelativeTime(iso?: string | null) {
  return iso ? timeSince(iso) : "just now";
}

function handleError(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  toast.error(message);
}
