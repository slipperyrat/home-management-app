// Test endpoint for Shopping AI Service
// This can be easily removed if the AI implementation doesn't work

import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { testShoppingAI, testAIConfig } from '@/lib/ai/test/testShoppingAI';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🧪 Testing Shopping AI Service for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Run configuration test
      console.log('📊 Running configuration test...');
      testAIConfig();

      // Run AI service test
      console.log('🤖 Running AI service test...');
      const aiResult = await testShoppingAI();

      if (!aiResult) {
        return createErrorResponse('AI service test failed', 500);
      }

      return createSuccessResponse({
        testResults: {
          configuration: 'passed',
          aiService: aiResult.success ? 'passed' : 'failed',
          provider: aiResult.provider,
          processingTime: aiResult.processingTime,
          suggestionsCount: aiResult.data?.length || 0,
          fallbackUsed: aiResult.fallbackUsed
        },
        sampleSuggestion: aiResult.data?.[0] || null
      }, 'AI service test completed successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/ai/test-shopping', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}
