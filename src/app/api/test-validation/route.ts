import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { schemas } from '@/lib/validation/schemas';
import { requireFeatureAccess, getAvailableFeatures } from '@/lib/server/canAccessFeature';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Test Zod validation
    let validatedData;
    try {
      const body = await request.json();
      // Test with shopping list schema
      validatedData = schemas.createShoppingList.parse(body);
    } catch (validationError: any) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationError.errors,
        schema: 'createShoppingList'
      }, { status: 400 });
    }

    // Test feature access
    const testPlan = 'free'; // You can change this to test different plans
    const availableFeatures = getAvailableFeatures(testPlan);
    
    try {
      requireFeatureAccess(testPlan, 'meal_planner');
    } catch (error) {
      return NextResponse.json({ 
        error: 'Feature access test failed',
        requiredPlan: 'premium',
        currentPlan: testPlan,
        availableFeatures
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      message: 'All validation tests passed!',
      validatedData,
      testPlan,
      availableFeatures,
      featureAccess: 'meal_planner'
    });

  } catch (error) {
    console.error('Test validation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  // Test endpoint to show available schemas and features
  return NextResponse.json({
    success: true,
    message: 'Validation test endpoint',
    availableSchemas: Object.keys(schemas),
    featureKeys: [
      'grocery_auto_gen',
      'leaderboard', 
      'meal_planner',
      'advanced_analytics',
      'ai_insights',
      'automation_rules',
      'priority_support',
      'data_export',
      'recurring_chores',
      'calendar_sync'
    ],
    usage: {
      'POST /api/test-validation': 'Test Zod validation with shopping list data',
      'GET /api/test-validation': 'Show available schemas and features'
    }
  });
}
