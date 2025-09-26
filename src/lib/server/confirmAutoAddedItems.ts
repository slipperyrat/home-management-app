import { sb } from './supabaseAdmin'
import { updateShoppingListCounts } from './updateShoppingListCounts'

/**
 * Confirms or removes auto-added shopping list items with intelligent merging
 * @param userId - The user ID making the request
 * @param householdId - The household ID
 * @param itemIds - Array of shopping item IDs to confirm/remove
 * @param action - 'confirm' to keep items, 'remove' to delete them
 * @returns Object with success status and counts
 */
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
  error?: string 
}> {
  try {
    const supabase = sb()

    if (action === 'remove') {
      // Remove the items completely
      const { error: deleteErr, count } = await supabase
        .from('shopping_items')
        .delete({ count: 'exact' })
        .in('id', itemIds)
        .eq('auto_added', true)
        .eq('pending_confirmation', true)
      
      if (deleteErr) {
        return { 
          ok: false, 
          confirmed: 0, 
          removed: 0,
          message: '',
          error: deleteErr.message 
        }
      }

      const removedCount = count || 0
      console.log(`🗑️ Removed ${removedCount} auto-added items`)
      
      return { 
        ok: true, 
        confirmed: 0, 
        removed: removedCount,
        message: `Removed ${removedCount} auto-added item${removedCount !== 1 ? 's' : ''}`
      }
    } else {
      // Get the items to confirm first
      const { data: itemsToConfirm, error: fetchError } = await supabase
        .from('shopping_items')
        .select('*')
        .in('id', itemIds)
        .eq('auto_added', true)
        .eq('pending_confirmation', true)
      
      if (fetchError) {
        console.error('❌ Error fetching items to confirm:', fetchError)
        return { 
          ok: false, 
          confirmed: 0, 
          removed: 0,
          message: '',
          error: fetchError.message 
        }
      }

      if (!itemsToConfirm || itemsToConfirm.length === 0) {
        return { 
          ok: true, 
          confirmed: 0, 
          removed: 0,
          message: 'No items to confirm'
        }
      }

      console.log(`🔍 Processing ${itemsToConfirm.length} items for confirmation`)

      // Group items by name for merging
      const itemsByName = new Map<string, typeof itemsToConfirm>()
      for (const item of itemsToConfirm) {
        const key = item.name.toLowerCase().trim()
        if (!itemsByName.has(key)) {
          itemsByName.set(key, [])
        }
        itemsByName.get(key)!.push(item)
      }

      console.log(`🔍 Grouped into ${itemsByName.size} unique item names`)

      let confirmedCount = 0
      const errors: string[] = []

      // Process each group of items
      for (const [itemName, items] of itemsByName) {
        try {
          console.log(`🔍 Processing group "${itemName}" with ${items.length} items`)

          // Calculate total quantity for this group
          let totalQuantity = 0
          for (const item of items) {
            const qty = parseFloat(item.quantity) || 0
            totalQuantity += qty
          }

          // Round to 2 decimal places
          totalQuantity = Math.round(totalQuantity * 100) / 100

          console.log(`🔍 Total quantity for "${itemName}": ${totalQuantity}`)

          // Check if an item with this name already exists in the groceries list
          const { data: existingItems, error: existingError } = await supabase
            .from('shopping_items')
            .select('*')
            .eq('list_id', items[0].list_id)
            .eq('name', itemName)
            .neq('id', items[0].id) // Exclude the current item
            .order('created_at', { ascending: true })

          if (existingError) {
            console.error(`❌ Error checking existing items for "${itemName}":`, existingError)
            errors.push(`Error checking existing items for ${itemName}`)
            continue
          }

          if (existingItems && existingItems.length > 0) {
            // Merge with existing item
            const existingItem = existingItems[0]
            const existingQty = parseFloat(existingItem.quantity) || 0
            const newQuantity = Math.round((existingQty + totalQuantity) * 100) / 100

            console.log(`🔍 Merging "${itemName}": ${existingQty} + ${totalQuantity} = ${newQuantity}`)

            // Update the existing item
            const { error: updateError } = await supabase
              .from('shopping_items')
              .update({ 
                quantity: newQuantity.toString(),
                auto_added: true,
                auto_added_at: new Date().toISOString(),
                source_recipe_id: items[0].source_recipe_id
              })
              .eq('id', existingItem.id)

            if (updateError) {
              console.error(`❌ Error updating existing item "${itemName}":`, updateError)
              errors.push(`Error updating existing item ${itemName}`)
              continue
            }

            // Delete the pending items
            const { error: deleteError } = await supabase
              .from('shopping_items')
              .delete()
              .in('id', items.map(item => item.id))

            if (deleteError) {
              console.error(`❌ Error deleting pending items for "${itemName}":`, deleteError)
              errors.push(`Error deleting pending items for ${itemName}`)
              continue
            }

            console.log(`✅ Merged "${itemName}" with existing item`)
          } else {
            // No existing item, just confirm the first item and delete the rest
            const firstItem = items[0]
            const { error: updateError } = await supabase
              .from('shopping_items')
              .update({ 
                quantity: totalQuantity.toString(),
                pending_confirmation: false,
                auto_added: true,
                auto_added_at: new Date().toISOString()
              })
              .eq('id', firstItem.id)

            if (updateError) {
              console.error(`❌ Error updating first item "${itemName}":`, updateError)
              errors.push(`Error updating first item ${itemName}`)
              continue
            }

            // Delete the remaining items if there are any
            if (items.length > 1) {
              const { error: deleteError } = await supabase
                .from('shopping_items')
                .delete()
                .in('id', items.slice(1).map(item => item.id))

              if (deleteError) {
                console.error(`❌ Error deleting duplicate items for "${itemName}":`, deleteError)
                errors.push(`Error deleting duplicate items for ${itemName}`)
                continue
              }
            }

            console.log(`✅ Confirmed "${itemName}" as new item`)
          }

          confirmedCount++
        } catch (itemError: any) {
          console.error(`❌ Error processing group "${itemName}":`, itemError)
          errors.push(`Error processing ${itemName}: ${itemError.message}`)
        }
      }

      // Update shopping list counts
      if (itemsToConfirm.length > 0) {
        const listId = itemsToConfirm[0].list_id
        console.log(`🔍 Updating shopping list counts for list: ${listId}`)
        
        const countUpdate = await updateShoppingListCounts(listId)
        if (countUpdate.ok) {
          console.log(`✅ Updated counts: ${countUpdate.totalItems} total, ${countUpdate.completedItems} completed`)
        } else {
          console.error('❌ Failed to update counts:', countUpdate.error)
          errors.push(`Failed to update counts: ${countUpdate.error}`)
        }
      }

      const message = errors.length > 0 
        ? `Confirmed ${confirmedCount} items with ${errors.length} errors: ${errors.join(', ')}`
        : `Confirmed ${confirmedCount} auto-added item${confirmedCount !== 1 ? 's' : ''}`
      
      console.log(`✅ Confirmation complete: ${confirmedCount} items processed, ${errors.length} errors`)
      
      return { 
        ok: true, 
        confirmed: confirmedCount, 
        removed: 0,
        message
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error in confirmAutoAddedItems:', error)
    return { 
      ok: false, 
      confirmed: 0, 
      removed: 0,
      message: '',
      error: error.message 
    }
  }
}
