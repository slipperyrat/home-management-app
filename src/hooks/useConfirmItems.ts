import { useState } from 'react';

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
      console.log('🔍 Confirming items:', itemIds);
      const response = await fetch('/api/shopping-lists/confirm-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIds }),
        credentials: 'include', // Ensure authentication cookies are sent
      });

      console.log('🔍 Confirm items response:', response.status, response.statusText);

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Confirm items failed:', data);
        throw new Error(data.error || 'Failed to confirm items');
      }

      console.log('✅ Confirm items success:', data);
      return data;
    } catch (err: any) {
      console.error('❌ Confirm items error:', err);
      const errorMessage = err.message || 'Failed to confirm items';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    confirmItems,
    isLoading,
    error
  };
}
