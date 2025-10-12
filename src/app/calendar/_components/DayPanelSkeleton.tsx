export function DayPanelSkeleton() {
  return (
    <section className="flex h-full flex-col rounded-3xl border border-white/5 bg-[#101522]">
      <div className="border-b border-white/5 px-6 py-4">
        <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-white/5" />
      </div>
      <div className="flex-1 space-y-3 px-6 py-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-2 rounded-2xl border border-white/5 bg-[#0d121f] p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-full animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </div>
    </section>
  );
}
