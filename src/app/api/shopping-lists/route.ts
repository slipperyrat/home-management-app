import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { canAccessFeature } from '@/lib/server/canAccessFeature';
import { logger } from '@/lib/logging/logger';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (_req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();
      const { data: shoppingLists, error: listsError } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('household_id', household.id)
        .order('created_at', { ascending: false });

      if (listsError) {
        logger.error('Failed to fetch shopping lists', listsError, {
          userId: user.id,
          route: '/api/shopping-lists',
        });
        return createErrorResponse('Failed to fetch shopping lists', 500, listsError.message);
      }

      const listsWithCounts = await Promise.all(
        (shoppingLists ?? []).map(async (list) => {
          const { count: totalItems } = await supabase
            .from('shopping_items')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id);

          const { count: completedItems } = await supabase
            .from('shopping_items')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id)
            .eq('is_complete', true);

          const { count: aiSuggestions } = await supabase
            .from('shopping_items')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id)
            .eq('ai_suggested', true);

          logger.info('Counts for list fetched', {
            userId: user.id,
            listId: list.id,
            totalItems,
            completedItems,
            aiSuggestions,
          });

          return {
            id: list.id,
            name: list.title || list.name,
            description: list.description,
            created_at: list.created_at,
            updated_at: 'updated_at' in list && list.updated_at ? list.updated_at : list.created_at,
            is_completed: Boolean(list.is_completed),
            total_items: totalItems ?? 0,
            completed_items: completedItems ?? 0,
            ai_suggestions_count: aiSuggestions ?? 0,
            ai_confidence: 75,
          };
        })
      );

      logger.info('Shopping lists fetched successfully', {
        userId: user.id,
        householdId: household.id,
        totalLists: shoppingLists?.length ?? 0,
      });

      return createSuccessResponse(
        {
          shoppingLists: listsWithCounts,
          plan: household.plan || 'free',
        },
        'Shopping lists fetched successfully',
      );
    } catch (error) {
      logger.error('Failed to fetch shopping lists', error as Error, {
        userId: user?.id ?? 'unknown',
        route: '/api/shopping-lists',
      });
      return handleApiError(error, { route: '/api/shopping-lists', method: 'GET', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api',
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      type CreateShoppingListPayload = {
        name: string;
        description?: string | null;
      };

      let validatedData: CreateShoppingListPayload;
      try {
        const body = await req.json();
        const { createShoppingListSchema } = await import('@/lib/validation/schemas');
        const tempSchema = createShoppingListSchema.omit({ household_id: true });
        const parsed = tempSchema.parse(body);
        validatedData = {
          ...parsed,
          description: parsed.description ?? null,
        };
      } catch (validationError: unknown) {
        if (validationError instanceof z.ZodError) {
          logger.warn('Shopping list create validation failed', {
            userId: user.id,
            errors: validationError.errors,
          });
          return createErrorResponse('Invalid input', 400, validationError.errors);
        }
        logger.error(
          'Shopping list create validation error',
          validationError instanceof Error ? validationError : new Error(String(validationError)),
          { userId: user.id },
        );
        return createErrorResponse('Invalid input', 400);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household. Please complete onboarding first.', 404, {
          needsOnboarding: true,
          redirectTo: '/onboarding',
        });
      }

      const plan = (household.plan || 'free') as Parameters<typeof canAccessFeature>[0];
      if (!canAccessFeature(plan, 'meal_planner')) {
        return createErrorResponse('Feature not available on your plan', 403, {
          requiredPlan: 'pro',
          currentPlan: household.plan || 'free',
        });
      }

      const supabase = getDatabaseClient();
      const insertData = {
        title: validatedData.name,
        description: validatedData.description ?? null,
        household_id: household.id,
        created_by: user.id,
      };

      const { data: newList, error: createError } = await supabase
        .from('shopping_lists')
        .insert(insertData)
        .select('*')
        .single();

      if (createError) {
        logger.error('Error creating shopping list', createError, {
          userId: user.id,
          householdId: household.id,
        });
        return createErrorResponse('Failed to create shopping list', 500, createError.message);
      }

      await createAuditLog({
        action: 'shopping_list.created',
        targetTable: 'shopping_lists',
        targetId: newList.id,
        userId: user.id,
        metadata: {
          list_name: validatedData.name,
          household_id: household.id,
          user_plan: household.plan || 'free',
        },
      });

      const transformedList = {
        id: newList.id,
        name: newList.title || newList.name,
        description: newList.description,
        created_at: newList.created_at,
        updated_at: 'updated_at' in newList && newList.updated_at ? newList.updated_at : newList.created_at,
        is_completed: Boolean(newList.is_completed),
        total_items: 0,
        completed_items: 0,
        ai_suggestions_count: 0,
        ai_confidence: 0,
      };

      logger.info('Shopping list created', {
        userId: user.id,
        householdId: household.id,
        listId: newList.id,
      });

      return createSuccessResponse(
        {
          shoppingList: transformedList,
          plan: household.plan || 'free',
        },
        'Shopping list created successfully',
      );
    } catch (error) {
      logger.error('Failed to create shopping list', error as Error, {
        userId: user?.id ?? 'unknown',
        route: '/api/shopping-lists',
      });
      return handleApiError(error, { route: '/api/shopping-lists', method: 'POST', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}
