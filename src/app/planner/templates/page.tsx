export default function PlannerTemplatesPage() {
  return (
    <div className="grid gap-6 px-4 py-6 lg:px-0">
      <section className="rounded-3xl bg-[#111728] p-6 shadow-lg shadow-black/20">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Planner Templates</h1>
        <p className="mt-2 text-sm text-slate-400">
          Reusable task and routine templates will make planning faster. We’re aligning their new design with the planner overhaul.
        </p>
      </section>
      <div className="rounded-3xl border border-white/5 bg-[#101522] p-6 text-sm text-slate-400">
        Template gallery temporarily offline while we migrate existing presets.
      </div>
    </div>
  );
}
