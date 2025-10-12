export function ChoreListSkeleton() {
  const sectionPlaceholders = ["bucket-1", "bucket-2", "bucket-3"];
  const rowPlaceholders = ["row-1", "row-2", "row-3", "row-4"];

  return (
    <section className="space-y-4 rounded-3xl border border-white/5 bg-[#101522] p-6">
      <div className="h-7 w-40 animate-pulse rounded bg-white/10" />
      <div className="space-y-4">
        {sectionPlaceholders.map((sectionKey) => (
          <div key={sectionKey} className="rounded-2xl border border-white/5 bg-[#0b101d] p-4">
            <div className="mb-3 h-5 w-24 animate-pulse rounded bg-white/5" />
            <div className="space-y-3">
              {rowPlaceholders.map((rowKey) => (
                <div key={`${sectionKey}-${rowKey}`} className="h-12 rounded-xl bg-white/5" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


