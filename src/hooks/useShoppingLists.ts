import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/config';

// Types
interface ShoppingList {
  id: string;
  name: string;
  household_id: string;
  created_by: string;
  created_at: string;
  is_completed: boolean;
  total_items: number;
  completed_items: number;
  ai_suggestions_count: number;
  ai_confidence: number;
}

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  completed: boolean;
  completed_by?: string;
  completed_at?: string;
  shopping_list_id: string;
  created_at: string;
}

interface CreateShoppingListData {
  name: string;
  household_id: string;
}

interface AddItemData {
  name: string;
  quantity: number;
  unit: string;
  shopping_list_id: string;
}

// API functions
const fetchShoppingLists = async (): Promise<{ success: boolean; shoppingLists: ShoppingList[]; plan: string }> => {
  const response = await fetch('/api/shopping-lists');
  if (!response.ok) {
    throw new Error('Failed to fetch shopping lists');
  }
  return response.json();
};

const createShoppingList = async (data: CreateShoppingListData): Promise<{ success: boolean; shoppingList: ShoppingList; plan: string }> => {
  const response = await fetch('/api/shopping-lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create shopping list');
  }
  return response.json();
};

const addShoppingItem = async (data: AddItemData): Promise<{ success: boolean; item: ShoppingItem }> => {
  const response = await fetch('/api/shopping-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to add shopping item');
  }
  return response.json();
};

const toggleShoppingItem = async (itemId: string): Promise<{ success: boolean; item: ShoppingItem; rewards?: { xp: number; coins: number } }> => {
  const response = await fetch('/api/shopping-items/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId }),
  });
  if (!response.ok) {
    throw new Error('Failed to toggle shopping item');
  }
  return response.json();
};

const deleteShoppingList = async (id: string): Promise<{ success: boolean }> => {
  const response = await fetch(`/api/shopping-lists/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete shopping list');
  }
  return response.json();
};

// Custom hooks
export function useShoppingLists() {
  return useQuery({
    queryKey: queryKeys.shoppingLists.all,
    queryFn: fetchShoppingLists,
    staleTime: 2 * 60 * 1000, // 2 minutes - shopping lists change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateShoppingList() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createShoppingList,
    onSuccess: (data) => {
      // Optimistically update the cache
      queryClient.setQueryData(queryKeys.shoppingLists.all, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          shoppingLists: [...oldData.shoppingLists, data.shoppingList],
        };
      });
      
      // Invalidate and refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingLists.all });
    },
    onError: (error) => {
      console.error('Failed to create shopping list:', error);
    },
  });
}

export function useAddShoppingItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: addShoppingItem,
    onSuccess: (data, variables) => {
      // Invalidate the specific list's items
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.shoppingLists.items(variables.shopping_list_id) 
      });
      
      // Also invalidate the main lists to update counts
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingLists.all });
    },
    onError: (error) => {
      console.error('Failed to add shopping item:', error);
    },
  });
}

export function useToggleShoppingItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: toggleShoppingItem,
    onSuccess: (data, variables) => {
      // Optimistically update the item in the cache
      queryClient.setQueryData(
        queryKeys.shoppingLists.items(variables.shopping_list_id), 
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            items: oldData.items.map((item: ShoppingItem) =>
              item.id === variables.itemId 
                ? { ...item, completed: !item.completed }
                : item
            ),
          };
        }
      );
      
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingLists.all });
    },
    onError: (error) => {
      console.error('Failed to toggle shopping item:', error);
    },
  });
}

export function useDeleteShoppingList() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteShoppingList,
    onSuccess: (data, variables) => {
      // Optimistically remove from cache
      queryClient.setQueryData(queryKeys.shoppingLists.all, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          shoppingLists: oldData.shoppingLists.filter(
            (list: ShoppingList) => list.id !== variables
          ),
        };
      });
      
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingLists.all });
    },
    onError: (error) => {
      console.error('Failed to delete shopping list:', error);
    },
  });
}

// Utility hook for optimistic updates
export function useOptimisticShoppingLists() {
  const queryClient = useQueryClient();
  
  const addOptimisticList = (newList: Omit<ShoppingList, 'id' | 'created_at'>) => {
    const optimisticList: ShoppingList = {
      ...newList,
      id: `temp-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    
    queryClient.setQueryData(queryKeys.shoppingLists.all, (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        shoppingLists: [...oldData.shoppingLists, optimisticList],
      };
    });
    
    return optimisticList.id;
  };
  
  const removeOptimisticList = (tempId: string) => {
    queryClient.setQueryData(queryKeys.shoppingLists.all, (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        shoppingLists: oldData.shoppingLists.filter(
          (list: ShoppingList) => list.id !== tempId
        ),
      };
    });
  };
  
  return { addOptimisticList, removeOptimisticList };
}
