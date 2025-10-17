import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { getUserAndHouseholdData, getDatabaseClient, createAuditLog } from '@/lib/api/database';
import { canAccessFeatureFromEntitlements } from '@/lib/server/canAccessFeature';
import { logger } from '@/lib/logging/logger';
import type { Entitlements } from '@/lib/entitlements';
import type { Database } from '@/types/supabase.generated';

const SPOONACULAR_ENDPOINT = 'https://api.spoonacular.com/recipes/extract';

interface SpoonacularRecipe {
  title?: string;
  image?: string;
  analyzedInstructions?: Array<{ name?: string; steps?: Array<{ number: number; step: string }> }>;
  readyInMinutes?: number;
  servings?: number;
  extendedIngredients?: Array<{
    original?: string;
    amount?: number;
    unit?: string;
    name?: string;
  }>;
  summary?: string;
}

const SUPPORTED_RECIPE_COLUMNS = new Set<keyof Database['public']['Tables']['recipes']['Insert']>([
  'household_id',
  'title',
  'description',
  'ingredients',
  'instructions',
  'prep_time',
  'cook_time',
  'servings',
  'image_url',
  'tags',
  'created_by',
  'source_url',
  'total_time',
  'yield',
]);

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Simple JSON body parsing
      let url: string | undefined;
      try {
        const body = await req.json();
        url = body?.url;
      } catch {
        return createErrorResponse('Invalid JSON body', 400);
      }

      if (!url || typeof url !== 'string') {
        return createErrorResponse('Recipe URL is required', 400);
      }

      if (!process.env.SPOONACULAR_API_KEY) {
        return createErrorResponse('Spoonacular integration is not configured', 503);
      }

      const db = getDatabaseClient();

      const { data: entitlementsRecord } = await db
        .from('entitlements')
        .select('*')
        .eq('household_id', household.id)
        .maybeSingle<Entitlements>();

      const effectiveEntitlements = entitlementsRecord ?? null;

      if (!effectiveEntitlements || !canAccessFeatureFromEntitlements(effectiveEntitlements, 'recipe_import_url')) {
        return createErrorResponse('Recipe import by URL requires a higher plan tier', 403, {
          requiredPlan: 'pro',
          currentPlan: household.plan || 'free',
        });
      }

      // Call Spoonacular analyzeRecipe
      let spoonacularData: SpoonacularRecipe | null = null;

      try {
        const endpointUrl = `${SPOONACULAR_ENDPOINT}?apiKey=${process.env.SPOONACULAR_API_KEY}&url=${encodeURIComponent(url)}&includeNutrition=false`;
        const response = await fetch(endpointUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          if (response.status === 402 || response.status === 429) {
            return createErrorResponse('Spoonacular quota exceeded. Try again later or paste recipe text.', 429);
          }

          const errorText = await response.text();
          return createErrorResponse('Failed to fetch recipe from Spoonacular', response.status, errorText);
        }

        spoonacularData = await response.json();
      } catch (error) {
        console.error('Spoonacular request failed:', error);
        return createErrorResponse('Failed to contact Spoonacular', 502);
      }

      if (!spoonacularData || !spoonacularData.title) {
        return createErrorResponse('Unable to import this recipe from the source website right now. Please try another link or add it manually.', 502);
      }

      const ingredients = (spoonacularData.extendedIngredients || []).map((ingredient) => ({
        name: ingredient.name || ingredient.original || 'Ingredient',
        amount: typeof ingredient.amount === 'number' && Number.isFinite(ingredient.amount) ? ingredient.amount : null,
        unit: ingredient.unit ?? null,
        notes: null,
      }));

      const instructions = (spoonacularData.analyzedInstructions || [])
        .flatMap((section) => section.steps || [])
        .map((step) => step.step?.trim())
        .filter((step): step is string => Boolean(step));

      const totalTime = spoonacularData.readyInMinutes ?? null;

      const insertPayload: Database['public']['Tables']['recipes']['Insert'] = {
        household_id: household.id,
        created_by: user.id,
        title: spoonacularData.title ?? 'Imported recipe',
        image_url: spoonacularData.image ?? null,
        ingredients,
        instructions: instructions.length > 0 ? instructions : null,
      };

      if (SUPPORTED_RECIPE_COLUMNS.has('description') && spoonacularData.summary) {
        insertPayload.description = spoonacularData.summary;
      }

      if (SUPPORTED_RECIPE_COLUMNS.has('prep_time') && totalTime !== null) {
        insertPayload.prep_time = totalTime;
      }

      if (SUPPORTED_RECIPE_COLUMNS.has('cook_time')) {
        insertPayload.cook_time = 0;
      }

      if (SUPPORTED_RECIPE_COLUMNS.has('servings') && spoonacularData.servings) {
        insertPayload.servings = spoonacularData.servings;
      }

      if (SUPPORTED_RECIPE_COLUMNS.has('source_url')) {
        insertPayload.source_url = url;
      }

      if (SUPPORTED_RECIPE_COLUMNS.has('total_time')) {
        insertPayload.total_time = totalTime;
      }

      if (SUPPORTED_RECIPE_COLUMNS.has('yield') && spoonacularData.servings) {
        insertPayload.yield = `${spoonacularData.servings} servings`;
      }

      const { data: recipe, error: insertError } = await db
        .from('recipes')
        .insert(insertPayload)
        .select('id')
        .maybeSingle<{ id: string }>();

      if (insertError) {
        logger.error('Failed to save imported recipe', new Error(insertError.message), { householdId: household.id, userId: user.id });
        return createErrorResponse('Failed to save recipe', 500, insertError.message);
      }

      if (!recipe) {
        return createErrorResponse('Failed to save recipe', 500);
      }

      await createAuditLog({
        action: 'recipe.imported_url',
        targetTable: 'recipes',
        targetId: recipe.id,
        userId: user.id,
        metadata: {
          source_url: url,
          provider: 'spoonacular',
        },
      });

      return createSuccessResponse({ recipe_id: recipe.id }, 'Recipe imported successfully');
    } catch (error) {
      return handleApiError(error, {
        route: '/api/recipes/import',
        method: 'POST',
        ...(user?.id ? { userId: user.id } : {}),
      });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}

