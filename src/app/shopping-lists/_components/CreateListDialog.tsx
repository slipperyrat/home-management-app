"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createList } from "../_lib/api";

export function CreateListDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Weekly Groceries");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Please provide a list name.");
      return;
    }

    startTransition(async () => {
      try {
        const { id } = await createList({ title: title.trim() });
        toast.success("List created");
        setOpen(false);
        setTitle("Weekly Groceries");
        router.push(`/shopping-lists/${id}`);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create list";
        toast.error(message);
      }
    });
  };

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Create your first list
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[#101522] text-slate-100">
          <DialogHeader>
            <DialogTitle>Create shopping list</DialogTitle>
            <DialogDescription>Choose a name that helps you recognise the list later.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label htmlFor="index-new-list-title" className="text-xs text-slate-400">
              List Name
            </Label>
            <Input
              id="index-new-list-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Family groceries"
              className="bg-[#0b101d] text-sm"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
