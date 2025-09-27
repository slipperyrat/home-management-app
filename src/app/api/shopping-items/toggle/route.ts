import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { toggleShoppingItemSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      // Parse and validate input using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        
        // Validate the input using our schema
        validatedData = toggleShoppingItemSchema.parse(body);
      } catch (validationError: any) {
        logger.warn('Shopping item toggle validation failed', {
          userId: user.id,
          errors: validationError.errors,
        });
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      const { id: itemId, is_complete } = validatedData;

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // First get the current item to check its completion status and household
      const supabase = getDatabaseClient();
      const { data: currentItem, error: fetchError } = await supabase
        .from('shopping_items')
        .select(`
          is_complete,
          shopping_lists!inner(household_id)
        `)
        .eq('id', itemId)
        .single();

      if (fetchError) {
        logger.error('Error fetching shopping item before toggle', fetchError, {
          userId: user.id,
          itemId,
        });
        return createErrorResponse('Failed to fetch shopping item', 500, fetchError.message);
      }

      // Check if item was previously incomplete (to award rewards only once)
      const wasIncomplete = !currentItem.is_complete;
      // Fix: Access household_id correctly from the joined shopping_lists
      const itemHouseholdId = (currentItem.shopping_lists as any)?.household_id;

      if (!itemHouseholdId) {
        logger.error('Shopping item missing household_id', new Error('household_id missing'), {
          userId: user.id,
          itemId,
        });
        return createErrorResponse('Shopping item not associated with a household', 400);
      }

      // Verify the item belongs to the user's household
      if (itemHouseholdId !== household.id) {
        return createErrorResponse('Access denied to shopping item', 403);
      }

      if (is_complete && wasIncomplete) {
        // Complete the item and award rewards
        // First, get the current user's XP and coins
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('xp, coins')
          .eq('id', user.id);

        if (userError) {
          logger.error('Error fetching user rewards before toggle', userError, {
            userId: user.id,
            itemId,
          });
          return createErrorResponse('Failed to fetch user data', 500, userError.message);
        }

        if (!userData || userData.length === 0) {
          logger.warn('No user data found during shopping item toggle', {
            userId: user.id,
            itemId,
          });
          return createErrorResponse('User not found', 404);
        }

        const userDataRecord = userData[0];

        // Update the shopping item completion status
        const { data: updatedItem, error: itemError } = await supabase
          .from('shopping_items')
          .update({
            is_complete: true,
            completed_by: user.id,
            completed_at: new Date().toISOString()
          })
          .eq('id', itemId)
          .select()
          .single();

        if (itemError) {
          logger.error('Error updating shopping item completion', itemError, {
            userId: user.id,
            itemId,
          });
          return createErrorResponse('Failed to update shopping item', 500, itemError.message);
        }

        // Update user XP and coins
        const currentXp = userDataRecord?.xp ?? 0;
        const currentCoins = userDataRecord?.coins ?? 0;
        const newXp = currentXp + 10;
        const newCoins = currentCoins + 1;

        const { error: updateError } = await supabase
          .from('users')
          .update({
            xp: newXp,
            coins: newCoins
          })
          .eq('id', user.id);

        if (updateError) {
          logger.error('Error updating user rewards after shopping completion', updateError, {
            userId: user.id,
            itemId,
            newXp,
            newCoins,
          });
          return createErrorResponse('Failed to update user rewards', 500, updateError.message);
        }

        // Add audit log entry for completion
        await createAuditLog({
          action: 'shopping_item.completed',
          targetTable: 'shopping_items',
          targetId: itemId,
          userId: user.id,
          metadata: { 
            household_id: household.id,
            xp_awarded: 10,
            coins_awarded: 1,
            previous_status: false
          }
        });

        logger.info('Shopping item completed with rewards', {
          userId: user.id,
          householdId: household.id,
          itemId,
          xpAwarded: 10,
          coinsAwarded: 1,
        });
        return createSuccessResponse({ 
          item: updatedItem,
          rewards: { xp: 10, coins: 1 }
        }, 'Shopping item completed and rewards awarded');
      } else {
        // Toggle the item to the requested state
        const { data: updatedItem, error: itemError } = await supabase
          .from('shopping_items')
          .update({
            is_complete: is_complete,
            completed_by: is_complete ? user.id : null,
            completed_at: is_complete ? new Date().toISOString() : null
          })
          .eq('id', itemId)
          .select()
          .single();

        if (itemError) {
          logger.error('Error updating shopping item toggle state', itemError, {
            userId: user.id,
            itemId,
            newState: is_complete,
          });
          return createErrorResponse('Failed to update shopping item', 500, itemError.message);
        }

        // Add audit log entry for status change
        await createAuditLog({
          action: is_complete ? 'shopping_item.completed' : 'shopping_item.uncompleted',
          targetTable: 'shopping_items',
          targetId: itemId,
          userId: user.id,
          metadata: { 
            household_id: household.id,
            previous_status: !is_complete,
            new_status: is_complete
          }
        });

        logger.info('Shopping item toggled', {
          userId: user.id,
          householdId: household.id,
          itemId,
          newState: is_complete,
        });
        return createSuccessResponse({ item: updatedItem }, 'Shopping item toggled successfully');
      }

    } catch (error) {
      logger.error('Shopping item toggle failed', error as Error, {
        userId: user.id,
        route: '/api/shopping-items/toggle',
      });
      return handleApiError(error, { route: '/api/shopping-items/toggle', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'shopping'
  });
} 