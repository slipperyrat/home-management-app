import { sb } from './supabaseAdmin';
import { updateShoppingListCounts } from './updateShoppingListCounts';
import { logger } from '@/lib/logging/logger';

export async function confirmAutoAddedItems(
  userId: string,
  householdId: string,
  itemIds: string[],
  action: 'confirm' | 'remove'
): Promise<{
  ok: boolean;
  confirmed: number;
  removed: number;
  message: string;
  error?: string;
}> {
  try {
    const supabase = sb();

    if (action === 'remove') {
      const { error: deleteErr, count } = await supabase
        .from('shopping_items')
        .delete({ count: 'exact' })
        .in('id', itemIds)
        .eq('auto_added', true)
        .eq('pending_confirmation', true);

      if (deleteErr) {
        return {
          ok: false,
          confirmed: 0,
          removed: 0,
          message: '',
          error: deleteErr.message,
        };
      }

      const removedCount = count || 0;
      logger.info('Removed auto-added shopping items', { householdId, removedCount });

      return {
        ok: true,
        confirmed: 0,
        removed: removedCount,
        message: `Removed ${removedCount} auto-added item${removedCount !== 1 ? 's' : ''}`,
      };
    }

    const { data: itemsToConfirm, error: fetchError } = await supabase
      .from('shopping_items')
      .select('*')
      .in('id', itemIds)
      .eq('auto_added', true)
      .eq('pending_confirmation', true);

    if (fetchError) {
      logger.error('Error fetching auto-added items for confirmation', fetchError, { householdId });
      return {
        ok: false,
        confirmed: 0,
        removed: 0,
        message: '',
        error: fetchError.message,
      };
    }

    if (!itemsToConfirm || itemsToConfirm.length === 0) {
      return {
        ok: true,
        confirmed: 0,
        removed: 0,
        message: 'No items to confirm',
      };
    }

    logger.info('Processing auto-added items for confirmation', {
      householdId,
      itemCount: itemsToConfirm.length,
    });

    const itemsByName = new Map<string, typeof itemsToConfirm>();
    for (const item of itemsToConfirm) {
      const key = item.name.toLowerCase().trim();
      if (!itemsByName.has(key)) {
        itemsByName.set(key, []);
      }
      itemsByName.get(key)!.push(item);
    }

    let confirmedCount = 0;
    const errors: string[] = [];

    for (const [itemName, items] of itemsByName) {
      try {
        let totalQuantity = 0;
        for (const item of items) {
          const qty = Number.parseFloat(item.quantity ?? '0') || 0;
          totalQuantity += qty;
        }

        totalQuantity = Math.round(totalQuantity * 100) / 100;

        const firstItem = items[0];
        if (!firstItem?.list_id) {
          errors.push(`Missing list ID for ${itemName}`);
          continue;
        }

        const { data: existingItems, error: existingError } = await supabase
          .from('shopping_items')
          .select('*')
          .eq('list_id', firstItem.list_id)
          .eq('name', itemName)
          .neq('id', firstItem.id)
          .order('created_at', { ascending: true });

        if (existingError) {
          logger.error('Error checking existing shopping items during confirmation', existingError, { itemName });
          errors.push(`Error checking existing items for ${itemName}`);
          continue;
        }

        if (existingItems && existingItems.length > 0) {
          const existingItem = existingItems[0];
          if (!existingItem) {
            errors.push(`Existing item missing for ${itemName}`);
            continue;
          }
          const existingQty = Number.parseFloat(existingItem?.quantity ?? '0') || 0;
          const newQuantity = Math.round((existingQty + totalQuantity) * 100) / 100;

          const { error: updateError } = await supabase
            .from('shopping_items')
            .update({
              quantity: newQuantity.toString(),
              auto_added: true,
              auto_added_at: new Date().toISOString(),
              source_recipe_id: firstItem.source_recipe_id,
              pending_confirmation: false,
            })
            .eq('id', existingItem.id);

          if (updateError) {
            logger.error('Error updating existing shopping item during merge', updateError, { itemName });
            errors.push(`Error updating existing item ${itemName}`);
            continue;
          }

          const { error: deleteError } = await supabase
            .from('shopping_items')
            .delete()
            .in('id', items.map(item => item.id));

          if (deleteError) {
            logger.error('Error deleting pending items after merge', deleteError, { itemName });
            errors.push(`Error deleting pending items for ${itemName}`);
            continue;
          }

          logger.info('Merged auto-added shopping item with existing entry', {
            itemName,
            previousQuantity: existingQty,
            addedQuantity: totalQuantity,
            newQuantity,
          });
        } else {
          const firstItem = items[0];
          if (!firstItem) {
            errors.push(`First item missing for ${itemName}`);
            continue;
          }
          const { error: updateError } = await supabase
            .from('shopping_items')
            .update({
              quantity: totalQuantity.toString(),
              pending_confirmation: false,
              auto_added: true,
              auto_added_at: new Date().toISOString(),
            })
            .eq('id', firstItem.id);

          if (updateError) {
            logger.error('Error confirming new shopping item', updateError, { itemName });
            errors.push(`Error updating first item ${itemName}`);
            continue;
          }

          if (items.length > 1) {
            const { error: deleteError } = await supabase
              .from('shopping_items')
              .delete()
              .in('id', items.slice(1).map(item => item.id));

            if (deleteError) {
              logger.error('Error deleting duplicate pending items', deleteError, { itemName });
              errors.push(`Error deleting duplicate items for ${itemName}`);
              continue;
            }
          }

          logger.info('Confirmed auto-added shopping item', { itemName, totalQuantity });
        }

        confirmedCount++;
      } catch (itemError) {
        logger.error('Error processing auto-added item group', itemError as Error, { itemName });
        errors.push(`Error processing ${itemName}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
      }
    }

    if (itemsToConfirm.length > 0) {
      const listId = itemsToConfirm[0]?.list_id;
      if (listId) {
        const countUpdate = await updateShoppingListCounts(listId);
      if (countUpdate.ok) {
        logger.info('Updated shopping list counts after confirming auto-added items', {
          listId,
          totalItems: countUpdate.totalItems,
          completedItems: countUpdate.completedItems,
        });
      } else {
        logger.warn('Failed to update shopping list counts after confirming items', { listId, error: countUpdate.error });
        errors.push(`Failed to update counts: ${countUpdate.error}`);
      }
      }
    }

    const message = errors.length > 0
      ? `Confirmed ${confirmedCount} items with ${errors.length} errors: ${errors.join(', ')}`
      : `Confirmed ${confirmedCount} auto-added item${confirmedCount !== 1 ? 's' : ''}`;

    return {
      ok: true,
      confirmed: confirmedCount,
      removed: 0,
      message,
    };
  } catch (error) {
    logger.error('Error in confirmAutoAddedItems', error as Error, { householdId, userId, itemCount: itemIds.length });
    return {
      ok: false,
      confirmed: 0,
      removed: 0,
      message: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
