"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { DateTime } from "luxon";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { createMealPlan, importRecipeFromUrl, listRecipes } from "../_lib/api";
import { isoToDayKey, type WeekCell } from "../_lib/types";
import { cn } from "@/lib/utils";

type TabValue = "quick" | "attach" | "url";

export type NewMealDialogProps = {
  open: boolean;
  cell: WeekCell | null;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export function NewMealDialog({ open, cell, onOpenChange, onCompleted }: NewMealDialogProps) {
  const [pendingTab, setPendingTab] = useState<TabValue>("quick");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [importUrl, setImportUrl] = useState("https://");
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [recipes, setRecipes] = useState<Awaited<ReturnType<typeof listRecipes>>>([]);
  const [isSearching, startSearch] = useTransition();
  const [isSubmitting, startSubmit] = useTransition();

  const dayLabel = useMemo(() => {
    if (!cell) return "";
    return DateTime.fromISO(cell.dateISO).toFormat("EEEE, LLL d");
  }, [cell]);

  const mealLabel = useMemo(() => cell?.mealType ?? " meal", [cell]);

  const closeDialog = useCallback(() => {
    onOpenChange(false);
    setTitle("");
    setNotes("");
    setImportUrl("https://");
    setSelectedRecipe(null);
    setSearchQuery("");
    setRecipes([]);
    setPendingTab("quick");
  }, [onOpenChange]);

  const handleSearch = useCallback(() => {
    startSearch(async () => {
      try {
        const next = await listRecipes({ query: searchQuery, limit: 10 });
        setRecipes(next);
      } catch (error) {
        console.error(error);
        toast.error("Failed to search recipes");
      }
    });
  }, [searchQuery]);

  const handleSubmit = useCallback(() => {
    if (!cell) {
      toast.error("No meal slot selected");
      return;
    }

    startSubmit(async () => {
      try {
        if (pendingTab === "attach" && !selectedRecipe) {
          toast.error("Choose a recipe to attach");
          return;
        }

        const basePayload = {
          weekStartISO: cell.dateISO, // Assuming cell.dateISO is the week start
          dayKey: isoToDayKey(cell.dateISO),
          mealType: cell.mealType,
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };

        if (pendingTab === "url") {
          const result = await importRecipeFromUrl(importUrl);
          await createMealPlan({ ...basePayload, recipeId: result.id });
          toast.success("Recipe imported");
        } else if (pendingTab === "attach" && selectedRecipe) {
          await createMealPlan({ ...basePayload, recipeId: selectedRecipe });
          toast.success("Recipe attached");
        } else {
          await createMealPlan(basePayload);
          toast.success("Meal saved");
        }

        onCompleted?.();
        closeDialog();
      } catch (error) {
        console.error(error);
        toast.error("Failed to save meal");
      }
    });
  }, [cell, selectedRecipe, pendingTab, importUrl, title, notes, onCompleted, closeDialog]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add meal</DialogTitle>
          <DialogDescription>{dayLabel} · {mealLabel}</DialogDescription>
        </DialogHeader>

        <Tabs value={pendingTab} onValueChange={(value) => setPendingTab(value as TabValue)} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quick">Quick</TabsTrigger>
            <TabsTrigger value="attach">Attach Recipe</TabsTrigger>
            <TabsTrigger value="url">Paste URL</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="space-y-4">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Meal title" />
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Notes" />
          </TabsContent>

          <TabsContent value="attach" className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search recipes"
              />
              <Button type="button" onClick={handleSearch} disabled={isSearching}>
                {isSearching ? "Searching…" : "Search"}
              </Button>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-white/10 p-2">
              {recipes.length === 0 ? (
                <p className="text-xs text-slate-500">Search to find recipes to attach.</p>
              ) : (
                recipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => setSelectedRecipe(recipe.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                      selectedRecipe === recipe.id
                        ? "border-blue-400/50 bg-blue-400/10 text-white"
                        : "border-white/10 bg-transparent text-slate-200 hover:border-white/20 hover:text-white"
                    )}
                  >
                    <p className="font-medium">{recipe.title}</p>
                    <p className="text-xs text-slate-400">
                      {recipe.servings ? `${recipe.servings} servings` : "Servings TBD"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <Input value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="https://" />
            <p className="text-xs text-slate-500">
              Paste a recipe URL and we’ll try to import the ingredients automatically.
            </p>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save meal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

