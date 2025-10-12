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

      type ConfirmedItem = {
        id: string;
        name: string;
        quantity: string | number | null;
        action: 'updated' | 'created';
      };

      const confirmedItems: ConfirmedItem[] = [];
      const errors: string[] = [];

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

          if (checkError && checkError.code !== 'PGRST116') {
            errors.push(`Error checking existing item ${item.name}: ${checkError.message}`);
            continue;
          }

          const now = new Date().toISOString();

          if (existingItem) {
            const updatedQuantity = getMergedQuantity(existingItem.quantity, item.quantity);

            const { error: updateError } = await supabase
              .from('shopping_items')
              .update({
                quantity: updatedQuantity,
                auto_added: true,
                auto_added_at: now,
                source_recipe_id: item.source_recipe_id,
              })
              .eq('id', existingItem.id);

            if (updateError) {
              errors.push(`Error updating existing item ${item.name}: ${updateError.message}`);
              continue;
            }

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
              quantity: updatedQuantity,
              action: 'updated',
            });
          } else {
            const { data: newItem, error: createError } = await supabase
              .from('shopping_items')
              .insert({
                list_id: groceriesList.id,
                name: item.name,
                quantity: item.quantity,
                auto_added: true,
                auto_added_at: now,
                source_recipe_id: item.source_recipe_id,
                pending_confirmation: false,
                is_complete: false,
              })
              .select()
              .single();

            if (createError) {
              errors.push(`Error creating item ${item.name}: ${createError.message}`);
              continue;
            }

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
              action: 'created',
            });
          }
        } catch (itemError: unknown) {
          const message = itemError instanceof Error ? itemError.message : 'Unknown error';
          errors.push(`Error processing item ${item.name}: ${message}`);
        }
      }

      const countUpdate = await updateShoppingListCounts(groceriesList.id);

      logger.info('Confirm-items completed', {
        userId: user.id,
        householdId,
        listId: groceriesList.id,
        confirmedCount: confirmedItems.length,
        errorCount: errors.length,
        updatedCounts: countUpdate.ok
          ? {
              totalItems: countUpdate.totalItems,
              completedItems: countUpdate.completedItems,
            }
          : undefined,
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

    } catch (error) {
      logger.error('Error in confirm-items API', error instanceof Error ? error : new Error(String(error)), {
        userId: user.id,
      });
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }, { status: 500 });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'shopping'
  });
}

function getMergedQuantity(existingQuantity: unknown, incomingQuantity: unknown): string | number {
  const existingNumeric = parseFloat(String(existingQuantity));
  const incomingNumeric = parseFloat(String(incomingQuantity));

  if (!Number.isNaN(existingNumeric) && !Number.isNaN(incomingNumeric)) {
    return Math.round((existingNumeric + incomingNumeric) * 100) / 100;
  }

  const existingStr = String(existingQuantity ?? '').trim();
  const incomingStr = String(incomingQuantity ?? '').trim();

  if (existingStr.includes('+')) {
    const totalExisting = existingStr
      .split('+')
      .map((part) => parseFloat(part.trim()) || 0)
      .reduce((sum, value) => sum + value, 0);
    const combinedTotal = totalExisting + (parseFloat(incomingStr) || 0);
    return combinedTotal;
  }

  if (existingStr.length === 0) {
    return incomingQuantity ?? null;
  }

  if (incomingStr.length === 0) {
    return existingQuantity ?? null;
  }

  return `${existingQuantity} + ${incomingQuantity}`;
}
