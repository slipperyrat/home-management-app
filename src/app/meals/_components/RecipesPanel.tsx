"use client";

import { useTransition, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";

import { listRecipes } from "../_lib/api";
import type { RecipeSummary } from "../_lib/types";

export type RecipesPanelProps = {
  initialRecipes: RecipeSummary[];
  onSearch?: () => void;
};

export function RecipesPanel({ initialRecipes, onSearch }: RecipesPanelProps) {
  const [recipes, setRecipes] = useState<RecipeSummary[]>(initialRecipes);
  const [query, setQuery] = useState("");
  const [isSearching, startSearching] = useTransition();

  const hasResults = recipes.length > 0;

  const handleSearch = useCallback(() => {
    startSearching(async () => {
      try {
        const next = await listRecipes({ query, limit: 20 });
        setRecipes(next);
        onSearch?.();
      } catch (error) {
        console.error(error);
        toast.error("Failed to search recipes");
      }
    });
  }, [query, onSearch]);

  const placeholder = useMemo(
    () => (hasResults ? "Search recipes" : "Try searching for a recipe"),
    [hasResults]
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Recipes</h2>
            <p className="text-sm text-slate-400">Browse your saved recipes to attach them to the plan.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
          />
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white transition hover:border-white/20"
            onClick={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? "Searching…" : "Search"}
          </button>
        </div>
      </header>

      <div className="space-y-3">
        {recipes.length === 0 ? (
          <p className="text-sm text-slate-500">No recipes yet. Import one from a URL or create a recipe first.</p>
        ) : (
          recipes.map((recipe) => (
            <article
              key={recipe.id}
              className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-[#0d121f] p-4"
            >
              <div>
                <p className="text-sm font-medium text-white">{recipe.title}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {recipe.servings ? `${recipe.servings} servings` : "Servings TBD"}
                </p>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

