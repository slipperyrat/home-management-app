import Link from "next/link";

import { listRecipes } from "../recipes/_lib/api";

export const dynamic = "force-dynamic";

const spotlightModules = [
  { title: "Calendar", href: "/calendar", description: "Upcoming events and shared schedules." },
  { title: "Chores", href: "/chores", description: "Assignments queued for the household." },
  { title: "Planner", href: "/planner", description: "Goal tracking and daily priorities." },
];

export default async function DashboardPage() {
  const latestRecipes = await listRecipes({ limit: 2 });

  return (
    <div className="grid gap-6 px-4 py-6 lg:px-0">
      <section className="rounded-3xl bg-[#111728] p-6 shadow-lg shadow-black/20">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">
          A serene view of your household. We surface meals, events, and chores here as the redesign rolls out.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/recipes"
          className="rounded-3xl border border-white/5 bg-[#101522] px-5 py-6 transition hover:border-white/10 hover:text-white"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">Recipes</p>
          <p className="mt-3 text-lg font-medium text-white">Latest additions</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            {latestRecipes.length === 0 ? (
              <span className="text-slate-500">No recipes yet. Create your first recipe.</span>
            ) : (
              latestRecipes.map((recipe) => (
                <div key={recipe.id} className="flex items-center justify-between text-xs">
                  <span className="line-clamp-1 text-slate-200">{recipe.title}</span>
                  <span className="text-slate-500">{recipe.servings ? `${recipe.servings} servings` : "New"}</span>
                </div>
              ))
            )}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Jump into the kitchen hub</p>
        </Link>

        {spotlightModules.map((module) => (
          <Link
            key={module.title}
            href={module.href}
            className="rounded-3xl border border-white/5 bg-[#101522] px-5 py-6 transition hover:border-white/10 hover:text-white"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">{module.title}</p>
            <p className="mt-3 text-lg font-medium text-white">Coming soon</p>
            <p className="mt-1 text-xs text-slate-500">{module.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
} 