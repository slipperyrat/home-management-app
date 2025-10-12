import { notFound } from "next/navigation";
import { Suspense } from "react";

import { listAll, getList } from "../_lib/api";
import { ListsSidebar } from "../_components/ListsSidebar";
import { ListView } from "../_components/ListView";

export const dynamic = "force-dynamic";

type ShoppingListDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShoppingListDetailPage({ params }: ShoppingListDetailPageProps) {
  const resolvedParams = await params;
  const listId = resolvedParams.id;

  const [lists, activeList] = await Promise.all([listAll(), getList({ id: listId })]);

  if (!activeList) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:flex-row lg:px-0">
      <aside className="w-full lg:w-1/4">
        <Suspense fallback={<ListsSidebarSkeleton />}>
          <ListsSidebar initialLists={lists} activeListId={listId} />
        </Suspense>
      </aside>

      <main className="w-full lg:w-3/4">
        <Suspense fallback={<ListViewSkeleton />}>
          <ListView list={activeList} />
        </Suspense>
      </main>
    </div>
  );
}

function ListsSidebarSkeleton() {
  return (
    <div className="space-y-4 rounded-3xl border border-white/5 bg-[#101522] p-6 shadow-lg shadow-black/20">
      <div className="h-8 w-3/4 animate-pulse rounded-lg bg-white/10" />
      <div className="h-6 w-full animate-pulse rounded-md bg-white/5" />
      <div className="h-6 w-full animate-pulse rounded-md bg-white/5" />
      <div className="h-6 w-1/2 animate-pulse rounded-md bg-white/5" />
    </div>
  );
}

function ListViewSkeleton() {
  return (
    <div className="space-y-6 rounded-3xl border border-white/5 bg-[#101522] p-6 shadow-lg shadow-black/20">
      <div className="h-10 w-full animate-pulse rounded-lg bg-white/10" />
      <div className="h-40 w-full animate-pulse rounded-lg bg-white/5" />
      <div className="h-40 w-full animate-pulse rounded-lg bg-white/5" />
    </div>
  );
}
