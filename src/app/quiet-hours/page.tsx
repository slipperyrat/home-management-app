export const dynamic = "force-dynamic";

export default function QuietHoursPage() {
  return (
    <div className="grid gap-6 px-4 py-6 lg:px-0">
      <section className="rounded-3xl bg-[#111728] p-6 shadow-lg shadow-black/20">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Quiet Hours</h1>
        <p className="mt-2 text-sm text-slate-400">
          Configure notification windows for calmer evenings and focused mornings. Updated controls will appear here soon.
        </p>
      </section>
      <div className="rounded-3xl border border-white/5 bg-[#101522] p-6 text-sm text-slate-400">
        Existing quiet hours settings remain accessible in upcoming redesign steps.
      </div>
    </div>
  );
}
