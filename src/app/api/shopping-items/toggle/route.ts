import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { toggleShoppingItemSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 POST: Toggling shopping item for user:', user.id);

      // Parse and validate input using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        console.log('📥 Received request body:', body);
        
        // Validate the input using our schema
        validatedData = toggleShoppingItemSchema.parse(body);
      } catch (validationError: any) {
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      const { id: itemId, is_complete } = validatedData;

      console.log(`🔄 API: Toggling shopping item ${itemId} for user ${user.id} to ${is_complete}`);

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
        console.error('❌ Error fetching shopping item:', fetchError);
        return createErrorResponse('Failed to fetch shopping item', 500, fetchError.message);
      }

      console.log(`📦 Current item completion status:`, currentItem);

      // Check if item was previously incomplete (to award rewards only once)
      const wasIncomplete = !currentItem.is_complete;
      // Fix: Access household_id correctly from the joined shopping_lists
      const itemHouseholdId = (currentItem.shopping_lists as any)?.household_id;

      if (!itemHouseholdId) {
        console.error('❌ No household_id found for shopping item');
        return createErrorResponse('Shopping item not associated with a household', 400);
      }

      // Verify the item belongs to the user's household
      if (itemHouseholdId !== household.id) {
        return createErrorResponse('Access denied to shopping item', 403);
      }

      console.log(`🔄 Item was incomplete: ${wasIncomplete}, household: ${itemHouseholdId}`);

      if (is_complete && wasIncomplete) {
        // Complete the item and award rewards
        console.log(`🎁 Awarding rewards for completing item`);
        
        // First, get the current user's XP and coins
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('xp, coins')
          .eq('id', user.id);

        console.log(`👤 User data query result:`, { userData, userError });

        if (userError) {
          console.error(`❌ Error fetching user data:`, userError);
          return createErrorResponse('Failed to fetch user data', 500, userError.message);
        }

        if (!userData || userData.length === 0) {
          console.error(`❌ No user data found for id: ${user.id}`);
          return createErrorResponse('User not found', 404);
        }

        const userDataRecord = userData[0];
        console.log(`✅ Found user:`, userDataRecord);

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
          console.error(`❌ Error updating shopping item:`, itemError);
          return createErrorResponse('Failed to update shopping item', 500, itemError.message);
        }

        // Update user XP and coins
        const currentXp = userDataRecord?.xp ?? 0;
        const currentCoins = userDataRecord?.coins ?? 0;
        const newXp = currentXp + 10;
        const newCoins = currentCoins + 1;
        
        console.log(`💰 Updating user rewards: XP ${currentXp} → ${newXp}, Coins ${currentCoins} → ${newCoins}`);
      
        const { error: updateError } = await supabase
          .from('users')
          .update({
            xp: newXp,
            coins: newCoins
          })
          .eq('id', user.id);

        if (updateError) {
          console.error(`❌ Error updating user rewards:`, updateError);
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

        console.log(`✅ Successfully completed shopping item and awarded rewards`);
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
          console.error(`❌ Error updating shopping item:`, itemError);
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

        console.log(`✅ Successfully ${is_complete ? 'completed' : 'uncompleted'} shopping item`);
        return createSuccessResponse({ item: updatedItem }, 'Shopping item toggled successfully');
      }

    } catch (error) {
      return handleApiError(error, { route: '/api/shopping-items/toggle', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
} 