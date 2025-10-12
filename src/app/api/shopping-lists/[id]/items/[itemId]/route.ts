import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logging/logger';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { id: listId, itemId } = await params;

      if (!listId || !itemId) {
        return createErrorResponse('List ID and Item ID are required', 400);
      }

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();

      // First, verify the list belongs to the user's household
      const { data: list, error: listError } = await supabase
        .from('shopping_lists')
        .select('id, household_id')
        .eq('id', listId)
        .eq('household_id', household.id)
        .single();

      if (listError || !list) {
        return createErrorResponse('Shopping list not found or access denied', 404);
      }

      // Get the item to verify it exists and belongs to the list
      const { data: item, error: itemError } = await supabase
        .from('shopping_items')
        .select('id, name, list_id')
        .eq('id', itemId)
        .eq('list_id', listId)
        .single();

      if (itemError || !item) {
        return createErrorResponse('Item not found or access denied', 404);
      }

      // Delete the item
      const { error: deleteError } = await supabase
        .from('shopping_items')
        .delete()
        .eq('id', itemId)
        .eq('list_id', listId);

      if (deleteError) {
        logger.error('Error deleting shopping list item', deleteError, { listId, itemId, householdId: household.id });
        return createErrorResponse('Failed to delete item', 500, deleteError.message);
      }

      // Add audit log entry
      await createAuditLog({
        action: 'shopping_item.deleted',
        targetTable: 'shopping_items',
        targetId: itemId,
        userId: user.id,
        metadata: { 
          item_name: item.name,
          list_id: listId,
          household_id: household.id
        }
      });

      return createSuccessResponse({}, 'Item deleted successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/shopping-lists/[id]/items/[itemId]', method: 'DELETE', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
