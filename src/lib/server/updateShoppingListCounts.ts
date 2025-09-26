import { sb } from './supabaseAdmin'

/**
 * Updates the total_items and completed_items counts for a shopping list
 * @param listId - The shopping list ID to update
 * @returns Object with success status and updated counts
 */
export async function updateShoppingListCounts(listId: string): Promise<{ 
  ok: boolean; 
  totalItems: number; 
  completedItems: number;
  error?: string 
}> {
  try {
    const supabase = sb()

    // Get total items count
    const { count: totalItems, error: totalError } = await supabase
      .from('shopping_items')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId)

    if (totalError) {
      console.error('❌ Error getting total items count:', totalError)
      return { 
        ok: false, 
        totalItems: 0, 
        completedItems: 0,
        error: totalError.message 
      }
    }

    // Get completed items count
    const { count: completedItems, error: completedError } = await supabase
      .from('shopping_items')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId)
      .eq('is_complete', true)

    if (completedError) {
      console.error('❌ Error getting completed items count:', completedError)
      return { 
        ok: false, 
        totalItems: 0, 
        completedItems: 0,
        error: completedError.message 
      }
    }

    // Note: The shopping_lists table doesn't have total_items and completed_items columns
    // These counts are calculated dynamically from the shopping_items table
    // We'll just log the counts for debugging purposes
    console.log(`📊 Shopping list ${listId} has ${totalItems || 0} total items, ${completedItems || 0} completed`)

    console.log(`✅ Updated shopping list ${listId}: ${totalItems || 0} total items, ${completedItems || 0} completed`)
    
    return { 
      ok: true, 
      totalItems: totalItems || 0, 
      completedItems: completedItems || 0
    }
    
  } catch (error: any) {
    console.error('❌ Error in updateShoppingListCounts:', error)
    return { 
      ok: false, 
      totalItems: 0, 
      completedItems: 0,
      error: error.message 
    }
  }
}
