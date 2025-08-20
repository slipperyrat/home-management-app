import { NextRequest, NextResponse } from 'next/server';
import { sb, getUserAndHousehold, createErrorResponse, ServerError } from '@/lib/server/supabaseAdmin';
import { MealService, MealSuggestionParams } from '@/lib/services/meal/MealService';

export async function GET(request: NextRequest) {
  try {
    const { householdId } = await getUserAndHousehold();
    const { searchParams } = new URL(request.url);
    
    // Extract and validate parameters
    const mealType = searchParams.get('mealType') || 'dinner';
    const dietaryRestrictions = searchParams.get('dietaryRestrictions')?.split(',').filter(Boolean) || [];
    const maxPrepTime = searchParams.get('maxPrepTime') ? parseInt(searchParams.get('maxPrepTime')!) : 60;
    const servings = searchParams.get('servings') ? parseInt(searchParams.get('servings')!) : 4;

    // Validate parameters
    if (maxPrepTime < 0 || maxPrepTime > 1440) {
      return NextResponse.json({ 
        error: 'maxPrepTime must be between 0 and 1440 minutes' 
      }, { status: 400 });
    }

    if (servings < 1 || servings > 50) {
      return NextResponse.json({ 
        error: 'servings must be between 1 and 50' 
      }, { status: 400 });
    }

    // Create meal suggestion parameters
    const params: MealSuggestionParams = {
      mealType,
      dietaryRestrictions,
      maxPrepTime,
      servings,
      householdId
    };

    // Use the meal service to generate suggestions
    const mealService = new MealService();
    const result = await mealService.generateSuggestions(params);

    return NextResponse.json({ 
      success: true, 
      ...result 
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    
    console.error('Unexpected error in GET /api/ai/meal-suggestions:', error);
    return createErrorResponse(new ServerError('Internal server error'));
  }
}
