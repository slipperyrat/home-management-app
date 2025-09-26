import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { sb } from '@/lib/server/supabaseAdmin';
import { updateShoppingListCounts } from '@/lib/server/updateShoppingListCounts';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🔍 Confirm-items API called with userId:', user?.id);
      const { itemIds } = await req.json();
      console.log('🔍 Item IDs received:', itemIds);

      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        console.log('❌ No item IDs provided');
        return NextResponse.json({ 
          success: false, 
          error: 'Item IDs are required' 
        }, { status: 400 });
      }

      // Get user's household
      const supabase = sb();
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('household_id')
        .eq('id', user.id)
        .single();

      if (userError || !userData) {
        return NextResponse.json({ 
          success: false, 
          error: 'User not found' 
        }, { status: 404 });
      }

      const householdId = userData.household_id;

    // Get the "Groceries" list for this household
    console.log('🔍 Looking for groceries list for household:', householdId);
    const { data: groceriesList, error: listError } = await supabase
      .from('shopping_lists')
      .select('id, title')
      .eq('household_id', householdId)
      .eq('title', 'Groceries')
      .single();

    console.log('🔍 Groceries list query result:', { groceriesList, listError });

    if (listError || !groceriesList) {
      console.error('❌ Groceries list not found:', listError);
      return NextResponse.json({ 
        success: false, 
        error: 'Groceries list not found' 
      }, { status: 404 });
    }

    // Get the items to confirm
    console.log('🔍 Looking for items to confirm:', itemIds);
    const { data: itemsToConfirm, error: fetchError } = await supabase
      .from('shopping_items')
      .select('*')
      .in('id', itemIds)
      .eq('pending_confirmation', true)
      .eq('auto_added', true);

    console.log('🔍 Items to confirm query result:', { itemsToConfirm, fetchError });

    if (fetchError) {
      console.error('❌ Failed to fetch items:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch items' 
      }, { status: 500 });
    }

    if (!itemsToConfirm || itemsToConfirm.length === 0) {
      console.log('❌ No items found to confirm');
      return NextResponse.json({ 
        success: false, 
        error: 'No items found to confirm' 
      }, { status: 404 });
    }

    const confirmedItems = [];
    const errors = [];

    // Process each item
    for (const item of itemsToConfirm) {
      try {
        console.log(`🔍 Processing item: ${item.name} (${item.quantity})`);
        
        // Check if there's already an item with the same name in the groceries list
        const { data: existingItem, error: checkError } = await supabase
          .from('shopping_items')
          .select('id, quantity')
          .eq('list_id', groceriesList.id)
          .eq('name', item.name)
          .eq('pending_confirmation', false)
          .single();

        console.log(`🔍 Existing item check for ${item.name}:`, { existingItem, checkError });

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
          errors.push(`Error checking existing item ${item.name}: ${checkError.message}`);
          continue;
        }

        if (existingItem) {
          // Update existing item quantity - handle both string and number quantities
          let newQuantity;
          const existingQty = parseFloat(existingItem.quantity) || 0;
          const itemQty = parseFloat(item.quantity) || 0;
          
          if (!isNaN(existingQty) && !isNaN(itemQty)) {
            newQuantity = Math.round((existingQty + itemQty) * 100) / 100; // Round to 2 decimal places
          } else {
            // If we can't parse as numbers, try to handle common string patterns
            const existingStr = String(existingItem.quantity).trim();
            const itemStr = String(item.quantity).trim();
            
            // If existing quantity already contains a "+", extract the numeric part
            if (existingStr.includes('+')) {
              const parts = existingStr.split('+');
              const totalExisting = parts.reduce((sum, part) => sum + (parseFloat(part.trim()) || 0), 0);
              const newTotal = totalExisting + itemQty;
              newQuantity = newTotal.toString();
            } else {
              // Simple concatenation for non-numeric quantities
              newQuantity = `${existingItem.quantity} + ${item.quantity}`;
            }
          }

          console.log(`🔍 Updating existing item ${item.name}: ${existingItem.quantity} + ${item.quantity} = ${newQuantity}`);

          const { error: updateError } = await supabase
            .from('shopping_items')
            .update({ 
              quantity: newQuantity,
              auto_added: true,
              auto_added_at: new Date().toISOString(),
              source_recipe_id: item.source_recipe_id
            })
            .eq('id', existingItem.id);

          console.log(`🔍 Update result for ${item.name}:`, { updateError });

          if (updateError) {
            errors.push(`Error updating existing item ${item.name}: ${updateError.message}`);
            continue;
          }

          // Delete the pending item
          const { error: deleteError } = await supabase
            .from('shopping_items')
            .delete()
            .eq('id', item.id);

          if (deleteError) {
            errors.push(`Error deleting pending item ${item.name}: ${deleteError.message}`);
            continue;
          }

          confirmedItems.push({
            id: existingItem.id,
            name: item.name,
            quantity: newQuantity,
            action: 'updated'
          });
        } else {
          // Create new item in groceries list
          console.log(`🔍 Creating new item ${item.name} in groceries list:`, groceriesList.id);
          
          const { data: newItem, error: createError } = await supabase
            .from('shopping_items')
            .insert({
              list_id: groceriesList.id,
              name: item.name,
              quantity: item.quantity,
              auto_added: true,
              auto_added_at: new Date().toISOString(),
              source_recipe_id: item.source_recipe_id,
              pending_confirmation: false,
              is_complete: false
            })
            .select()
            .single();

          console.log(`🔍 Create result for ${item.name}:`, { newItem, createError });

          if (createError) {
            errors.push(`Error creating item ${item.name}: ${createError.message}`);
            continue;
          }

          // Delete the pending item
          const { error: deleteError } = await supabase
            .from('shopping_items')
            .delete()
            .eq('id', item.id);

          if (deleteError) {
            errors.push(`Error deleting pending item ${item.name}: ${deleteError.message}`);
            continue;
          }

          confirmedItems.push({
            id: newItem.id,
            name: item.name,
            quantity: item.quantity,
            action: 'created'
          });
        }
      } catch (itemError: any) {
        errors.push(`Error processing item ${item.name}: ${itemError.message}`);
      }
    }

      console.log(`✅ Confirmation complete: ${confirmedItems.length} items processed, ${errors.length} errors`);
      console.log('✅ Confirmed items:', confirmedItems);
      if (errors.length > 0) {
        console.log('❌ Errors:', errors);
      }

      // Update the shopping list item counts
      console.log('🔍 Updating shopping list counts for groceries list:', groceriesList.id);
      const countUpdate = await updateShoppingListCounts(groceriesList.id);
      if (countUpdate.ok) {
        console.log(`✅ Updated counts: ${countUpdate.totalItems} total, ${countUpdate.completedItems} completed`);
      } else {
        console.error('❌ Failed to update counts:', countUpdate.error);
      }

      return NextResponse.json({
        success: true,
        confirmedItems,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully confirmed ${confirmedItems.length} items`,
        updatedCounts: countUpdate.ok ? {
          totalItems: countUpdate.totalItems,
          completedItems: countUpdate.completedItems
        } : undefined
      });

    } catch (error: any) {
      console.error('❌ Error in confirm-items API:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
  }, {
    requireAuth: true,
    requireCSRF: false, // Temporarily disabled for testing
    rateLimitConfig: 'api'
  });
}
