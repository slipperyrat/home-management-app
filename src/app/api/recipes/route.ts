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

      const { data: recipes, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('household_id', household.id)
        .order('created_at', { ascending: false });

      if (error) {
        return createErrorResponse('Failed to fetch recipes', 500, error.message);
      }

      return createSuccessResponse({ recipes: recipes ?? [] }, 'Recipes fetched successfully');
    } catch (error) {
      return handleApiError(error, { route: '/api/recipes', method: 'GET', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
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
        return createErrorResponse('Invalid input', 400, validationError instanceof Error ? validationError : undefined);
      }

      const parsedIngredients = parseIngredients(validatedData.ingredients);
      const parsedInstructions = parseInstructions(validatedData.instructions);

      const ingredientsJson = parsedIngredients as ParsedIngredientsJson;

      const supabase = getDatabaseClient();

      const insertPayload: Database['public']['Tables']['recipes']['Insert'] = {
        household_id: household.id,
        title: validatedData.title,
        description: validatedData.description ?? null,
        ingredients: ingredientsJson,
        instructions: parsedInstructions,
        prep_time: validatedData.prep_time,
        cook_time: validatedData.cook_time,
        servings: validatedData.servings,
        tags: validatedData.tags ?? null,
        created_by: user.id,
      };

      const { data: recipe, error: insertError } = await supabase
        .from('recipes')
        .insert(insertPayload)
        .select('*')
        .maybeSingle<Database['public']['Tables']['recipes']['Row']>();

      if (insertError || !recipe) {
        return createErrorResponse('Failed to save recipe to database', 500, insertError?.message ?? 'Insert failed');
      }

      await createAuditLog({
        action: 'recipe.created',
        targetTable: 'recipes',
        targetId: recipe.id,
        userId: user.id,
        metadata: {
          recipe_title: validatedData.title,
          household_id: household.id,
          ingredients_count: parsedIngredients.length,
        },
      });

      return createSuccessResponse({ recipe }, 'Recipe created successfully');
    } catch (error) {
      return handleApiError(error, { route: '/api/recipes', method: 'POST', userId: user?.id ?? '' });
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
