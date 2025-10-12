export function FinanceShellSkeleton() {
  const cardPlaceholders = Array.from({ length: 4 }, (_, index) => index);
  const billPlaceholders = Array.from({ length: 5 }, (_, index) => index);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-white/10" />
        <div className="h-4 w-64 animate-pulse rounded bg-white/5" />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cardPlaceholders.map((index) => (
          <div
            key={`finance-card-${index}`}
            className="rounded-3xl border border-white/5 bg-[#0b101d] p-6"
          >
            <div className="mb-4 h-4 w-24 animate-pulse rounded bg-white/10" />
            <div className="h-8 w-20 animate-pulse rounded bg-white/10" />
            <div className="mt-3 h-3 w-32 animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-white/5 bg-[#0b101d] p-6">
            <div className="mb-6 h-5 w-40 animate-pulse rounded bg-white/10" />
            <div className="space-y-4">
              {billPlaceholders.map((index) => (
                <div
                  key={`bill-row-${index}`}
                  className="h-16 rounded-2xl border border-white/5 bg-[#101522]"
                />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-[#0b101d] p-6">
            <div className="mb-6 h-5 w-52 animate-pulse rounded bg-white/10" />
            <div className="space-y-3">
              {billPlaceholders.slice(0, 4).map((index) => (
                <div
                  key={`spend-row-${index}`}
                  className="h-14 rounded-2xl border border-white/5 bg-[#101522]"
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-white/5 bg-[#0b101d] p-6">
            <div className="mb-4 h-5 w-40 animate-pulse rounded bg-white/10" />
            <div className="space-y-3">
              {billPlaceholders.slice(0, 3).map((index) => (
                <div
                  key={`envelope-${index}`}
                  className="h-20 rounded-2xl border border-white/5 bg-[#101522]"
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
