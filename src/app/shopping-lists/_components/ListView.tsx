import type { ShoppingListDetail } from "../_lib/types";
import { ListViewClient } from "./ListViewClient";

export type ListViewProps = {
  list: ShoppingListDetail;
};

export function ListView({ list }: ListViewProps) {
  return <ListViewClient list={list} />;
}

export { ListViewClient };

export default ListView;
