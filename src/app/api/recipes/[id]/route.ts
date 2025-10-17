import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createRecipeInputSchema } from '@/lib/validation/schemas';
import type { Database, Json } from '@/types/supabase.generated';
import { z } from 'zod';

type ParsedIngredient = {
  name: string;
  amount: number | null;
  unit: string | null;
  notes: string | null;
};

type ParsedIngredientsJson = Json;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPISecurity(request, async (_req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { id: recipeId } = await params;

      if (!recipeId) {
        return createErrorResponse('Recipe ID is required', 400);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();

      const { data: existingRecipe, error: fetchError } = await supabase
        .from('recipes')
        .select('id, household_id, title')
        .eq('id', recipeId)
        .eq('household_id', household.id)
        .maybeSingle<Pick<Database['public']['Tables']['recipes']['Row'], 'id' | 'household_id' | 'title'>>();

      if (fetchError || !existingRecipe) {
        return createErrorResponse('Recipe not found or access denied', 404);
      }

      const { error: deleteError } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId)
        .eq('household_id', household.id);

      if (deleteError) {
        return createErrorResponse('Failed to delete recipe', 500, deleteError.message);
      }

      await createAuditLog({
        action: 'recipe.deleted',
        targetTable: 'recipes',
        targetId: recipeId,
        userId: user.id,
        metadata: {
          recipe_title: existingRecipe.title,
          household_id: household.id,
        },
      });

      return createSuccessResponse({}, 'Recipe deleted successfully');
    } catch (error) {
      return handleApiError(error, { route: '/api/recipes/[id]', method: 'DELETE', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
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

      const { id: recipeId } = await params;
      if (!recipeId) {
        return createErrorResponse('Recipe ID is required', 400);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      let validatedData: z.infer<typeof createRecipeInputSchema>;
      try {
        const body = await req.json();
        validatedData = createRecipeInputSchema.parse(body);
      } catch (validationError: unknown) {
        if (validationError instanceof z.ZodError) {
          return createErrorResponse('Invalid input', 400, validationError.errors);
        }
        return createErrorResponse('Invalid input', 400);
      }

      const supabase = getDatabaseClient();

      const { data: existingRecipe, error: fetchError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .eq('household_id', household.id)
        .maybeSingle<Database['public']['Tables']['recipes']['Row']>();

      if (fetchError || !existingRecipe) {
        return createErrorResponse('Recipe not found or access denied', 404);
      }

      const ingredients = parseIngredients(validatedData.ingredients);
      const instructions = parseInstructions(validatedData.instructions);

      const updatePayload: Database['public']['Tables']['recipes']['Update'] = {
        title: validatedData.title,
        description: validatedData.description ?? existingRecipe.description ?? null,
        ingredients: ingredients as ParsedIngredientsJson,
        instructions,
        prep_time: validatedData.prep_time,
        cook_time: validatedData.cook_time,
        servings: validatedData.servings,
        tags: validatedData.tags ?? existingRecipe.tags ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data: recipe, error: updateError } = await supabase
        .from('recipes')
        .update(updatePayload)
        .eq('id', recipeId)
        .eq('household_id', household.id)
        .select('*')
        .maybeSingle<Database['public']['Tables']['recipes']['Row']>();

      if (updateError || !recipe) {
        return createErrorResponse('Failed to update recipe in database', 500, updateError?.message ?? 'Update failed');
      }

      await createAuditLog({
        action: 'recipe.updated',
        targetTable: 'recipes',
        targetId: recipeId,
        userId: user.id,
        metadata: {
          recipe_title: recipe.title,
          household_id: household.id,
          ingredients_count: ingredients.length,
        },
      });

      return createSuccessResponse({ recipe }, 'Recipe updated successfully');
    } catch (error) {
      return handleApiError(error, { route: '/api/recipes/[id]', method: 'PUT', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}

function parseIngredients(ingredientsText: string): ParsedIngredient[] {
  if (!ingredientsText) {
    return [];
  }

  const lines = ingredientsText
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const match = line.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s*(.*)$/);

    if (match) {
      const [, amount, unit, name] = match;
      const parsedAmount = amount ? Number.parseFloat(amount) : null;

      return {
        name: (name || '').trim(),
        amount: Number.isFinite(parsedAmount ?? NaN) ? parsedAmount : null,
        unit: unit?.trim() ?? null,
        notes: null,
      };
    }

    return {
      name: line,
      amount: null,
      unit: null,
      notes: null,
    };
  });
}

function parseInstructions(instructionsText: string): string[] {
  if (!instructionsText) {
    return [];
  }

  return instructionsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(\d+\.?\s*|Step\s*\d+:\s*)/i, '').trim() || line);
}
