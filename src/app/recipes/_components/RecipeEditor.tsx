"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { updateRecipe } from "../_lib/api";
import type { RecipeDetail } from "../_lib/types";
import type { AnalysisResult } from "../_lib/nutrition";
import { offlineStorage } from "@/lib/offlineStorage";

export type RecipeEditorProps = {
  recipe: RecipeDetail;
  mode?: "edit" | "create";
  insights?: AnalysisResult;
};

export function RecipeEditor({ recipe, mode = "edit", insights }: RecipeEditorProps) {
  const [formData, setFormData] = useState({
    title: recipe.title,
    description: recipe.description ?? "",
    servings: recipe.servings ?? 1,
    notes: recipe.notes ?? "",
  });
  const [isSaving, startSaving] = useTransition();

  const persistDraft = (next: typeof formData) => {
    setFormData(next);
    void offlineStorage.storeData("recipe", { id: recipe.id, draft: next }).catch(() => null);
  };

  const handleSubmit = () => {
    startSaving(async () => {
      try {
        await updateRecipe({
          id: recipe.id,
          title: formData.title,
          description: formData.description,
          servings: formData.servings,
          notes: formData.notes,
        });
        toast.success("Recipe updated");
        await offlineStorage.clearSyncedData();
      } catch {
        toast.error("Failed to save recipe");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-[#101522] p-6 shadow-lg shadow-black/20">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{mode === "edit" ? "Edit" : "Create"}</p>
          <h1 className="text-2xl font-semibold text-white">{recipe.title}</h1>
        </div>
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          value={formData.title}
          onChange={(event) => persistDraft({ ...formData, title: event.target.value })}
          placeholder="Recipe title"
          className="bg-[#0d121f] text-white"
        />
        <Input
          type="number"
          min={1}
          value={formData.servings}
          onChange={(event) => persistDraft({ ...formData, servings: Number(event.target.value) })}
          className="bg-[#0d121f] text-white"
        />
      </div>

      <Textarea
        value={formData.description}
        onChange={(event) => persistDraft({ ...formData, description: event.target.value })}
        placeholder="Description"
        className="min-h-[120px] bg-[#0d121f] text-sm text-slate-200"
      />

      {insights ? (
        <div className="rounded-2xl border border-white/5 bg-[#0b101d] p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-wide text-slate-500">Nutrition (estimated)</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-white">
            <Badge variant="outline" className="border-white/10">
              {Math.round(insights.nutrition.calories)} kcal
            </Badge>
            <Badge variant="outline" className="border-white/10">
              Protein {Math.round(insights.nutrition.protein)} g
            </Badge>
            <Badge variant="outline" className="border-white/10">
              Carbs {Math.round(insights.nutrition.carbs)} g
            </Badge>
            <Badge variant="outline" className="border-white/10">
              Fat {Math.round(insights.nutrition.fat)} g
            </Badge>
          </div>
          {insights.pantryMatches.length > 0 ? (
            <p className="mt-3 text-xs text-slate-400">
              Pantry items on hand: {insights.pantryMatches.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <Textarea
        value={formData.notes}
        onChange={(event) => persistDraft({ ...formData, notes: event.target.value })}
        placeholder="Notes"
        className="min-h-[120px] bg-[#0d121f] text-sm text-slate-200"
      />
    </div>
  );
}
