// Test endpoint for Meal Planning AI Service
// This can be easily removed if the AI implementation doesn't work

import { NextRequest } from "next/server";

import { testMealPlanningAI, testMealTypes, testDietaryRestrictions } from "@/lib/ai/harness/mealPlanningHarness";
import { createErrorResponse, createSuccessResponse, handleApiError } from "@/lib/api/errors";
import { getUserAndHouseholdData } from "@/lib/api/database";
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user) {
        logger.warn('Meal planning AI test requested without authenticated user');
        return createErrorResponse('Unauthorized', 401);
      }

      logger.info('Testing meal planning AI service', { userId: user.id });

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { searchParams } = new URL(req.url);
      const testType = searchParams.get('testType') || 'basic';

      const testResults: Record<string, unknown> = {};

      // Run basic test
      if (testType === 'basic' || testType === 'all') {
        logger.info('Running meal planning basic test');
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
        logger.info('Running meal types test');
        await testMealTypes();
        testResults.mealTypes = 'completed';
      }

      // Run dietary restrictions test
      if (testType === 'dietary' || testType === 'all') {
        logger.info('Running dietary restrictions test');
        await testDietaryRestrictions();
        testResults.dietaryRestrictions = 'completed';
      }

      return createSuccessResponse({
        testResults,
        testType,
        timestamp: new Date().toISOString()
      }, 'Meal planning AI service test completed successfully');

    } catch (error) {
      const errorContext: {
        route: string;
        method: string;
        userId?: string;
      } = {
        route: '/api/ai/test-meal-planning',
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
