'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/logging/logger';

// Types
export interface PendingItem {
  id: string;
  name: string;
  quantity: number | string;
  auto_added_at: string;
  source_recipe_id: string;
  recipe_title?: string;
  source_meal_plan?: {
    week: string;
    day: string;
    slot: string;
  };
}

export interface ConfirmAutoAddedData {
  item_ids: string[];
  action: 'confirm' | 'remove';
}

// API functions
async function fetchPendingConfirmations(): Promise<PendingItem[]> {
  try {
    const response = await fetch('/api/shopping-lists/pending-confirmations', {
      credentials: 'include', // Ensure cookies are sent
    });
    
    if (!response.ok) {
      logger.error('Failed to fetch pending confirmations', new Error(response.statusText), {
        status: response.status,
      });
      throw new Error(`Failed to fetch pending confirmations: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.ok) {
      return data.pendingItems || [];
    }
    
    return [];
  } catch (error) {
    logger.error('Error in fetchPendingConfirmations', error as Error);
    throw error;
  }
}

async function confirmAutoAddedItems(data: ConfirmAutoAddedData): Promise<{ 
  confirmed: number; 
  removed: number; 
  message: string;
}> {
  const response = await fetch('/api/shopping-lists/confirm-auto-added', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include', // Ensure cookies are sent
  });

  if (!response.ok) {
    throw new Error(`Failed to confirm auto-added items: ${response.status}`);
  }

  return response.json();
}

// Custom hooks
export function usePendingConfirmations() {
  return useQuery({
    queryKey: ['pendingConfirmations'],
    queryFn: fetchPendingConfirmations,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes in cache
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: (failureCount, error) => {
      // Don't retry on 401 errors (authentication issues)
      if (error?.message?.includes('401')) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useConfirmAutoAddedItems() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: confirmAutoAddedItems,
    onSuccess: (data, variables) => {
      // Invalidate pending confirmations to refresh data
      queryClient.invalidateQueries({ queryKey: ['pendingConfirmations'] });
      
      // Invalidate shopping lists to refresh item counts
      queryClient.invalidateQueries({ queryKey: ['shoppingLists'] });
      
      // Show success message
      if (variables.action === 'confirm') {
        toast.success(`${data.message} Added to your shopping list!`);
      } else {
        toast.success(`${data.message} from your shopping list.`);
      }
    },
    onError: (error) => {
      toast.error(`Failed to ${error.message.includes('confirm') ? 'confirm' : 'remove'} items: ${error.message}`);
    },
  });
}
