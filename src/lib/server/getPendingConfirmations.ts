import { sb } from './supabaseAdmin'

interface PendingItem {
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
  error?: string 
}> {
  try {
    const supabase = sb()

    // First, get all shopping list IDs for this household
    const { data: shoppingLists, error: listsError } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('household_id', householdId)

    if (listsError) {
      return { 
        ok: false, 
        pendingItems: [],
        count: 0,
        error: listsError.message 
      }
    }

    const listIds = shoppingLists?.map(list => list.id) || []
    
    if (listIds.length === 0) {
      return { 
        ok: true, 
        pendingItems: [],
        count: 0
      }
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
      .order('auto_added_at', { ascending: false })

    if (fetchErr) {
      return { 
        ok: false, 
        pendingItems: [],
        count: 0,
        error: fetchErr.message 
      }
    }

    // Transform the data to include recipe title
    const transformedItems: PendingItem[] = (pendingItems || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      auto_added_at: item.auto_added_at,
      source_recipe_id: item.source_recipe_id,
      recipe_title: item.recipes?.title || 'Unknown Recipe'
    }))

    console.log(`📋 Found ${transformedItems.length} pending auto-added items`)
    
    return { 
      ok: true, 
      pendingItems: transformedItems,
      count: transformedItems.length
    }
    
  } catch (error: any) {
    console.error('❌ Error in getPendingConfirmations:', error)
    return { 
      ok: false, 
      pendingItems: [],
      count: 0,
      error: error.message 
    }
  }
}
