"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { generateShoppingListForWeek } from "../_lib/api";

export function WeekActions({ weekStart }: { weekStart: string }) {
  const router = useRouter();
  const [isGenerating, startGenerating] = useTransition();

  const handleGenerate = () => {
    startGenerating(async () => {
      try {
        const result = await generateShoppingListForWeek({ weekStartISO: weekStart });
        router.refresh();
        toast.success(result.message ?? "Shopping list ready", {
          action: {
            label: "Open",
            onClick: () => router.push(`/shopping-lists`),
          },
        });
      } catch (error) {
        console.error(error);
        toast.error("Failed to generate shopping list");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? "Generating…" : "Generate shopping list"}
      </Button>
      <Button variant="ghost" disabled>
        Copy last week (coming soon)
      </Button>
    </div>
  );
}

