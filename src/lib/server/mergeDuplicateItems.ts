import { sb } from './supabaseAdmin';
import { logger } from '@/lib/logging/logger';

export async function mergeDuplicateItems(listId: string): Promise<{
  ok: boolean;
  mergedItems: number;
  totalItems: number;
  error?: string;
}> {
  try {
    const supabase = sb();

    const { data: allItems, error: fetchError } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      logger.error('Error fetching shopping items before merge', fetchError, { listId });
      return {
        ok: false,
        mergedItems: 0,
        totalItems: 0,
        error: fetchError.message,
      };
    }

    if (!allItems || allItems.length === 0) {
      logger.info('No shopping items found to merge', { listId });
      return {
        ok: true,
        mergedItems: 0,
        totalItems: 0,
      };
    }

    logger.info('Evaluating shopping items for duplicates', { listId, itemCount: allItems.length });

    type ShoppingItem = (typeof allItems)[number];

    const itemsByName = new Map<string, ShoppingItem[]>();
    for (const item of allItems) {
      const key = item.name.toLowerCase().trim();
      const itemsForName = itemsByName.get(key) ?? [];
      itemsForName.push(item);
      itemsByName.set(key, itemsForName);
    }

    logger.info('Grouped shopping items by name', { listId, uniqueNames: itemsByName.size });

    let mergedItems = 0;
    const errors: string[] = [];

    for (const [itemName, items] of itemsByName) {
      if (items.length <= 1) {
        continue;
      }

      try {
        let totalQuantity = 0;
        for (const item of items) {
          const qty = Number.parseFloat(item.quantity) || 0;
          totalQuantity += qty;
        }

        totalQuantity = Math.round(totalQuantity * 100) / 100;

        const firstItem = items[0];
        const { error: updateError } = await supabase
          .from('shopping_items')
          .update({
            quantity: totalQuantity.toString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', firstItem.id);

        if (updateError) {
          logger.error('Error updating primary shopping item during duplicate merge', updateError, { listId, itemName });
          errors.push(`Error updating first item ${itemName}`);
          continue;
        }

        const duplicateIds = items.slice(1).map(item => item.id);
        const { error: deleteError } = await supabase
          .from('shopping_items')
          .delete()
          .in('id', duplicateIds);

        if (deleteError) {
          logger.error('Error deleting duplicate shopping items', deleteError, { listId, itemName });
          errors.push(`Error deleting duplicates for ${itemName}`);
          continue;
        }

        mergedItems += items.length - 1;
        logger.info('Merged duplicate shopping items', { listId, itemName, duplicatesRemoved: items.length - 1, totalQuantity });
      } catch (itemError) {
        logger.error('Unexpected error while merging duplicate shopping items', itemError as Error, { listId, itemName });
        errors.push(`Error processing ${itemName}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
      }
    }

    const { count: finalCount, error: countError } = await supabase
      .from('shopping_items')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId);

    if (countError) {
      logger.error('Error retrieving shopping item count after merge', countError, { listId });
      errors.push('Failed to retrieve final item count');
    }

    const message = errors.length > 0
      ? `Merged ${mergedItems} duplicate items with ${errors.length} errors: ${errors.join(', ')}`
      : `Successfully merged ${mergedItems} duplicate items`;

    logger.info('Completed duplicate merge for shopping list', {
      listId,
      mergedItems,
      totalItems: finalCount ?? 0,
      errorCount: errors.length,
      message,
    });

    return {
      ok: errors.length === 0,
      mergedItems,
      totalItems: finalCount ?? 0,
      ...(errors.length > 0 ? { error: message } : {}),
    };
  } catch (error) {
    logger.error('Critical failure while merging duplicate shopping items', error as Error, { listId });
    return {
      ok: false,
      mergedItems: 0,
      totalItems: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
