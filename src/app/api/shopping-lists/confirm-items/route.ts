import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { sb } from '@/lib/server/supabaseAdmin';
import { updateShoppingListCounts } from '@/lib/server/updateShoppingListCounts';
import { logger } from '@/lib/logging/logger';

const confirmItemsSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
});

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const payload = await req.json();
      const { itemIds } = confirmItemsSchema.parse(payload);

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
    const { data: groceriesList, error: listError } = await supabase
      .from('shopping_lists')
      .select('id, title')
      .eq('household_id', householdId)
      .eq('title', 'Groceries')
      .single();

    if (listError || !groceriesList) {
      logger.warn('Groceries list not found during confirm-items', {
        userId: user.id,
        householdId,
        error: listError?.message,
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Groceries list not found' 
      }, { status: 404 });
    }

    // Get the items to confirm
    const { data: itemsToConfirm, error: fetchError } = await supabase
      .from('shopping_items')
      .select('*')
      .in('id', itemIds)
      .eq('pending_confirmation', true)
      .eq('auto_added', true);

    if (fetchError) {
      logger.error('Failed to fetch items for confirmation', fetchError, {
        userId: user.id,
        householdId,
        itemCount: itemIds.length,
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch items' 
      }, { status: 500 });
    }

    if (!itemsToConfirm || itemsToConfirm.length === 0) {
      logger.warn('No pending items found to confirm', {
        userId: user.id,
        householdId,
        itemCount: itemIds.length,
      });
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
        // Check if there's already an item with the same name in the groceries list
        const { data: existingItem, error: checkError } = await supabase
          .from('shopping_items')
          .select('id, quantity')
          .eq('list_id', groceriesList.id)
          .eq('name', item.name)
          .eq('pending_confirmation', false)
          .single();

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

          const { error: updateError } = await supabase
            .from('shopping_items')
            .update({ 
              quantity: newQuantity,
              auto_added: true,
              auto_added_at: new Date().toISOString(),
              source_recipe_id: item.source_recipe_id
            })
            .eq('id', existingItem.id);

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

      const countUpdate = await updateShoppingListCounts(groceriesList.id);

    logger.info('Confirm-items completed', {
      userId: user.id,
      householdId,
      listId: groceriesList.id,
      confirmedCount: confirmedItems.length,
      errorCount: errors.length,
      updatedCounts: countUpdate.ok ? {
        totalItems: countUpdate.totalItems,
        completedItems: countUpdate.completedItems,
      } : undefined,
    });

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
    requireCSRF: true,
    rateLimitConfig: 'shopping'
  });
}
