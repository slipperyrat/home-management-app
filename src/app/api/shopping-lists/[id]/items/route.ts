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
        .select('id, household_id')
        .eq('id', listId)
        .eq('household_id', household.id)
        .maybeSingle();

      if (listError || !list) {
        return createErrorResponse('Shopping list not found or access denied', 404);
      }

      const { data: items, error: itemsError } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: true });

      if (itemsError) {
        logger.error('Error fetching shopping items', itemsError, { listId, householdId: household.id });
        return createErrorResponse('Failed to fetch items', 500, itemsError.message);
      }

      return createSuccessResponse({
        items: items ?? [],
      }, 'Shopping list items fetched successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/shopping-lists/[id]/items', method: 'GET', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function POST(
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
      const { name, quantity, unit, category, notes } = body as Partial<{ name: string; quantity: string | number; unit: string; category: string; notes: string }>;

      if (!name || !name.trim()) {
        return createErrorResponse('Item name is required', 400);
      }

      const supabase = getDatabaseClient();

      const { data: list, error: listError } = await supabase
        .from('shopping_lists')
        .select('id, household_id')
        .eq('id', listId)
        .eq('household_id', household.id)
        .maybeSingle();

      if (listError || !list) {
        return createErrorResponse('Shopping list not found or access denied', 404);
      }

      const insertPayload = {
        list_id: listId,
        name: name.trim(),
        quantity: quantity != null ? String(quantity) : null,
        unit: unit ?? null,
        category: category ?? null,
        notes: notes ?? null,
        is_complete: false,
        created_by: user.id,
      };

      const { data: newItems, error: createError } = await supabase
        .from('shopping_items')
        .insert(insertPayload)
        .select('*');

      if (createError || !newItems || newItems.length === 0) {
        logger.error('Error creating shopping item', createError ?? new Error('Insert returned no rows'), { listId, householdId: household.id });
        return createErrorResponse('Failed to create item', 500, createError?.message ?? 'Insert failed');
      }

      const newItem = newItems[0];

      if (!newItem) {
        return createErrorResponse('Failed to create item', 500);
      }

      await createAuditLog({
        action: 'shopping_item.created',
        targetTable: 'shopping_items',
        targetId: newItem.id,
        userId: user.id,
        metadata: {
          item_name: name.trim(),
          list_id: listId,
          household_id: household.id,
        },
      });

      return createSuccessResponse({ item: newItem }, 'Item created successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/shopping-lists/[id]/items', method: 'POST', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
