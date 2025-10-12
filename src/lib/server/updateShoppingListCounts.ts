import { sb } from './supabaseAdmin';
import { logger } from '@/lib/logging/logger';

export async function updateShoppingListCounts(listId: string): Promise<{
  ok: boolean;
  totalItems: number;
  completedItems: number;
  error?: string;
}> {
  try {
    const supabase = sb();

    const { count: totalItems, error: totalError } = await supabase
      .from('shopping_items')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId);

    if (totalError) {
      logger.error('Error counting total shopping items', totalError, { listId });
      return {
        ok: false,
        totalItems: 0,
        completedItems: 0,
        error: totalError.message,
      };
    }

    const { count: completedItems, error: completedError } = await supabase
      .from('shopping_items')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId)
      .eq('is_complete', true);

    if (completedError) {
      logger.error('Error counting completed shopping items', completedError, { listId });
      return {
        ok: false,
        totalItems: 0,
        completedItems: 0,
        error: completedError.message,
      };
    }

    logger.info('Calculated shopping list item counts', {
      listId,
      totalItems: totalItems ?? 0,
      completedItems: completedItems ?? 0,
    });

    return {
      ok: true,
      totalItems: totalItems ?? 0,
      completedItems: completedItems ?? 0,
    };
  } catch (error) {
    logger.error('Unexpected error updating shopping list counts', error as Error, { listId });
    return {
      ok: false,
      totalItems: 0,
      completedItems: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
