import { DateTime } from "luxon";

export type SidebarList = {
  id: string;
  title: string;
  itemCount: number;
  updatedAt: string;
};

export type ShoppingListItem = {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  notes: string | null;
  isComplete: boolean;
};

export type ShoppingListDetail = {
  id: string;
  title: string;
  notes: string | null;
  updatedAt: string;
  items: ShoppingListItem[];
};

export const CATEGORY_LABELS = {
  produce: "Produce",
  dairy: "Dairy & Alternatives",
  meat: "Meat & Seafood",
  pantry: "Pantry Staples",
  frozen: "Frozen",
  bakery: "Bakery",
  beverages: "Beverages",
  snacks: "Snacks",
  household: "Household",
  health: "Health & Personal Care",
  other: "Other",
} as const;

export type CategoryKey = keyof typeof CATEGORY_LABELS;

export const CATEGORY_ORDER: CategoryKey[] = [
  "produce",
  "dairy",
  "meat",
  "pantry",
  "frozen",
  "bakery",
  "beverages",
  "snacks",
  "health",
  "household",
  "other",
];

export function normalizeCategory(value: string | null | undefined): CategoryKey {
  if (!value) return "other";
  const normalized = value.toLowerCase();
  if (normalized in CATEGORY_LABELS) {
    return normalized as CategoryKey;
  }
  return "other";
}

export function timeSince(iso: string): string {
  const timestamp = DateTime.fromISO(iso, { zone: "utc" });
  if (!timestamp.isValid) {
    return "just now";
  }

  const relative = timestamp.toRelative({ base: DateTime.utc(), style: "short" });
  return relative ?? "just now";
}

