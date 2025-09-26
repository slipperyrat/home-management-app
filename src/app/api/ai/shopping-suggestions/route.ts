import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { ShoppingSuggestionsAIService, ShoppingContext } from '@/lib/ai/services/ShoppingSuggestionsAIService';
import { isAIEnabled } from '@/lib/ai/config/aiConfig';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 GET: Fetching AI shopping suggestions for user:', user.id);

      // Check if AI is enabled
      if (!isAIEnabled('shoppingSuggestions')) {
        console.log('⚠️ Shopping suggestions AI is disabled, returning empty suggestions');
        return createSuccessResponse({ suggestions: [] }, 'AI shopping suggestions disabled');
      }

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
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
        console.error('AI service failed:', result.error);
        return createErrorResponse(result.error || 'Failed to generate suggestions', 500);
      }

      console.log(`✅ Generated ${result.data?.length || 0} AI shopping suggestions using ${result.provider}`);

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

