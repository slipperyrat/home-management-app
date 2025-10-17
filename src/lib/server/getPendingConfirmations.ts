import { sb } from './supabaseAdmin';
import { logger } from '@/lib/logging/logger';

interface PendingItem {
  id: string;
  name: string;
  quantity: string;
  auto_added_at: string;
  source_recipe_id: string;
  recipe_title?: string;
  source_meal_plan?: {
    week: string;
    day: string;
    slot: string;
  };
}

/**
 * Gets all pending auto-added shopping list items for confirmation
 * @param householdId - The household ID
 * @returns Object with success status and pending items
 */
export async function getPendingConfirmations(
  householdId: string
): Promise<{
  ok: boolean;
  pendingItems: PendingItem[];
  count: number;
  error?: string;
}> {
  try {
    const supabase = sb();

    // First, get all shopping list IDs for this household
    const { data: shoppingLists, error: listsError } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('household_id', householdId);

    if (listsError) {
      logger.error('Error fetching shopping lists for pending confirmations', listsError, { householdId });
      return {
        ok: false,
        pendingItems: [],
        count: 0,
        error: listsError.message,
      };
    }

    const listIds = shoppingLists?.map(list => list.id) || [];
    
    if (listIds.length === 0) {
      logger.info('No shopping lists found for household when checking pending confirmations', { householdId });
      return {
        ok: true,
        pendingItems: [],
        count: 0,
      };
    }

    // Get all pending auto-added items with recipe information
    const { data: pendingItems, error: fetchErr } = await supabase
      .from('shopping_items')
      .select(`
        id,
        name,
        quantity,
        auto_added_at,
        source_recipe_id,
        recipes!inner(title)
      `)
      .eq('pending_confirmation', true)
      .eq('auto_added', true)
      .eq('is_complete', false)
      .in('list_id', listIds)
      .order('auto_added_at', { ascending: false });

    if (fetchErr) {
      logger.error('Error fetching pending confirmation shopping items', fetchErr, { householdId });
      return {
        ok: false,
        pendingItems: [],
        count: 0,
        error: fetchErr.message,
      };
    }

    // Transform the data to include recipe title
    const transformedItems: PendingItem[] = (pendingItems || []).map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity ?? '',
      auto_added_at: item.auto_added_at ?? new Date().toISOString(),
      source_recipe_id: item.source_recipe_id ?? '',
      recipe_title: item.recipes?.title || 'Unknown Recipe',
    }));

    logger.info('Fetched pending auto-added shopping items', {
      householdId,
      pendingCount: transformedItems.length,
    });

    return {
      ok: true,
      pendingItems: transformedItems,
      count: transformedItems.length,
    };

  } catch (error) {
    logger.error('Error in getPendingConfirmations', error as Error, { householdId });
    return {
      ok: false,
      pendingItems: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
