import { Suspense } from "react";
import Link from "next/link";
import { DateTime } from "luxon";

import { getWeekPlans, listRecipes, type WeekPlanEntry } from "./_lib/api";
import { mapPlanEntriesToGridMeals } from "./_lib/types";
import WeekGrid from "./_components/WeekGrid";
import { WeekActions } from "./_components/WeekActions";
import { RecipesPanel } from "./_components/RecipesPanel";

export const dynamic = "force-dynamic";

export default async function MealsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const weekParam = typeof searchParams?.week === "string" ? searchParams.week : undefined;
  const weekStart = getWeekStart(weekParam);

  const plannerPromise = getWeekPlans({ weekStart });
  const recipesPromise = listRecipes({ limit: 20 });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Planner</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Meal Planner</h1>
          <p className="mt-2 text-sm text-slate-400">
            Plan meals, attach recipes, and gather ingredients without leaving the page.
          </p>
        </div>
        <Suspense fallback={<WeekSwitcherSkeleton />}>
          <WeekSwitcher weekStart={weekStart} />
        </Suspense>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="rounded-3xl border border-white/5 bg-[#101522] p-6 shadow-lg shadow-black/20">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">This Week</h2>
              <p className="text-sm text-slate-400">Breakfast, lunch, and dinner across the current week.</p>
            </div>
            <WeekActions weekStart={weekStart} />
          </header>
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
            <Suspense fallback={<GridSkeleton />}>
              <WeekGridSection plannerPromise={plannerPromise} weekStart={weekStart} />
            </Suspense>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-white/5 bg-[#101522] p-6 shadow-lg shadow-black/20">
            <Suspense fallback={<RecipesSkeleton />}>
              <RecipesPanelSection recipesPromise={recipesPromise} />
            </Suspense>
          </section>
        </aside>
      </main>
    </div>
  );
}

function getWeekStart(weekParam?: string): string {
  const base = weekParam ? DateTime.fromISO(weekParam) : DateTime.now();
  const valid = base.isValid ? base.startOf("day") : DateTime.now().startOf("day");
  const monday = valid.weekday === 1 ? valid : valid.minus({ days: (valid.weekday + 6) % 7 });
  return monday.toISODate();
}

async function WeekSwitcher({ weekStart }: { weekStart: string }) {
  const current = DateTime.fromISO(weekStart, { setZone: true });
  const previousWeek = current.minus({ weeks: 1 }).toISODate();
  const nextWeek = current.plus({ weeks: 1 }).toISODate();
  const endOfWeek = current.plus({ days: 6 });

  return (
    <nav className="flex items-center gap-2 text-sm text-slate-300">
      <WeekNavButton href={`/meals?week=${previousWeek}`}>Previous</WeekNavButton>
      <span className="rounded-lg border border-white/10 bg-[#0d121f] px-3 py-1 font-medium text-white">
        {current.toFormat("LLL d")} – {endOfWeek.toFormat("LLL d")}
      </span>
      <WeekNavButton href={`/meals?week=${nextWeek}`}>Next</WeekNavButton>
      <WeekNavButton href="/meals">This Week</WeekNavButton>
    </nav>
  );
}

function WeekNavButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-white/20 hover:text-white"
    >
      {children}
    </Link>
  );
}

async function WeekGridSection({
  plannerPromise,
  weekStart,
}: {
  plannerPromise: Promise<WeekPlanEntry[]>;
  weekStart: string;
}) {
  const planner = await plannerPromise;
  const gridMeals = mapPlanEntriesToGridMeals(planner);

  return <WeekGrid weekStart={weekStart} meals={gridMeals} />;
}

async function RecipesPanelSection({
  recipesPromise,
}: {
  recipesPromise: ReturnType<typeof listRecipes>;
}) {
  const recipes = await recipesPromise;
  return <RecipesPanel initialRecipes={recipes} />;
}

function WeekSwitcherSkeleton() {
  return <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />;
}

function GridSkeleton() {
  return <div className="h-[420px] w-full animate-pulse rounded-2xl bg-white/10" />;
}

function RecipesSkeleton() {
  return (
    <div className="space-y-3">
      {["one", "two", "three"].map((token) => (
        <div key={`recipe-skel-${token}`} className="h-20 animate-pulse rounded-2xl bg-white/10" />
      ))}
    </div>
  );
}
