import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { MealPlanningAIService, MealPlanningContext } from '@/lib/ai/services/MealPlanningAIService';
import { isAIEnabled } from '@/lib/ai/config/aiConfig';
import { logger } from '@/lib/logging/logger';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user) {
        logger.warn('AI meal suggestions requested without authenticated user');
        return createErrorResponse('Unauthorized', 401);
      }

      logger.info('Fetching AI meal suggestions', { userId: user.id });

      // Check if AI is enabled
      if (!isAIEnabled('mealPlanning')) {
        logger.info('Meal planning AI disabled, returning empty suggestions');
        return createSuccessResponse({ suggestions: [] }, 'AI meal planning disabled');
      }

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { searchParams } = new URL(req.url);
      
      // Extract and validate parameters
      const mealType = (searchParams.get('mealType') as 'breakfast' | 'lunch' | 'dinner' | 'snack') || 'dinner';
      const dietaryRestrictions = searchParams.get('dietaryRestrictions')?.split(',').filter(Boolean) || [];
      const maxPrepTime = searchParams.get('maxPrepTime') ? parseInt(searchParams.get('maxPrepTime')!) : 60;
      const servings = searchParams.get('servings') ? parseInt(searchParams.get('servings')!) : 4;
      const cuisine = searchParams.get('cuisine') || undefined;
      const budget = searchParams.get('budget') ? parseInt(searchParams.get('budget')!) : undefined;
      const skillLevel = (searchParams.get('skillLevel') as 'beginner' | 'intermediate' | 'advanced') || 'intermediate';
      const availableIngredients = searchParams.get('availableIngredients')?.split(',').filter(Boolean) || [];
      const avoidIngredients = searchParams.get('avoidIngredients')?.split(',').filter(Boolean) || [];
      const specialOccasions = searchParams.get('specialOccasions')?.split(',').filter(Boolean) || [];

      // Validate parameters
      if (maxPrepTime < 0 || maxPrepTime > 1440) {
        return createErrorResponse('maxPrepTime must be between 0 and 1440 minutes', 400);
      }

      if (servings < 1 || servings > 50) {
        return createErrorResponse('servings must be between 1 and 50', 400);
      }

      // Create meal planning context
      const context: MealPlanningContext = {
        householdId: household.id,
        mealType,
        dietaryRestrictions,
        maxPrepTime,
        servings,
        skillLevel,
        availableIngredients,
        avoidIngredients,
        specialOccasions
      };

      if (cuisine) {
        context.cuisine = cuisine;
      }

      if (budget !== undefined) {
        context.budget = budget;
      }

      // Generate AI meal suggestions
      const aiService = new MealPlanningAIService();
      const result = await aiService.generateMealSuggestions(context);

      if (!result.success) {
        const errorValue = result.error as unknown;
        const errorObject = errorValue instanceof Error
          ? errorValue
          : new Error(String(errorValue ?? 'Unknown AI meal suggestion error'));

        logger.error('AI meal suggestion generation failed', errorObject, {
          userId: user.id,
          householdId: household.id,
        });
        return createErrorResponse(result.error || 'Failed to generate meal suggestions', 500);
      }

      logger.info('Generated AI meal suggestions', {
        userId: user.id,
        householdId: household.id,
        provider: result.provider,
        count: result.data?.length ?? 0,
        fallbackUsed: result.fallbackUsed,
        processingTime: result.processingTime,
      });

      return createSuccessResponse({
        suggestions: result.data || [],
        provider: result.provider,
        processingTime: result.processingTime,
        fallbackUsed: result.fallbackUsed
      }, 'AI meal suggestions generated successfully');

    } catch (error) {
      const errorContext: {
        route: string;
        method: string;
        userId?: string;
      } = {
        route: '/api/ai/meal-suggestions',
        method: 'GET'
      };

      if (user?.id) {
        errorContext.userId = user.id;
      }

      return handleApiError(error, errorContext);
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}
