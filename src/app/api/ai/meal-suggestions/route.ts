import { NextRequest, NextResponse } from 'next/server';
import { sb, getUserAndHousehold, createErrorResponse, ServerError } from '@/lib/server/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const { householdId } = await getUserAndHousehold();
    const { searchParams } = new URL(request.url);
    
    const mealType = searchParams.get('mealType') || 'dinner';
    const dietaryRestrictions = searchParams.get('dietaryRestrictions')?.split(',') || [];
    const maxPrepTime = searchParams.get('maxPrepTime') ? parseInt(searchParams.get('maxPrepTime')!) : 60;
    const servings = searchParams.get('servings') ? parseInt(searchParams.get('servings')!) : 4;

    // Fetch recipe and meal plan data
    const [recipesResponse, mealPlansResponse] = await Promise.all([
      sb()
        .from('recipes')
        .select('*')
        .eq('household_id', householdId),
      
      sb()
        .from('meal_plans')
        .select('*')
        .eq('household_id', householdId)
        .order('week_start_date', { ascending: false })
        .limit(8) // Last 8 weeks for pattern analysis
    ]);

    if (recipesResponse.error) {
      console.error('Error fetching recipes:', recipesResponse.error);
      throw new ServerError('Failed to fetch recipes', 500);
    }

    if (mealPlansResponse.error) {
      console.error('Error fetching meal plans:', mealPlansResponse.error);
      throw new ServerError('Failed to fetch meal plans', 500);
    }

    const recipes = recipesResponse.data || [];
    const mealPlans = mealPlansResponse.data || [];

    // Generate AI-powered meal suggestions
    const suggestions = generateAIMealSuggestions(
      recipes,
      mealPlans,
      mealType,
      dietaryRestrictions,
      maxPrepTime,
      servings
    );

    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    
    console.error('Unexpected error in GET /api/ai/meal-suggestions:', error);
    return createErrorResponse(new ServerError('Internal server error'));
  }
}

function generateAIMealSuggestions(
  recipes: any[],
  mealPlans: any[],
  mealType: string,
  dietaryRestrictions: string[],
  maxPrepTime: number,
  servings: number
) {
  // Analyze recipe usage patterns
  const recipeUsage = new Map<string, number>();
  mealPlans.forEach(plan => {
    if (plan.meals) {
      Object.values(plan.meals).forEach((day: any) => {
        if (day) {
          Object.values(day).forEach((recipeId: any) => {
            if (recipeId) {
              recipeUsage.set(recipeId, (recipeUsage.get(recipeId) || 0) + 1);
            }
          });
        }
      });
    }
  });

  // Filter recipes based on criteria
  let filteredRecipes = recipes.filter(recipe => {
    // Check meal type appropriateness
    if (mealType === 'breakfast' && !isBreakfastRecipe(recipe)) return false;
    if (mealType === 'lunch' && !isLunchRecipe(recipe)) return false;
    if (mealType === 'dinner' && !isDinnerRecipe(recipe)) return false;

    // Check prep time
    const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
    if (totalTime > maxPrepTime) return false;

    // Check servings
    if (recipe.servings && recipe.servings < servings * 0.7) return false;

    // Check dietary restrictions
    if (dietaryRestrictions.length > 0) {
      const recipeTags = recipe.tags || [];
      const hasRestriction = dietaryRestrictions.some(restriction => 
        recipeTags.some((tag: string) => 
          tag.toLowerCase().includes(restriction.toLowerCase())
        )
      );
      if (!hasRestriction) return false;
    }

    return true;
  });

  // Score recipes based on AI analysis
  const scoredRecipes = filteredRecipes.map(recipe => {
    let score = 0;
    
    // Preference score (lower usage = higher score for variety)
    const usageCount = recipeUsage.get(recipe.id) || 0;
    score += Math.max(0, 10 - usageCount * 2);

    // Seasonal score
    score += calculateSeasonalScore(recipe);

    // Nutritional balance score
    score += calculateNutritionalScore(recipe);

    // Complexity score (balance between simple and complex)
    const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
    if (totalTime <= 30) score += 3; // Quick meals get bonus
    else if (totalTime <= 60) score += 2; // Medium time gets moderate bonus
    else score += 1; // Longer meals get minimal bonus

    // Household size compatibility
    if (recipe.servings && Math.abs(recipe.servings - servings) <= 2) {
      score += 2;
    }

    return { ...recipe, ai_score: score };
  });

  // Sort by AI score and return top suggestions
  const topSuggestions = scoredRecipes
    .sort((a, b) => b.ai_score - a.ai_score)
    .slice(0, 6)
    .map(recipe => ({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      prep_time: recipe.prep_time || 0,
      cook_time: recipe.cook_time || 0,
      servings: recipe.servings || 4,
      tags: recipe.tags || [],
      image_url: recipe.image_url,
      ai_score: recipe.ai_score,
      ai_reasoning: generateAIReasoning(recipe, recipeUsage.get(recipe.id) || 0)
    }));

  // Generate additional AI insights
  const insights = {
    meal_type_optimization: generateMealTypeInsights(mealType, filteredRecipes.length),
    variety_recommendations: generateVarietyRecommendations(recipeUsage, recipes),
    seasonal_tips: generateSeasonalTips(),
    nutritional_balance: generateNutritionalBalanceTips(mealType)
  };

  return {
    suggestions: topSuggestions,
    insights,
    total_available_recipes: filteredRecipes.length,
    ai_confidence: Math.min(100, Math.max(50, filteredRecipes.length * 5))
  };
}

function isBreakfastRecipe(recipe: any): boolean {
  const breakfastKeywords = ['breakfast', 'pancake', 'waffle', 'cereal', 'oatmeal', 'eggs', 'bacon', 'toast'];
  const title = recipe.title?.toLowerCase() || '';
  const tags = recipe.tags?.map((tag: string) => tag.toLowerCase()) || [];
  
  return breakfastKeywords.some(keyword => 
    title.includes(keyword) || tags.some((tag: string) => tag.includes(keyword))
  );
}

function isLunchRecipe(recipe: any): boolean {
  const lunchKeywords = ['lunch', 'sandwich', 'salad', 'soup', 'wrap', 'pasta', 'rice'];
  const title = recipe.title?.toLowerCase() || '';
  const tags = recipe.tags?.map((tag: string) => tag.toLowerCase()) || [];
  
  return lunchKeywords.some(keyword => 
    title.includes(keyword) || tags.some((tag: string) => tag.includes(keyword))
  );
}

function isDinnerRecipe(recipe: any): boolean {
  const dinnerKeywords = ['dinner', 'roast', 'grill', 'casserole', 'stew', 'curry', 'stir-fry'];
  const title = recipe.title?.toLowerCase() || '';
  const tags = recipe.tags?.map((tag: string) => tag.toLowerCase()) || [];
  
  return dinnerKeywords.some(keyword => 
    title.includes(keyword) || tags.some((tag: string) => tag.includes(keyword))
  );
}

function calculateSeasonalScore(recipe: any): number {
  const currentMonth = new Date().getMonth();
  const seasonalIngredients = {
    winter: ['root vegetables', 'winter squash', 'citrus', 'dark greens'],
    spring: ['asparagus', 'peas', 'spring greens', 'herbs'],
    summer: ['tomatoes', 'berries', 'zucchini', 'fresh herbs'],
    fall: ['pumpkin', 'apples', 'mushrooms', 'warm spices']
  };

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

  const seasonalIngredientsList = seasonalIngredients[currentSeason as keyof typeof seasonalIngredients] || [];
  const recipeText = `${recipe.title} ${recipe.description} ${(recipe.tags || []).join(' ')}`.toLowerCase();
  
  const seasonalMatches = seasonalIngredientsList.filter(ingredient => 
    recipeText.includes(ingredient)
  ).length;

  return seasonalMatches * 2; // 2 points per seasonal ingredient
}

function calculateNutritionalScore(recipe: any): number {
  let score = 0;
  const tags = recipe.tags?.map((tag: string) => tag.toLowerCase()) || [];
  
  // Protein sources
  if (tags.some(tag => tag.includes('protein') || tag.includes('meat') || tag.includes('fish'))) {
    score += 2;
  }
  
  // Vegetables
  if (tags.some(tag => tag.includes('vegetable') || tag.includes('salad') || tag.includes('green'))) {
    score += 2;
  }
  
  // Whole grains
  if (tags.some(tag => tag.includes('whole grain') || tag.includes('quinoa') || tag.includes('brown rice'))) {
    score += 1;
  }
  
  return score;
}

function generateAIReasoning(recipe: any, usageCount: number): string {
  const reasons = [];
  
  if (usageCount === 0) {
    reasons.push('New recipe to try');
  } else if (usageCount <= 2) {
    reasons.push('Good variety choice');
  }
  
  if (recipe.prep_time && recipe.prep_time <= 15) {
    reasons.push('Quick to prepare');
  }
  
  if (recipe.tags?.some((tag: string) => tag.toLowerCase().includes('seasonal'))) {
    reasons.push('Seasonally appropriate');
  }
  
  return reasons.length > 0 ? reasons.join(', ') : 'Well-balanced meal option';
}

function generateMealTypeInsights(mealType: string, availableRecipes: number): string {
  if (availableRecipes < 5) {
    return `Consider adding more ${mealType} recipes to your collection for better variety`;
  } else if (availableRecipes < 10) {
    return `Good ${mealType} variety available. Try rotating between different categories`;
  } else {
    return `Excellent ${mealType} selection. Focus on seasonal and nutritional balance`;
  }
}

function generateVarietyRecommendations(recipeUsage: Map<string, number>, recipes: any[]): string[] {
  const recommendations = [];
  
  if (recipeUsage.size < recipes.length * 0.3) {
    recommendations.push('Try using more of your recipe collection');
  }
  
  const highUsageRecipes = Array.from(recipeUsage.entries())
    .filter(([, count]) => count > 3)
    .map(([recipeId]) => recipeId);
  
  if (highUsageRecipes.length > 0) {
    recommendations.push('Consider taking a break from frequently used recipes');
  }
  
  return recommendations;
}

function generateSeasonalTips(): string {
  const currentMonth = new Date().getMonth();
  const seasonalTips = {
    winter: 'Focus on warming, hearty dishes with root vegetables',
    spring: 'Incorporate fresh greens and light, refreshing flavors',
    summer: 'Opt for grilled dishes and fresh, seasonal produce',
    fall: 'Use warm spices and harvest vegetables for comforting meals'
  };
  
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
  
  return seasonalTips[currentSeason as keyof typeof seasonalTips] || '';
}

function generateNutritionalBalanceTips(mealType: string): string {
  const tips = {
    breakfast: 'Include protein and fiber for sustained energy',
    lunch: 'Balance protein, carbs, and vegetables for midday fuel',
    dinner: 'Focus on protein and vegetables, moderate carbs'
  };
  
  return tips[mealType as keyof typeof tips] || 'Aim for balanced nutrition with variety';
}
