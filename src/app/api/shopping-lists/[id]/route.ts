import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logging/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPISecurity(request, async (_req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }
      const { id: listId } = await params;

      if (!listId) {
        return createErrorResponse('List ID is required', 400);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();

      const { data: list, error: listError } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('id', listId)
        .eq('household_id', household.id)
        .maybeSingle();

      if (listError || !list) {
        logger.warn('Shopping list not found or access denied', { listId, householdId: household.id });
        return createErrorResponse('Shopping list not found or access denied', 404);
      }

      return createSuccessResponse({ list }, 'Shopping list fetched successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/shopping-lists/[id]', method: 'GET', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }
      const { id: listId } = await params;

      if (!listId) {
        return createErrorResponse('List ID is required', 400);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const body = await req.json();
      const { name, description } = body as Partial<{ name: string; description: string }>;

      if (!name || !name.trim()) {
        return createErrorResponse('List name is required', 400);
      }

      const supabase = getDatabaseClient();

      const { data: existingList, error: fetchError } = await supabase
        .from('shopping_lists')
        .select('id, household_id, name')
        .eq('id', listId)
        .eq('household_id', household.id)
        .maybeSingle();

      if (fetchError || !existingList) {
        return createErrorResponse('Shopping list not found or access denied', 404);
      }

      const { data: updatedList, error: updateError } = await supabase
        .from('shopping_lists')
        .update({
          name: name.trim(),
          description: description?.trim() ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', listId)
        .eq('household_id', household.id)
        .select('*')
        .maybeSingle();

      if (updateError || !updatedList) {
        logger.error('Error updating shopping list', updateError ?? new Error('Update returned no rows'), { listId, householdId: household.id });
        return createErrorResponse('Failed to update shopping list', 500, updateError?.message ?? 'Update failed');
      }

      await createAuditLog({
        action: 'shopping_list.updated',
        targetTable: 'shopping_lists',
        targetId: listId,
        userId: user.id,
        metadata: {
          list_name: name.trim(),
          household_id: household.id,
        },
      });

      return createSuccessResponse({ list: updatedList }, 'Shopping list updated successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/shopping-lists/[id]', method: 'PUT', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPISecurity(request, async (_req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }
      const { id: listId } = await params;

      if (!listId) {
        return createErrorResponse('List ID is required', 400);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();

      const { data: existingList, error: fetchError } = await supabase
        .from('shopping_lists')
        .select('id, household_id, name')
        .eq('id', listId)
        .eq('household_id', household.id)
        .maybeSingle();

      if (fetchError || !existingList) {
        return createErrorResponse('Shopping list not found or access denied', 404);
      }

      const { error: deleteError } = await supabase
        .from('shopping_lists')
        .delete()
        .eq('id', listId)
        .eq('household_id', household.id);

      if (deleteError) {
        logger.error('Error deleting shopping list', deleteError, { listId, householdId: household.id });
        return createErrorResponse('Failed to delete shopping list', 500, deleteError.message);
      }

      await createAuditLog({
        action: 'shopping_list.deleted',
        targetTable: 'shopping_lists',
        targetId: listId,
        userId: user.id,
        metadata: {
          list_name: existingList.name,
          household_id: household.id,
        },
      });

      return createSuccessResponse({}, 'Shopping list deleted successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/shopping-lists/[id]', method: 'DELETE', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
