export function RecipeListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => {
        const key = `recipe-skeleton-${index + 1}`;
        return <div key={key} className="h-24 animate-pulse rounded-2xl bg-white/10" />;
      })}
    </div>
  );
}
