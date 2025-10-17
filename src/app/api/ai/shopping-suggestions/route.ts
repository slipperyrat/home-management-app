import { NextRequest } from 'next/server';
import { RequestUser, withAPISecurity } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { ShoppingSuggestionsAIService, ShoppingSuggestionsContext } from '@/lib/ai/services/ShoppingSuggestionsAIService';
import { isAIEnabled } from '@/lib/ai/config/aiConfig';
import { logger } from '@/lib/logging/logger';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user) {
        logger.warn('AI shopping suggestions requested without authenticated user');
        return createErrorResponse('Unauthorized', 401);
      }

      logger.info('Fetching AI shopping suggestions', { userId: user.id });

      // Check if AI is enabled
      if (!isAIEnabled('shoppingSuggestions')) {
        logger.info('Shopping suggestions AI disabled, returning empty result');
        return createSuccessResponse({ suggestions: [] }, 'AI shopping suggestions disabled');
      }

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { searchParams } = new URL(req.url);
      
      // Extract context parameters
      const dietaryRestrictions = searchParams.get('dietaryRestrictions')?.split(',').filter(Boolean) || [];
      const budget = searchParams.get('budget') ? parseInt(searchParams.get('budget')!) : undefined;
      const specialOccasions = searchParams.get('specialOccasions')?.split(',').filter(Boolean) || [];

      // Create shopping context
      const context: ShoppingSuggestionsContext = {
        householdId: household.id
      };

      if (dietaryRestrictions && dietaryRestrictions.length > 0) {
        context.dietaryRestrictions = dietaryRestrictions;
      }

      if (typeof budget === 'number') {
        context.budget = budget;
      }

      if (specialOccasions && specialOccasions.length > 0) {
        context.specialOccasions = specialOccasions;
      }

      // Generate AI suggestions
      const aiService = new ShoppingSuggestionsAIService();
      const result = await aiService.generateSuggestions(context);

      if (!result.success) {
        const errorValue = result.error as unknown;
        const errorObject = errorValue instanceof Error
          ? errorValue
          : new Error(String(errorValue ?? 'Unknown AI shopping suggestion error'));

        logger.error('AI shopping suggestions failed', errorObject, {
          userId: user.id,
          householdId: household.id,
        });
        return createErrorResponse(result.error || 'Failed to generate suggestions', 500);
      }

      logger.info('Generated AI shopping suggestions', {
        userId: user.id,
        householdId: household.id,
        provider: result.provider,
        count: result.data?.length ?? 0,
        processingTime: result.processingTime,
        fallbackUsed: result.fallbackUsed,
      });

      return createSuccessResponse({
        suggestions: result.data || [],
        provider: result.provider,
        processingTime: result.processingTime,
        fallbackUsed: result.fallbackUsed
      }, 'AI shopping suggestions generated successfully');

    } catch (error) {
      const errorContext: {
        route: string;
        method: string;
        userId?: string;
      } = {
        route: '/api/ai/shopping-suggestions',
        method: 'POST'
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

