export default function CalendarEventsPage() {
  return (
    <div className="grid gap-6 px-4 py-6 lg:px-0">
      <section className="rounded-3xl bg-[#111728] p-6 shadow-lg shadow-black/20">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Events</h1>
        <p className="mt-2 text-sm text-slate-400">
          Detailed event timelines will surface here once the calendar redesign lands.
        </p>
      </section>
      <div className="rounded-3xl border border-white/5 bg-[#101522] p-6 text-sm text-slate-400">
        Existing calendar views remain available via the More menu while we transition.
      </div>
    </div>
  );
}
