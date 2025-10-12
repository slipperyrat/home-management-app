import type { ChoreFilters, ChoreTag, HouseholdMember } from "../_lib/types";
import { FiltersSidebarClient } from "./FiltersSidebarClient";

export async function FiltersSidebar({
  filters,
  membersPromise,
  tagsPromise,
}: {
  filters: ChoreFilters;
  membersPromise: Promise<HouseholdMember[]>;
  tagsPromise: Promise<ChoreTag[]>;
}) {
  const [members, tags] = await Promise.all([membersPromise, tagsPromise]);

  return <FiltersSidebarClient filters={filters} members={members} tags={tags} />;
}


