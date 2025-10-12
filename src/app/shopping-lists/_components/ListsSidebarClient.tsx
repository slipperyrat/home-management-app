"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit3, MoreVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { createList } from "../_lib/api";
import { timeSince, type SidebarList } from "../_lib/types";
import { RenameListDialog } from "./RenameListDialog";
import { DeleteListDialog } from "./DeleteListDialog";

export type ListsSidebarClientProps = {
  initialLists: SidebarList[];
  activeListId?: string;
};

export function ListsSidebarClient({ initialLists, activeListId }: ListsSidebarClientProps) {
  const router = useRouter();
  const [lists, setLists] = useState(initialLists);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("Weekly Groceries");
  const [renameDialog, setRenameDialog] = useState<{ id: string; title: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; title: string } | null>(null);

  const [isCreating, startCreating] = useTransition();

  const sortedLists = useMemo(() => lists.slice().sort(sortByUpdated), [lists]);

  const handleCreate = () => {
    if (!createTitle.trim()) {
      toast.error("Please provide a list name.");
      return;
    }

    startCreating(async () => {
      try {
        const title = createTitle.trim();
        const { id } = await createList({ title });
        const now = new Date().toISOString();

        setLists((prev) => [...prev, { id, title, itemCount: 0, updatedAt: now }]);
        toast.success("List created");
        setCreateOpen(false);
        setCreateTitle("Weekly Groceries");
        router.push(`/shopping-lists/${id}`);
        router.refresh();
      } catch (error) {
        handleError(error, "Failed to create list");
      }
    });
  };

  const handleRenamed = (id: string, title: string) => {
    setLists((prev) => prev.map((list) => (list.id === id ? { ...list, title } : list)));
    router.refresh();
  };

  const handleDeleted = (id: string) => {
    setLists((prev) => prev.filter((list) => list.id !== id));
    router.refresh();

    if (activeListId === id) {
      const next = sortedLists.find((list) => list.id !== id);
      router.push(next ? `/shopping-lists/${next.id}` : "/shopping-lists");
    }
  };

  return (
    <aside className="rounded-3xl border border-white/5 bg-[#101522] p-6 shadow-lg shadow-black/20">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Shopping Lists</p>
          <h2 className="text-lg font-semibold text-white">Your Lists</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex items-center gap-1 text-xs text-slate-300 hover:text-white"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" /> New List
        </Button>
      </header>

      <Separator className="my-4 bg-white/5" />

      <nav className="space-y-2">
        {sortedLists.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
            No shopping lists yet. Create one to get started.
          </div>
        ) : (
          sortedLists.map((list) => (
            <ListRow
              key={list.id}
              list={list}
              isActive={list.id === activeListId}
              onRename={() => setRenameDialog({ id: list.id, title: list.title })}
              onDelete={() => setDeleteDialog({ id: list.id, title: list.title })}
            />
          ))
        )}
      </nav>

      <CreateListDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={createTitle}
        onTitleChange={setCreateTitle}
        onSubmit={handleCreate}
        pending={isCreating}
      />

      <RenameListDialog
        listId={renameDialog?.id ?? ""}
        initialTitle={renameDialog?.title ?? ""}
        open={renameDialog !== null}
        onOpenChange={(open) => setRenameDialog(open ? renameDialog : null)}
        onRenamed={(title) => {
          if (renameDialog) {
            handleRenamed(renameDialog.id, title);
            setRenameDialog(null);
          }
        }}
      />

      <DeleteListDialog
        listId={deleteDialog?.id ?? ""}
        title={deleteDialog?.title ?? ""}
        open={deleteDialog !== null}
        onOpenChange={(open) => setDeleteDialog(open ? deleteDialog : null)}
        onDeleted={() => {
          if (deleteDialog) {
            handleDeleted(deleteDialog.id);
            setDeleteDialog(null);
          }
        }}
      />
    </aside>
  );
}

function ListRow({
  list,
  isActive,
  onRename,
  onDelete,
}: {
  list: SidebarList;
  isActive: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#0b101d] p-3 text-sm transition",
        isActive ? "border-blue-500/40 bg-blue-500/10" : "hover:border-white/10"
      )}
    >
      <Link
        href={`/shopping-lists/${list.id}`}
        className={cn("flex-1 truncate text-left", isActive ? "text-white" : "text-slate-300")}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">{list.title}</span>
          <span className="text-[11px] uppercase tracking-wide text-slate-500">{list.itemCount} items</span>
        </div>
        <p className="text-[11px] text-slate-500">Updated {timeSince(list.updatedAt)} ago</p>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="left" align="start" className="w-40 border-white/10 bg-[#101522] text-slate-200">
          <DropdownMenuItem className="cursor-pointer" onSelect={onRename}>
            <Edit3 className="mr-2 h-4 w-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer text-red-400 focus:text-red-300" onSelect={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CreateListDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  onTitleChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => {
      onOpenChange(next);
      if (!next) {
        onTitleChange("Weekly Groceries");
      }
    }}>
      <DialogContent className="border-white/10 bg-[#101522] text-slate-100">
        <DialogHeader>
          <DialogTitle>Create shopping list</DialogTitle>
          <DialogDescription>Give your list a helpful name to stay organised.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="sidebar-new-list-title" className="text-xs text-slate-400">
            List name
          </Label>
          <Input
            id="sidebar-new-list-title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="e.g. Weekly groceries"
            className="bg-[#0b101d] text-sm"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={pending}>
            {pending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sortByUpdated(a: SidebarList, b: SidebarList) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function handleError(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  toast.error(message);
}
