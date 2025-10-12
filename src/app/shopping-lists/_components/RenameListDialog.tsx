"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { renameList } from "../_lib/api";

export type RenameListDialogProps = {
  listId: string;
  initialTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed?: (title: string) => void;
};

export function RenameListDialog({ listId, initialTitle, open, onOpenChange, onRenamed }: RenameListDialogProps) {
  const [title, setTitle] = useState(initialTitle);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Please provide a list name.");
      return;
    }

    startTransition(async () => {
      try {
        const cleanTitle = title.trim();
        await renameList({ id: listId, title: cleanTitle });
        toast.success("List renamed");
        onRenamed?.(cleanTitle);
        onOpenChange(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to rename list";
        toast.error(message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setTitle(initialTitle) : null, onOpenChange(next))}>
      <DialogContent className="border-white/10 bg-[#101522] text-slate-100">
        <DialogHeader>
          <DialogTitle>Rename list</DialogTitle>
          <DialogDescription>Update the name shown in your sidebar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="rename-list-title" className="text-xs text-slate-400">
            List name
          </Label>
          <Input
            id="rename-list-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Costco run"
            className="bg-[#0b101d] text-sm"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RenameListDialog;
