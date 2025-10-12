import { useState } from 'react';
import { logger } from '@/lib/logging/logger';

interface ConfirmItemsResponse {
  success: boolean;
  confirmedItems?: Array<{
    id: string;
    name: string;
    quantity: string | number;
    action: 'created' | 'updated';
  }>;
  errors?: string[];
  message?: string;
  error?: string;
}

export function useConfirmItems() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmItems = async (itemIds: string[]): Promise<ConfirmItemsResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.debug?.('Confirming items', { itemIds });
      const response = await fetch('/api/shopping-lists/confirm-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIds }),
        credentials: 'include',
      });

      logger.debug?.('Confirm items response', { status: response.status, statusText: response.statusText });

      const data: ConfirmItemsResponse = await response.json();

      if (!response.ok) {
        logger.error('Confirm items failed', new Error(data.error || 'Unknown error'), { itemIds });
        throw new Error(data.error || 'Failed to confirm items');
      }

      logger.info('Confirm items success', { itemIds, confirmedCount: data.confirmedItems?.length || 0 });
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to confirm items';
      logger.error('Confirm items error', err as Error, { itemIds });
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    confirmItems,
    isLoading,
    error,
  };
}
