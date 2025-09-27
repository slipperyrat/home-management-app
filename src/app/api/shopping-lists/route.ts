import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { canAccessFeature } from '@/lib/server/canAccessFeature';
import { logger } from '@/lib/logging/logger';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Query shopping lists for the household
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

      // Get item counts for each list
      const listsWithCounts = await Promise.all(
        shoppingLists?.map(async (list) => {
          // Get total items count
          const { count: totalItems } = await supabase
            .from('shopping_items')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id);

          // Get completed items count
          const { count: completedItems } = await supabase
            .from('shopping_items')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id)
            .eq('is_complete', true);

          // Get AI suggestions count
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
            aiSuggestions
          });

          return {
            id: list.id,
            name: list.title || list.name,
            description: list.description,
            created_at: list.created_at,
            updated_at: list.updated_at || list.created_at,
            is_completed: false,
            total_items: totalItems || 0,
            completed_items: completedItems || 0,
            ai_suggestions_count: aiSuggestions || 0,
            ai_confidence: 75
          };
        }) || []
      );

      logger.info('Shopping lists fetched successfully', {
        userId: user.id,
        householdId: household.id,
        totalLists: shoppingLists?.length || 0,
      });

      return createSuccessResponse({
        shoppingLists: listsWithCounts,
        plan: household.plan || 'free'
      }, 'Shopping lists fetched successfully');

    } catch (error) {
      logger.error('Failed to fetch shopping lists', error as Error, {
        userId: user.id,
        route: '/api/shopping-lists',
      });
      return handleApiError(error, { route: '/api/shopping-lists', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      // Validate input using Zod
      let validatedData;
      try {
        const body = await req.json();
        const { createShoppingListSchema } = await import('@/lib/validation/schemas');
        const tempSchema = createShoppingListSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body);
      } catch (validationError: any) {
        logger.warn('Shopping list create validation failed', {
          userId: user.id,
          errors: validationError.errors,
        });
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household. Please complete onboarding first.', 404, {
          needsOnboarding: true,
          redirectTo: '/onboarding'
        });
      }

      // Check feature access
      if (!canAccessFeature(household.plan || 'free', 'meal_planner')) {
        return createErrorResponse('Feature not available on your plan', 403, {
          requiredPlan: 'pro',
          currentPlan: household.plan || 'free'
        });
      }

      // Create new shopping list
      const supabase = getDatabaseClient();
      const insertData = {
        title: validatedData.name,
        description: validatedData.description,
        household_id: household.id,
        created_by: user.id
      };

      const { data: newList, error: createError } = await supabase
        .from('shopping_lists')
        .insert(insertData)
        .select()
        .single();

      if (createError) {
        logger.error('Error creating shopping list', createError, {
          userId: user.id,
          householdId: household.id,
        });
        return createErrorResponse('Failed to create shopping list', 500, createError.message);
      }

      // Add audit log entry
      await createAuditLog({
        action: 'shopping_list.created',
        targetTable: 'shopping_lists',
        targetId: newList.id,
        userId: user.id,
        metadata: { 
          list_name: validatedData.name,
          household_id: household.id,
          user_plan: household.plan || 'free'
        }
      });

      // Transform the new list to match the GET response format
      const transformedList = {
        id: newList.id,
        name: newList.title || newList.name,
        description: newList.description,
        created_at: newList.created_at,
        updated_at: newList.updated_at || newList.created_at,
        is_completed: false,
        total_items: 0,
        completed_items: 0,
        ai_suggestions_count: 0,
        ai_confidence: 75
      };

      logger.info('Shopping list created', {
        userId: user.id,
        householdId: household.id,
        listId: newList.id,
      });

      return createSuccessResponse({
        shoppingList: transformedList,
        plan: household.plan || 'free'
      }, 'Shopping list created successfully');

    } catch (error) {
      logger.error('Failed to create shopping list', error as Error, {
        userId: user.id,
        route: '/api/shopping-lists',
      });
      return handleApiError(error, { route: '/api/shopping-lists', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
