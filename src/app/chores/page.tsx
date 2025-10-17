import { Suspense } from "react";

import { getCurrentHousehold } from "@/lib/server/canAccessFeature";

import { listChores, listMembers, listTags } from "./_lib/api";
import type { ChoreFilters } from "./_lib/types";
import { FiltersSidebar } from "./_components/FiltersSidebar";
import { ChoreList } from "./_components/ChoreList";
import { ChoreListSkeleton } from "./_components/ChoreListSkeleton";
import { FiltersSkeleton } from "./_components/FiltersSkeleton";

type ChoresPageProps = {
  searchParams?: ChoreFilters;
};

export default async function ChoresPage({ searchParams }: ChoresPageProps) {
  const household = await getCurrentHousehold();
  if (!household) {
    return (
      <div className="px-6 py-10">
        <div className="rounded-3xl border border-white/5 bg-[#101522] p-10 text-center text-slate-300">
          You need a household to manage chores.
        </div>
      </div>
    );
  }

  const filters: ChoreFilters = {
    view: searchParams?.view ?? "all",
    ...(searchParams?.status ? { status: searchParams.status } : {}),
    ...(searchParams?.assignee ? { assignee: searchParams.assignee } : {}),
    ...(searchParams?.tag ? { tag: searchParams.tag } : {}),
  };

  const choresPromise = listChores(filters);
  const membersPromise = listMembers();
  const tagsPromise = listTags();

  return (
    <div className="grid gap-6 px-4 py-6 lg:grid-cols-[320px_1fr] lg:px-8">
      <Suspense fallback={<FiltersSkeleton />}>
        <FiltersSidebar filters={filters} membersPromise={membersPromise} tagsPromise={tagsPromise} />
      </Suspense>
      <Suspense fallback={<ChoreListSkeleton />}>
        <ChoreList choresPromise={choresPromise} membersPromise={membersPromise} filters={filters} />
      </Suspense>
    </div>
  );
}


