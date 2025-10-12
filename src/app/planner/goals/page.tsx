export default function PlannerGoalsPage() {
  return (
    <div className="grid gap-6 px-4 py-6 lg:px-0">
      <section className="rounded-3xl bg-[#111728] p-6 shadow-lg shadow-black/20">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Goals</h1>
        <p className="mt-2 text-sm text-slate-400">
          Track household goals, milestones, and streaks. Goal boards will light up here as the new planner experience ships.
        </p>
      </section>
      <div className="rounded-3xl border border-white/5 bg-[#101522] p-6 text-sm text-slate-400">
        Current goals remain accessible via legacy planner views.
      </div>
    </div>
  );
}
