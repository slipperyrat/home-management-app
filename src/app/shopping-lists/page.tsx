import { redirect } from "next/navigation";

import { listAll } from "./_lib/api";
import { CreateListDialog } from "./_components/CreateListDialog";

export const dynamic = "force-dynamic";

export default async function ShoppingListsIndexPage() {
  const lists = await listAll();

  if (lists.length > 0) {
    redirect(`/shopping-lists/${lists[0]?.id}`);
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-6 px-4 py-6 text-center lg:px-0">
      <h1 className="text-3xl font-semibold tracking-tight text-white">No Shopping Lists Yet</h1>
      <p className="text-sm text-slate-400">Create your first shopping list to get started.</p>
      <CreateListDialog />
    </div>
  );
}
