import { BaseService } from '../index';
import type { Database } from '@/types/database';
import { createSupabaseAdminClient } from '@/lib/server/supabaseAdmin';

export interface MealSuggestionParams {
  mealType: string;
  dietaryRestrictions: string[];
  maxPrepTime: number;
  servings: number;
  householdId: string;
}

export interface MealSuggestion {
  id: string;
  title: string;
  description?: string;
  prep_time: number;
  cook_time: number;
  servings: number;
  tags: string[];
  image_url?: string;
  ai_score: number;
  ai_reasoning: string;
}

export interface MealInsights {
  meal_type_optimization: string;
  variety_recommendations: string[];
  seasonal_tips: string;
  nutritional_balance: string;
}

export interface MealSuggestionResult {
  suggestions: MealSuggestion[];
  insights: MealInsights;
  total_available_recipes: number;
  ai_confidence: number;
}

type RecipeRow = Database['public']['Tables']['recipes']['Row'];
type MealPlanRow = Database['public']['Tables']['meal_plans']['Row'];

export class MealService extends BaseService {
  private supabase = createSupabaseAdminClient();

  async generateSuggestions(params: MealSuggestionParams): Promise<MealSuggestionResult> {
    return this.withErrorHandling(async () => {
      this.log('info', 'Generating meal suggestions', { params });

      const [recipes, mealPlans] = await Promise.all([
        this.fetchRecipes(params.householdId),
        this.fetchMealPlans(params.householdId),
      ]);

      const suggestions = this.generateAIMealSuggestions(
        recipes,
        mealPlans,
        params.mealType,
        params.dietaryRestrictions,
        params.maxPrepTime,
        params.servings,
      );

      const insights = this.generateInsights(
        params.mealType,
        suggestions.length,
        mealPlans,
        recipes,
      );

      const result: MealSuggestionResult = {
        suggestions,
        insights,
        total_available_recipes: suggestions.length,
        ai_confidence: Math.min(100, Math.max(50, suggestions.length * 5)),
      };

      this.log('info', 'Generated meal suggestions', { count: suggestions.length });
      return result;
    }, 'generateMealSuggestions');
  }

  private async fetchRecipes(householdId: string): Promise<RecipeRow[]> {
    const { data, error } = await this.supabase
      .from('recipes')
      .select('*')
      .eq('household_id', householdId);

    if (error) {
      throw new Error(`Failed to fetch recipes: ${error.message}`);
    }

    return (data ?? []).map((recipe) => ({
      ...recipe,
      created_at: recipe.created_at ?? '',
    }));
  }

  private async fetchMealPlans(householdId: string): Promise<MealPlanRow[]> {
    const { data, error } = await this.supabase
      .from('meal_plans')
      .select('*')
      .eq('household_id', householdId)
      .order('week_start_date', { ascending: false })
      .limit(8);

    if (error) {
      throw new Error(`Failed to fetch meal plans: ${error.message}`);
    }

    return (data ?? []).map((plan) => ({
      ...plan,
      meals: (plan.meals as Record<string, Record<string, string | null>> | null) ?? null,
      created_at: plan.created_at ?? '',
    }));
  }

  private generateAIMealSuggestions(
    recipes: RecipeRow[],
    mealPlans: MealPlanRow[],
    mealType: string,
    dietaryRestrictions: string[],
    maxPrepTime: number,
    servings: number,
  ): MealSuggestion[] {
    const recipeUsage = this.analyzeRecipeUsage(mealPlans);

    const filteredRecipes = this.filterRecipes(
      recipes,
      mealType,
      dietaryRestrictions,
      maxPrepTime,
      servings,
    );

    const scoredRecipes = this.scoreRecipes(filteredRecipes, recipeUsage, servings);

    return scoredRecipes
      .sort((a, b) => b.ai_score - a.ai_score)
      .map((recipe, index) => ({
        ...recipe,
        description: recipe.description ?? '',
        image_url: recipe.image_url ?? undefined,
        ai_reasoning: this.generateAIReasoning(recipe, index),
      })) as MealSuggestion[]
  }

  private analyzeRecipeUsage(mealPlans: MealPlanRow[]): Map<string, number> {
    const recipeUsage = new Map<string, number>();

    mealPlans.forEach((plan) => {
      const meals = plan.meals as Record<string, Record<string, string | null>> | null;
      if (!meals) return;

      Object.values(meals).forEach((day) => {
        if (!day) return;
        Object.values(day).forEach((recipeId) => {
          if (!recipeId) return;
          recipeUsage.set(recipeId, (recipeUsage.get(recipeId) ?? 0) + 1);
        });
      });
    });

    return recipeUsage;
  }

  private filterRecipes(
    recipes: RecipeRow[],
    mealType: string,
    dietaryRestrictions: string[],
    maxPrepTime: number,
    servings: number,
  ): (RecipeRow & { ai_score?: number })[] {
    return recipes.filter((recipe) => {
      if (!this.isAppropriateForMealType(recipe, mealType)) return false;

      const totalTime = (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0);
      if (totalTime > maxPrepTime) return false;

      if (recipe.servings && recipe.servings < servings * 0.7) return false;

      if (dietaryRestrictions.length > 0 && !this.meetsDietaryRestrictions(recipe, dietaryRestrictions)) {
        return false;
      }

      return true;
    });
  }

  private isAppropriateForMealType(recipe: RecipeRow, mealType: string): boolean {
    const title = recipe.title?.toLowerCase() ?? '';
    const tags = recipe.tags?.map((tag) => tag.toLowerCase()) ?? [];

    const mealTypeKeywords: Record<string, string[]> = {
      breakfast: ['breakfast', 'pancake', 'waffle', 'cereal', 'oatmeal', 'eggs', 'bacon', 'toast'],
      lunch: ['lunch', 'sandwich', 'salad', 'soup', 'wrap', 'pasta', 'rice'],
      dinner: ['dinner', 'roast', 'grill', 'casserole', 'stew', 'curry', 'stir-fry'],
    };

    const keywords = mealTypeKeywords[mealType] ?? [];
    return keywords.some((keyword) => title.includes(keyword) || tags.some((tag) => tag.includes(keyword)));
  }

  private meetsDietaryRestrictions(recipe: RecipeRow, restrictions: string[]): boolean {
    const recipeTags = recipe.tags ?? [];
    return restrictions.some((restriction) =>
      recipeTags.some((tag) => tag.toLowerCase().includes(restriction.toLowerCase())),
    );
  }

  private scoreRecipes(
    recipes: RecipeRow[],
    recipeUsage: Map<string, number>,
    servings: number,
  ): (RecipeRow & { ai_score: number })[] {
    return recipes.map((recipe) => {
      let score = 0;

      const usageCount = recipeUsage.get(recipe.id) ?? 0;
      score += Math.max(0, 10 - usageCount * 2);

      score += this.calculateSeasonalScore(recipe);
      score += this.calculateNutritionalScore(recipe);

      const totalTime = (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0);
      if (totalTime <= 30) score += 3;
      else if (totalTime <= 60) score += 2;
      else score += 1;

      if (recipe.servings && Math.abs(recipe.servings - servings) <= 2) {
        score += 2;
      }

      return { ...recipe, ai_score: score };
    });
  }

  private calculateSeasonalScore(recipe: RecipeRow): number {
    const currentMonth = new Date().getMonth();
    const seasonalIngredients: Record<string, string[]> = {
      winter: ['root vegetables', 'winter squash', 'citrus', 'dark greens'],
      spring: ['asparagus', 'peas', 'spring greens', 'herbs'],
      summer: ['tomatoes', 'berries', 'zucchini', 'fresh herbs'],
      fall: ['pumpkin', 'apples', 'mushrooms', 'warm spices'],
    };

    const seasons: Record<string, number[]> = {
      winter: [11, 0, 1],
      spring: [2, 3, 4],
      summer: [5, 6, 7],
      fall: [8, 9, 10],
    };

    let currentSeason = 'winter';
    for (const [season, months] of Object.entries(seasons)) {
      if (months.includes(currentMonth)) {
        currentSeason = season;
        break;
      }
    }

    const seasonalIngredientsList = seasonalIngredients[currentSeason] ?? [];
    const recipeText = `${recipe.title ?? ''} ${recipe.description ?? ''} ${(recipe.tags ?? []).join(' ')}`.toLowerCase();

    const seasonalMatches = seasonalIngredientsList.filter((ingredient) => recipeText.includes(ingredient)).length;

    return seasonalMatches * 2;
  }

  private calculateNutritionalScore(recipe: RecipeRow): number {
    let score = 0;
    const tags = recipe.tags?.map((tag) => tag.toLowerCase()) ?? [];

    if (tags.some((tag) => tag.includes('protein') || tag.includes('meat') || tag.includes('fish'))) {
      score += 2;
    }

    if (tags.some((tag) => tag.includes('vegetable') || tag.includes('salad') || tag.includes('green'))) {
      score += 2;
    }

    if (tags.some((tag) => tag.includes('whole grain') || tag.includes('quinoa') || tag.includes('brown rice'))) {
      score += 1;
    }

    return score;
  }

  private generateAIReasoning(recipe: RecipeRow & { ai_score?: number }, index: number): string {
    const score = recipe.ai_score ?? 0
    const reasons = [
      score > 80 ? 'High suitability based on preferences' : null,
      recipe.description ? 'Popular within your household' : null,
      index > 2 ? 'Frequently selected recently' : null,
      recipe.tags?.includes('quick') ? 'Quick to prepare' : null,
    ].filter(Boolean)

    return reasons.join('; ') || 'Recommended based on household preferences'
  }

  private generateInsights(
    mealType: string,
    availableRecipes: number,
    mealPlans: MealPlanRow[],
    recipes: RecipeRow[],
  ): MealInsights {
    const recipeUsage = this.analyzeRecipeUsage(mealPlans);

    return {
      meal_type_optimization: this.generateMealTypeInsights(mealType, availableRecipes),
      variety_recommendations: this.generateVarietyRecommendations(recipeUsage, recipes),
      seasonal_tips: this.generateSeasonalTips(),
      nutritional_balance: this.generateNutritionalBalanceTips(mealType),
    };
  }

  private generateMealTypeInsights(mealType: string, availableRecipes: number): string {
    if (availableRecipes < 5) {
      return `Consider adding more ${mealType} recipes to your collection for better variety`;
    }
    if (availableRecipes < 10) {
      return `Good ${mealType} variety available. Try rotating between different categories`;
    }
    return `Excellent ${mealType} selection. Focus on seasonal and nutritional balance`;
  }

  private generateVarietyRecommendations(recipeUsage: Map<string, number>, recipes: RecipeRow[]): string[] {
    const recommendations: string[] = [];

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

  private generateSeasonalTips(): string {
    const currentMonth = new Date().getMonth();
    const seasonalTips: Record<string, string> = {
      winter: 'Focus on warming, hearty dishes with root vegetables',
      spring: 'Incorporate fresh greens and light, refreshing flavors',
      summer: 'Opt for grilled dishes and fresh, seasonal produce',
      fall: 'Use warm spices and harvest vegetables for comforting meals',
    };

    const seasons: Record<string, number[]> = {
      winter: [11, 0, 1],
      spring: [2, 3, 4],
      summer: [5, 6, 7],
      fall: [8, 9, 10],
    };

    let currentSeason = 'winter';
    for (const [season, months] of Object.entries(seasons)) {
      if (months.includes(currentMonth)) {
        currentSeason = season;
        break;
      }
    }

    return seasonalTips[currentSeason] ?? '';
  }

  private generateNutritionalBalanceTips(mealType: string): string {
    const tips: Record<string, string> = {
      breakfast: 'Include protein and fiber for sustained energy',
      lunch: 'Balance protein, carbs, and vegetables for midday fuel',
      dinner: 'Focus on protein and vegetables, moderate carbs',
    };

    return tips[mealType] ?? 'Aim for balanced nutrition with variety';
  }
}
