import { sb } from './supabaseAdmin'

/**
 * Merges duplicate items in a shopping list by combining quantities
 * @param listId - The shopping list ID to clean up
 * @returns Object with success status and merge results
 */
export async function mergeDuplicateItems(listId: string): Promise<{ 
  ok: boolean; 
  mergedItems: number; 
  totalItems: number;
  error?: string 
}> {
  try {
    const supabase = sb()

    // Get all items in the list
    const { data: allItems, error: fetchError } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('❌ Error fetching items for merge:', fetchError)
      return { 
        ok: false, 
        mergedItems: 0, 
        totalItems: 0,
        error: fetchError.message 
      }
    }

    if (!allItems || allItems.length === 0) {
      return { 
        ok: true, 
        mergedItems: 0, 
        totalItems: 0
      }
    }

    console.log(`🔍 Found ${allItems.length} items to check for duplicates`)

    // Group items by name (case-insensitive)
    const itemsByName = new Map<string, typeof allItems>()
    for (const item of allItems) {
      const key = item.name.toLowerCase().trim()
      if (!itemsByName.has(key)) {
        itemsByName.set(key, [])
      }
      itemsByName.get(key)!.push(item)
    }

    console.log(`🔍 Grouped into ${itemsByName.size} unique item names`)

    let mergedItems = 0
    const errors: string[] = []

    // Process each group of items
    for (const [itemName, items] of itemsByName) {
      if (items.length <= 1) {
        continue // No duplicates to merge
      }

      try {
        console.log(`🔍 Merging ${items.length} duplicate items for "${itemName}"`)

        // Calculate total quantity for this group
        let totalQuantity = 0
        for (const item of items) {
          const qty = parseFloat(item.quantity) || 0
          totalQuantity += qty
        }

        // Round to 2 decimal places
        totalQuantity = Math.round(totalQuantity * 100) / 100

        console.log(`🔍 Total quantity for "${itemName}": ${totalQuantity}`)

        // Keep the first item and update its quantity
        const firstItem = items[0]
        const { error: updateError } = await supabase
          .from('shopping_items')
          .update({ 
            quantity: totalQuantity.toString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', firstItem.id)

        if (updateError) {
          console.error(`❌ Error updating first item "${itemName}":`, updateError)
          errors.push(`Error updating first item ${itemName}`)
          continue
        }

        // Delete the remaining duplicate items
        const duplicateIds = items.slice(1).map(item => item.id)
        const { error: deleteError } = await supabase
          .from('shopping_items')
          .delete()
          .in('id', duplicateIds)

        if (deleteError) {
          console.error(`❌ Error deleting duplicate items for "${itemName}":`, deleteError)
          errors.push(`Error deleting duplicates for ${itemName}`)
          continue
        }

        console.log(`✅ Merged ${items.length} items for "${itemName}" into quantity ${totalQuantity}`)
        mergedItems += items.length - 1 // Count how many were merged

      } catch (itemError: any) {
        console.error(`❌ Error processing group "${itemName}":`, itemError)
        errors.push(`Error processing ${itemName}: ${itemError.message}`)
      }
    }

    // Get final count
    const { count: finalCount } = await supabase
      .from('shopping_items')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId)

    const message = errors.length > 0 
      ? `Merged ${mergedItems} duplicate items with ${errors.length} errors: ${errors.join(', ')}`
      : `Successfully merged ${mergedItems} duplicate items`
    
    console.log(`✅ Merge complete: ${mergedItems} items merged, ${finalCount || 0} total items remaining`)
    
    return { 
      ok: true, 
      mergedItems, 
      totalItems: finalCount || 0
    }
    
  } catch (error: any) {
    console.error('❌ Error in mergeDuplicateItems:', error)
    return { 
      ok: false, 
      mergedItems: 0, 
      totalItems: 0,
      error: error.message 
    }
  }
}
