import { Suspense } from "react";
import Link from "next/link";

import { listRecipes } from "./_lib/api";
import { RecipeFiltersClient } from "./_components/RecipeFiltersClient";
import { RecipeGridClient } from "./_components/RecipeGridClient";
import { RecipeListSkeleton } from "./_components/RecipeListSkeleton";

export const dynamic = "force-dynamic";

export default async function RecipesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const query = typeof searchParams?.q === "string" ? searchParams?.q : "";
  const tag = typeof searchParams?.tag === "string" ? searchParams?.tag : undefined;

  const recipesPromise = listRecipes({ query, tag });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Kitchen</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Recipes</h1>
          <p className="mt-2 text-sm text-slate-400">
            Capture favorites, import new meals, and push ingredients into your weekly plan.
          </p>
        </div>
        <Link
          href="/recipes/create"
          className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:text-white"
        >
          Create recipe
        </Link>
      </header>

      <section className="rounded-3xl border border-white/5 bg-[#101522] p-6 shadow-lg shadow-black/20">
        <RecipeFiltersClient defaultQuery={query} defaultTag={tag} />
        <div className="mt-6">
          <Suspense fallback={<RecipeListSkeleton />}>
            <RecipesGridSection recipesPromise={recipesPromise} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

async function RecipesGridSection({ recipesPromise }: { recipesPromise: ReturnType<typeof listRecipes> }) {
  const recipes = await recipesPromise;
  if (recipes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-400">
        No recipes yet. Create one or import from a URL to get started.
      </div>
    );
  }
  return <RecipeGridClient recipes={recipes} />;
}
