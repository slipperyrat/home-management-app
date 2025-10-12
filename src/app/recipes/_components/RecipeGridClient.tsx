"use client";

import { useState } from "react";
import type { RecipeSummary } from "../_lib/types";
import { RecipeCard } from "./RecipeCard";

export function RecipeGridClient({ recipes }: { recipes: RecipeSummary[] }) {
  const [items, setItems] = useState(recipes);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          onFavoriteChange={(next) =>
            setItems((prev) => prev.map((item) => (item.id === recipe.id ? { ...item, isFavorite: next } : item)))
          }
        />
      ))}
    </div>
  );
}
