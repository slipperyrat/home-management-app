export interface ShoppingList {
  id: string;
  name: string;
  description?: string | null;
  household_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  is_completed: boolean;
  total_items: number;
  completed_items: number;
  ai_suggestions_count: number;
  ai_confidence: number;
}
