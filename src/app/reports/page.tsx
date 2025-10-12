export default function ReportsPage() {
  return (
    <div className="grid gap-6 px-4 py-6 lg:px-0">
      <section className="rounded-3xl bg-[#111728] p-6 shadow-lg shadow-black/20">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Reports</h1>
        <p className="mt-2 text-sm text-slate-400">
          Deep insights into household productivity, finances, and energy usage will surface here.
        </p>
      </section>
      <div className="rounded-3xl border border-white/5 bg-[#101522] p-6 text-sm text-slate-400">
        Reporting dashboards are in-flight; existing exports remain available through the API.
      </div>
    </div>
  );
}
