"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { addItem } from "../_lib/api";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../_lib/types";

export type AddItemDialogProps = {
  listId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export function AddItemDialog({ listId, open, onOpenChange, onCompleted }: AddItemDialogProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Item name is required");
      return;
    }

    startTransition(async () => {
      try {
        const payload: { listId: string; name: string; quantity?: string; category?: string } = {
          listId,
          name: name.trim(),
        };

        const normalizedQuantity = quantity.trim();
        if (normalizedQuantity) {
          payload.quantity = normalizedQuantity;
        }

        if (category) {
          payload.category = category;
        }

        await addItem(payload);
        toast.success("Item added");
        resetForm();
        onOpenChange(false);
        onCompleted?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add item";
        toast.error(message);
      }
    });
  };

  const resetForm = () => {
    setName("");
    setQuantity("");
    setCategory(undefined);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetForm();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="border-white/10 bg-[#101522] text-slate-100">
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
          <DialogDescription>Quickly capture something you need to pick up.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="add-item-name" className="text-xs text-slate-400">
              Item name
            </Label>
            <Input
              id="add-item-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Eggs"
              className="bg-[#0b101d]"
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="add-item-quantity" className="text-xs text-slate-400">
                Quantity (optional)
              </Label>
              <Input
                id="add-item-quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="e.g. 2 dozen"
                className="bg-[#0b101d]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Category</Label>
              <Select value={category ?? ""} onValueChange={(value) => setCategory(value || undefined)}>
                <SelectTrigger className="bg-[#0b101d]">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#101522] text-slate-100">
                  {CATEGORY_ORDER.map((key) => (
                    <SelectItem key={key} value={key}>
                      {CATEGORY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Adding..." : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddItemDialog;
