// Test endpoint for Meal Planning AI Service
// This can be easily removed if the AI implementation doesn't work

import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { testMealPlanningAI, testMealTypes, testDietaryRestrictions } from '@/lib/ai/test/testMealPlanningAI';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🧪 Testing Meal Planning AI Service for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { searchParams } = new URL(req.url);
      const testType = searchParams.get('testType') || 'basic';

      let testResults: any = {};

      // Run basic test
      if (testType === 'basic' || testType === 'all') {
        console.log('📊 Running basic meal planning test...');
        const basicResult = await testMealPlanningAI();
        testResults.basic = {
          success: basicResult?.success || false,
          provider: basicResult?.provider || 'unknown',
          processingTime: basicResult?.processingTime || 0,
          suggestionsCount: basicResult?.data?.length || 0,
          fallbackUsed: basicResult?.fallbackUsed || false
        };
      }

      // Run meal types test
      if (testType === 'mealTypes' || testType === 'all') {
        console.log('🍽️ Running meal types test...');
        await testMealTypes();
        testResults.mealTypes = 'completed';
      }

      // Run dietary restrictions test
      if (testType === 'dietary' || testType === 'all') {
        console.log('🥗 Running dietary restrictions test...');
        await testDietaryRestrictions();
        testResults.dietaryRestrictions = 'completed';
      }

      return createSuccessResponse({
        testResults,
        testType,
        timestamp: new Date().toISOString()
      }, 'Meal planning AI service test completed successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/ai/test-meal-planning', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}
