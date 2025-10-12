"use client";

import { useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toggleRecipeFavorite } from "../_lib/api";
import type { RecipeSummary } from "../_lib/types";

export type RecipeCardProps = {
  recipe: RecipeSummary;
  onSelect?: (recipe: RecipeSummary) => void;
  onAddToList?: (recipe: RecipeSummary) => void;
  onAddToPlan?: (recipe: RecipeSummary) => void;
  onFavoriteChange?: (nextFavorite: boolean) => void;
};

export function RecipeCard({ recipe, onSelect, onAddToList, onAddToPlan, onFavoriteChange }: RecipeCardProps) {
  const [isToggling, startToggle] = useTransition();

  const handleFavorite = () => {
    startToggle(async () => {
      const { isFavorite } = await toggleRecipeFavorite({ id: recipe.id });
      onFavoriteChange?.(isFavorite);
    });
  };

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#0b101d] p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">{recipe.title}</h3>
          {recipe.description ? (
            <p className="text-xs text-slate-400 line-clamp-2">{recipe.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-white/10 text-[11px] text-slate-300">
            {recipe.servings ? `${recipe.servings} servings` : "Servings TBD"}
          </Badge>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "h-8 w-8 rounded-full border border-white/10 text-slate-300 hover:text-white",
              recipe.isFavorite && "border-pink-500/40 text-pink-400 hover:text-pink-300"
            )}
            onClick={handleFavorite}
            disabled={isToggling}
            aria-label={recipe.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={cn("h-4 w-4", recipe.isFavorite && "fill-current")} />
          </Button>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-2 text-xs text-slate-400">
        <div>
          <dt className="uppercase tracking-wide">Prep</dt>
          <dd className="text-white">{recipe.prepMinutes ?? "—"}m</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">Cook</dt>
          <dd className="text-white">{recipe.cookMinutes ?? "—"}m</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">Updated</dt>
          <dd className="text-white text-[11px] opacity-80">{new Date(recipe.updatedAt).toLocaleDateString()}</dd>
        </div>
      </dl>

      {recipe.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {recipe.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="bg-white/5 text-[10px] text-slate-300">
              {tag}
            </Badge>
          ))}
          {recipe.tags.length > 3 ? (
            <Badge variant="secondary" className="bg-white/5 text-[10px] text-slate-300">
              +{recipe.tags.length - 3}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <footer className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 text-xs text-slate-200"
          onClick={() => onSelect?.(recipe)}
        >
          View details
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("text-xs", onAddToPlan ? "text-slate-200" : "hidden")}
          onClick={() => onAddToPlan?.(recipe)}
        >
          Add to plan
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("text-xs", onAddToList ? "text-slate-200" : "hidden")}
          onClick={() => onAddToList?.(recipe)}
        >
          Add to list
        </Button>
      </footer>
    </article>
  );
}
