"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { updateNotes } from "../_lib/api";

const SAVE_DELAY_MS = 1500;

export type NotesAreaProps = {
  listId: string;
  initialValue: string | null;
  onSaved?: (value: string) => void;
};

export function NotesArea({ listId, initialValue, onSaved }: NotesAreaProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initialValue ?? "");
    setDirty(false);
  }, [initialValue]);

  const debouncedValue = useDebounced(value, SAVE_DELAY_MS);

  useEffect(() => {
    if (!dirty) return;

    const controller = new AbortController();
    setSaving(true);

    updateNotes({ listId, notes: debouncedValue })
      .then(() => {
        toast.success("Notes saved");
        onSaved?.(debouncedValue);
        setDirty(false);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to save notes";
        toast.error(message);
      })
      .finally(() => {
        setSaving(false);
      });

    return () => {
      controller.abort();
    };
  }, [debouncedValue, dirty, listId, onSaved]);

  const status = useMemo(() => {
    if (saving) return "Saving...";
    if (dirty) return "Unsaved";
    return "Saved";
  }, [dirty, saving]);

  return (
    <section className="space-y-3 rounded-2xl border border-white/5 bg-[#0b101d] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Notes</h2>
          <p className="text-xs text-slate-500">Keep reminders, substitutions, or prep steps handy.</p>
        </div>
        <Badge variant={saving ? "secondary" : dirty ? "outline" : "default"} className="text-xs">
          {status}
        </Badge>
      </div>

      <Textarea
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setDirty(true);
        }}
        placeholder="Add prep notes, substitutions, or reminders for this run"
        className="min-h-[160px] resize-none border-white/10 bg-[#0b101d] text-sm text-slate-200 placeholder:text-slate-500"
      />

      <Separator className="bg-white/5" />

      <div className="flex justify-end gap-2 text-xs text-slate-500">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setValue(initialValue ?? "")}
          disabled={!dirty || saving}
        >
          Reset
        </Button>
      </div>
    </section>
  );
}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debounced;
}
