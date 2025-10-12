import { Suspense } from "react";

import { groupChores } from "../_lib/grouping";
import type { ChoreFilters, HouseholdMember } from "../_lib/types";
import type { ListChoresResponse } from "../_lib/api";

import { ChoreRow } from "./ChoreRow";
import { QuickAdd } from "./QuickAdd";

export async function ChoreList({
  choresPromise,
  membersPromise,
  filters,
}: {
  choresPromise: Promise<ListChoresResponse>;
  membersPromise: Promise<HouseholdMember[]>;
  filters: ChoreFilters;
}) {
  const { chores } = await choresPromise;
  const members = await membersPromise;
  const grouped = groupChores(chores);

  const hasChores = grouped.some((bucket) => bucket.chores.length > 0);

  return (
    <section className="space-y-6 rounded-3xl border border-white/5 bg-[#101522] p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Household chores</h1>
          <p className="text-sm text-slate-400">Organize, assign, and track progress across the household.</p>
        </div>
        <Suspense fallback={null}>
          <QuickAdd filters={filters} members={members} />
        </Suspense>
      </header>

      {!hasChores ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {grouped.map((bucket) => (
            <section key={bucket.key} className="rounded-3xl border border-white/5 bg-[#0b101d] p-4">
              <header className="mb-4 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{bucket.label}</h2>
                <span className="text-xs text-slate-500">{bucket.chores.length} chore(s)</span>
              </header>

              <ul className="space-y-3">
                {bucket.chores.map((chore) => (
                  <li key={chore.id}>
                    <ChoreRow
                      chore={chore}
                      members={members}
                      onNavigate={(direction) => {
                        const selector = direction === "next" ? "next" : "previous";
                        const rowElements = Array.from(
                          document.querySelectorAll<HTMLDivElement>("[data-chores-row]")
                        );
                        const currentIndex = rowElements.findIndex((element) => element.contains(document.activeElement));
                        if (currentIndex === -1) {
                          return;
                        }
                        const nextIndex = selector === "next" ? currentIndex + 1 : currentIndex - 1;
                        const nextElement = rowElements[nextIndex];
                        if (nextElement) {
                          nextElement.focus();
                        }
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-[#0b101d] p-10 text-center">
      <h2 className="text-lg font-medium text-white">No chores yet</h2>
      <p className="mt-2 text-sm text-slate-400">
        Get started by adding your first chore. Assign it to a household member, set due dates, and track progress.
      </p>
    </div>
  );
}


