import type { SidebarList } from "../_lib/types";
import { ListsSidebarClient } from "./ListsSidebarClient";

export type ListsSidebarProps = {
  initialLists: SidebarList[];
  activeListId?: string;
};

export function ListsSidebar({ initialLists, activeListId }: ListsSidebarProps) {
  return <ListsSidebarClient initialLists={initialLists} activeListId={activeListId} />;
}

export { ListsSidebarClient };

export default ListsSidebar;
