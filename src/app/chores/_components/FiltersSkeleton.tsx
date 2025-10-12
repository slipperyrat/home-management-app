export function FiltersSkeleton() {
  const primaryPlaceholders = ["filter-1", "filter-2", "filter-3", "filter-4"];
  const tagPlaceholders = [
    "tag-1",
    "tag-2",
    "tag-3",
    "tag-4",
    "tag-5",
    "tag-6",
  ];

  return (
    <aside className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-[#0b101d] p-6">
      <div className="h-6 w-32 animate-pulse rounded-full bg-white/5" />
      <div className="space-y-3">
        {primaryPlaceholders.map((placeholder) => (
          <div key={placeholder} className="h-10 rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-5 w-24 animate-pulse rounded bg-white/5" />
        {tagPlaceholders.map((placeholder) => (
          <div key={placeholder} className="h-8 rounded-lg bg-white/5" />
        ))}
      </div>
    </aside>
  );
}


