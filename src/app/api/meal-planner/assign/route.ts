import { NextRequest, NextResponse } from 'next/server'
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { addRecipeIngredientsToGroceries } from '@/lib/server/addRecipeIngredients'
import { mealPlannerAssignSchema } from '@/lib/validation/schemas'

export async function POST(req: NextRequest) {
  return withAPISecurity(req, async (request, user) => {
    try {
      console.log('🚀 POST: Assigning meal for user:', user.id);

      // Parse and validate request body using Zod schema
      let validatedData;
      try {
        const body = await request.json();
        console.log('🔍 Meal Assignment Request Body:', body);
        const tempSchema = mealPlannerAssignSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body);
        console.log('✅ Validation passed:', validatedData);
      } catch (validationError: any) {
        console.log('❌ Validation failed:', validationError.errors);
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { week, day, slot, recipe_id, alsoAddToList, autoConfirm } = validatedData;

      // NOTE: When adding notes/comments to meal slots in the future, sanitize them here:
      // const clean = sanitizeDeep(body, { notes: 'rich' });
      // const notes = clean.notes || null;

      const supabase = getDatabaseClient()

      // fetch or create the meal_plan row
      const { data: existing, error: selErr } = await supabase
        .from('meal_plans').select('*')
        .eq('household_id', household.id).eq('week_start_date', week).maybeSingle()
      if (selErr) {
        return createErrorResponse('Failed to fetch meal plan', 500, selErr.message);
      }

      const meals = existing?.meals ?? {}
      meals[day] = meals[day] || { breakfast: null, lunch: null, dinner: null }
      meals[day][slot] = recipe_id ?? null

      // upsert the plan
      const { data: plan, error: upErr } = await supabase
        .from('meal_plans')
        .upsert([{ household_id: household.id, week_start_date: week, meals }], { onConflict: 'household_id,week_start_date' })
        .select('*').single()
      if (upErr) {
        return createErrorResponse('Failed to update meal plan', 500, upErr.message);
      }

      // optionally add ingredients to grocery list with auto-confirmation
      let ingredientResult = null
      if (alsoAddToList && recipe_id) {
        console.log('🔍 About to call addRecipeIngredientsToGroceriesAuto with:', {
          userId: user.id,
          householdId: household.id,
          recipeId: recipe_id,
          autoConfirm: autoConfirm ?? false,
          sourceMealPlan: { week, day, slot }
        });
        
        // Always use the enhanced auto-version for meal planner assignments
        // Default to autoConfirm: false to require confirmation
        const { addRecipeIngredientsToGroceriesAuto } = await import('@/lib/server/addRecipeIngredientsAuto');
        console.log('🔍 Import successful, calling function...');
        
        ingredientResult = await addRecipeIngredientsToGroceriesAuto(
          user.id, 
          household.id, 
          recipe_id,
          autoConfirm ?? false, // Default to false to require confirmation
          { week, day, slot }
        );
        
        console.log('🔍 addRecipeIngredientsToGroceriesAuto result:', ingredientResult);
        
        if (!ingredientResult.ok) {
          return createErrorResponse('Assigned but failed to add ingredients', 207, ingredientResult.error);
        }
      }

      // Add audit log entry
      await createAuditLog({
        action: 'meal_plan.assigned',
        targetTable: 'meal_plans',
        targetId: plan.id,
        userId: user.id,
        metadata: { 
          week_start: week,
          day,
          meal_type: slot,
          recipe_id,
          household_id: household.id
        }
      });

      return createSuccessResponse({ 
        plan, 
        ingredients: ingredientResult ? {
          added: ingredientResult.added,
          updated: ingredientResult.updated,
          autoAdded: ingredientResult.autoAdded || 0,
          pendingConfirmations: ingredientResult.pendingConfirmations || 0
        } : null
      }, 'Meal assigned successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/meal-planner/assign', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false, // Temporarily disable CSRF to test
    rateLimitConfig: 'api'
  });
}
