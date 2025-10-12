import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { ShoppingSuggestionsAIService, ShoppingContext } from '@/lib/ai/services/ShoppingSuggestionsAIService';
import { isAIEnabled } from '@/lib/ai/config/aiConfig';
import { logger } from '@/lib/logging/logger';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
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
      const context: ShoppingContext = {
        householdId: household.id,
        dietaryRestrictions,
        budget,
        specialOccasions
      };

      // Generate AI suggestions
      const aiService = new ShoppingSuggestionsAIService();
      const result = await aiService.generateSuggestions(context);

      if (!result.success) {
        logger.error('AI shopping suggestions failed', result.error instanceof Error ? result.error : new Error(String(result.error)), {
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
      return handleApiError(error, { route: '/api/ai/shopping-suggestions', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

