import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/config';

// Types
export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number | string;
  unit?: string;
  category?: string;
  notes?: string;
  is_complete: boolean;  // Updated to match database field
  completed: boolean;    // Keep both for compatibility
  completed_by?: string;
  completed_at?: string;
  list_id: string;
  created_at: string;
  auto_added?: boolean;
  auto_added_at?: string;
  pending_confirmation?: boolean;
  source_recipe_id?: string;
}

// API function
const fetchShoppingListItems = async (listId: string): Promise<{ success: boolean; items: ShoppingItem[] }> => {
  const response = await fetch(`/api/shopping-lists/${listId}/items`, {
    credentials: 'include', // Ensure authentication cookies are sent
  });
  if (!response.ok) {
    throw new Error('Failed to fetch shopping list items');
  }
  return response.json();
};

// Custom hook
export function useShoppingListItems(listId: string | null) {
  return useQuery({
    queryKey: queryKeys.shoppingLists.items(listId || ''),
    queryFn: () => fetchShoppingListItems(listId!),
    enabled: !!listId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
