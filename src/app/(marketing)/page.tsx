export const dynamic = 'force-dynamic'

export default function MarketingHome() {
  return (
    <main className="mx-auto grid max-w-5xl gap-12 px-4 py-16 text-slate-100">
      <section className="space-y-4 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Plan. Shop. Share. Keep your home in sync.</h1>
        <p className="mx-auto max-w-2xl text-sm text-slate-400">
          The modern household companion for meal planning, shopping lists, chores, and shared calendars. Everything you
          need to stay organized in one beautifully designed workspace.
        </p>
      </section>

      <section className="grid gap-6 rounded-3xl border border-white/10 bg-[#101522] p-8 shadow-lg shadow-black/20">
        <header className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">In the kitchen</p>
          <h2 className="text-2xl font-semibold text-white">Recipes connect to your planner and grocery runs</h2>
          <p className="max-w-2xl text-sm text-slate-400">
            Import recipes, keep favorites, and push ingredients straight to your weekly shopping list. We handle nutrition
            hints and pantry overlaps so you never double-buy.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {["One-click grocery sync", "Weekly meal planner", "Household favorites"].map((feature) => (
            <div key={feature} className="rounded-2xl border border-white/5 bg-[#0b101d] p-5 text-sm text-slate-300">
              <p className="text-white">{feature}</p>
              <p className="mt-2 text-xs text-slate-500">
                Save time with guided workflows that connect recipes, shopping lists, and calendar events together.
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-white/10 bg-[#101522] p-8 shadow-lg shadow-black/20">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Sync everything</p>
          <h2 className="text-2xl font-semibold text-white">Your dashboards, calendars, and chores stay in focus</h2>
          <p className="max-w-2xl text-sm text-slate-400">
            See upcoming events, track chore assignments, and keep quick actions a click away. Every module shares the same
            dark-first aesthetic for a consistent experience.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {["Household dashboard", "Shared calendar", "Automated reminders"].map((feature) => (
            <div key={feature} className="rounded-2xl border border-white/5 bg-[#0b101d] p-5 text-sm text-slate-300">
              <p className="text-white">{feature}</p>
              <p className="mt-2 text-xs text-slate-500">
                Deep integrations let you jump between modules without losing context or repeating steps.
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
