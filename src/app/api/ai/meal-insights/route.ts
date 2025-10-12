import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient, getUserAndHousehold, createErrorResponse, ServerError } from '@/lib/server/supabaseAdmin';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database.types';

export async function GET(_request: NextRequest) {
  try {
    const { householdId } = await getUserAndHousehold();

    // Fetch meal planning data for AI analysis
    const supabase = getSupabaseAdminClient();

    const [mealPlansResponse, recipesResponse, householdResponse] = await Promise.all([
      supabase
        .from('meal_plans')
        .select('*')
        .eq('household_id', householdId)
        .order('week_start_date', { ascending: false })
        .limit(12), // Last 12 weeks
      
      supabase
        .from('recipes')
        .select('*')
        .eq('household_id', householdId),
      
      supabase
        .from('households')
        .select('*')
        .eq('id', householdId)
        .single()
    ]);

    if (mealPlansResponse.error) {
      logger.error('Failed to fetch meal plans', mealPlansResponse.error, { householdId });
      throw new ServerError('Failed to fetch meal plans', 500);
    }

    if (recipesResponse.error) {
      logger.error('Failed to fetch recipes', recipesResponse.error, { householdId });
      throw new ServerError('Failed to fetch recipes', 500);
    }

    if (householdResponse.error) {
      logger.error('Failed to fetch household', householdResponse.error, { householdId });
      throw new ServerError('Failed to fetch household', 500);
    }

    const mealPlans = mealPlansResponse.data || [];
    const recipes = recipesResponse.data || [];
    const household = householdResponse.data;

    // Calculate AI insights
    const insights = calculateAIMealInsights(mealPlans, recipes, household);

    return NextResponse.json({ success: true, insights });
  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }

    logger.error('Unexpected error in GET /api/ai/meal-insights:', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse(new ServerError('Internal server error'));
  }
}

type MealPlanRecord = Database['public']['Tables']['meal_plans']['Row'];
type RecipeRecord = Database['public']['Tables']['recipes']['Row'];
type HouseholdRecord = Database['public']['Tables']['households']['Row'];

type MealType = 'breakfast' | 'lunch' | 'dinner';

type MealPlanMeals = Record<string, Partial<Record<MealType, string | null>>> | null;

type PopularRecipe = {
  id: string;
  title: string;
  usage_count: number;
  category: string;
};

type NutritionalInsights = {
  protein_heavy_meals: number;
  carb_heavy_meals: number;
  balanced_meals: number;
  vegetarian_meals: number;
};

type MealInsights = {
  total_weeks_planned: number;
  total_meals_planned: number;
  planning_consistency: number;
  meal_type_distribution: Record<MealType, number>;
  popular_recipes: PopularRecipe[];
  nutritional_insights: NutritionalInsights;
  suggested_improvements: string[];
  ai_learning_progress: number;
  household_preferences: {
    preferred_meal_types: MealType[];
    average_meals_per_week: number;
  };
  seasonal_recommendations: ReturnType<typeof generateSeasonalRecommendations>;
  nutritional_goals: ReturnType<typeof generateNutritionalGoals>;
};

function calculateAIMealInsights(
  mealPlans: MealPlanRecord[],
  recipes: RecipeRecord[],
  household: HouseholdRecord,
): MealInsights {
  // Analyze meal planning patterns
  const totalWeeks = mealPlans.length;
  const totalMeals = mealPlans.reduce((sum, plan) => {
    const meals = plan.meals as MealPlanMeals;
    if (!meals) {
      return sum;
    }

    const dayTotal = Object.values(meals).reduce((daySum, dayMeals) => {
      if (!dayMeals) {
        return daySum;
      }

      return daySum + Object.values(dayMeals).filter(Boolean).length;
    }, 0);

    return sum + dayTotal;
  }, 0);

  // Calculate meal type distribution
  const mealTypeCounts: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0 };
  mealPlans.forEach((plan) => {
    const meals = plan.meals as MealPlanMeals;
    if (!meals) {
      return;
    }

    Object.values(meals).forEach((dayMeals) => {
      if (!dayMeals) {
        return;
      }

      (Object.entries(dayMeals) as Array<[MealType, string | null]>).forEach(([mealType, recipeId]) => {
        if (recipeId) {
          mealTypeCounts[mealType] += 1;
        }
      });
    });
  });

  // Analyze recipe preferences
  const recipeUsage = new Map<string, number>();
  mealPlans.forEach((plan) => {
    const meals = plan.meals as MealPlanMeals;
    if (!meals) {
      return;
    }

    Object.values(meals).forEach((dayMeals) => {
      if (!dayMeals) {
        return;
      }

      Object.values(dayMeals).forEach((recipeId) => {
        if (recipeId) {
          const recipeIdString = String(recipeId);
          recipeUsage.set(recipeIdString, (recipeUsage.get(recipeIdString) || 0) + 1);
        }
      });
    });
  });

  // Get most popular recipes
  const popularRecipes = Array.from(recipeUsage.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([recipeId, count]) => {
      const recipe = recipes.find((r) => r.id === recipeId);
      return {
        id: recipeId,
        title: recipe?.title ?? 'Unknown Recipe',
        usage_count: count,
        category: recipe?.tags?.[0] ?? 'general',
      };
    });

  // Calculate nutritional balance (if recipe data includes nutrition info)
  const nutritionalInsights: NutritionalInsights = {
    protein_heavy_meals: 0,
    carb_heavy_meals: 0,
    balanced_meals: 0,
    vegetarian_meals: 0,
  };

  // Analyze meal planning consistency
  const planningConsistency = totalWeeks > 0 ? (totalMeals / (totalWeeks * 21)) * 100 : 0; // 21 meals per week

  // Generate improvement suggestions
  const suggestions: string[] = [];
  if (planningConsistency < 50) {
    suggestions.push('Consider planning more meals in advance to improve consistency');
  }
  if (mealTypeCounts.breakfast < mealTypeCounts.dinner * 0.3) {
    suggestions.push('Try to plan more breakfast options for better meal variety');
  }
  if (popularRecipes.length > 0 && popularRecipes[0] && popularRecipes[0].usage_count > totalWeeks * 2) {
    suggestions.push('Consider adding more recipe variety to avoid repetition');
  }

  // Calculate AI learning progress based on data availability
  const dataCompleteness = Math.min(100, (totalWeeks / 8) * 100); // 8+ weeks = 100%

  return {
    total_weeks_planned: totalWeeks,
    total_meals_planned: totalMeals,
    planning_consistency: Math.round(planningConsistency),
    meal_type_distribution: mealTypeCounts,
    popular_recipes: popularRecipes,
    nutritional_insights: nutritionalInsights,
    suggested_improvements: suggestions,
    ai_learning_progress: Math.round(dataCompleteness),
    household_preferences: {
      preferred_meal_types: Object.entries(mealTypeCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([type]) => type as MealType),
      average_meals_per_week: totalWeeks > 0 ? Math.round(totalMeals / totalWeeks) : 0
    },
    seasonal_recommendations: generateSeasonalRecommendations(),
    nutritional_goals: generateNutritionalGoals(household)
  };
}

function generateSeasonalRecommendations() {
  const currentMonth = new Date().getMonth();
  const seasons = {
    winter: [11, 0, 1], // Dec, Jan, Feb
    spring: [2, 3, 4],  // Mar, Apr, May
    summer: [5, 6, 7],  // Jun, Jul, Aug
    fall: [8, 9, 10]    // Sep, Oct, Nov
  };

  let currentSeason = 'winter';
  for (const [season, months] of Object.entries(seasons)) {
    if (months.includes(currentMonth)) {
      currentSeason = season;
      break;
    }
  }

  const seasonalSuggestions = {
    winter: ['Warm soups and stews', 'Root vegetables', 'Comfort foods'],
    spring: ['Fresh greens and herbs', 'Light salads', 'Spring vegetables'],
    summer: ['Grilled dishes', 'Fresh fruits', 'Cool salads'],
    fall: ['Pumpkin and squash', 'Warm spices', 'Harvest vegetables']
  };

  return {
    current_season: currentSeason,
    recommendations: seasonalSuggestions[currentSeason as keyof typeof seasonalSuggestions] || []
  };
}

function generateNutritionalGoals(household: HouseholdRecord) {
  // This could be enhanced with actual household nutritional preferences
  return {
    balanced_meals: 'Aim for protein, carbs, and vegetables in each meal',
    variety: 'Include different food groups throughout the week',
    seasonal_focus: 'Prioritize seasonal ingredients for freshness and cost',
    household_size_adjustment: `Adjust portions for ${household?.member_count || 'your'} household members`
  };
}
