"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// helper
type DebouncedHandler = (query: string, tag?: string) => void;

function createDebounce(handler: DebouncedHandler, delay: number): DebouncedHandler {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return (query: string, tag?: string) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => handler(query, tag), delay);
  };
}

export type RecipeFiltersProps = {
  defaultQuery?: string;
  defaultTag?: string;
  tags?: string[];
};

const DEFAULT_TAGS = ["Quick", "Vegetarian", "Dessert", "Meal Prep", "Favorites"];

export function RecipeFiltersClient({ defaultQuery = "", defaultTag, tags = DEFAULT_TAGS }: RecipeFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingQuery, setPendingQuery] = useState(defaultQuery);
  const [activeTag, setActiveTag] = useState<string | undefined>(defaultTag);
  const [isTransitioning, startTransition] = useTransition();

  const updateRoute = useCallback(
    (nextQuery: string, nextTag?: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      nextQuery ? params.set("q", nextQuery) : params.delete("q");
      nextTag ? params.set("tag", nextTag) : params.delete("tag");
      startTransition(() => {
        router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`);
        router.refresh();
      });
    },
    [searchParams, pathname, router]
  );

  const scheduleUpdate = useMemo(() => createDebounce(updateRoute, 300), [updateRoute]);

  const handleTagClick = (tag: string) => {
    const nextTag = activeTag === tag ? undefined : tag;
    setActiveTag(nextTag);
    scheduleUpdate(pendingQuery, nextTag);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Input
          value={pendingQuery}
          onChange={(event) => {
            const { value } = event.target;
            setPendingQuery(value);
            scheduleUpdate(value, activeTag);
          }}
          placeholder="Search recipes"
          className="bg-[#0d121f] text-white placeholder:text-slate-500"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={isTransitioning}
          className="text-xs text-slate-300"
          onClick={() => updateRoute(pendingQuery, activeTag)}
        >
          {isTransitioning ? "Searching…" : "Search"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className={cn(
              "cursor-pointer rounded-full border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-white/40",
              activeTag === tag && "border-white/60 bg-white/10 text-white"
            )}
            onClick={() => handleTagClick(tag)}
          >
            {tag}
          </Badge>
        ))}
      </div>
    </section>
  );
}
