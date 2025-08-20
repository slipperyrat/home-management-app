import { BaseService } from '../index';
import { createClient } from '@supabase/supabase-js';

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

export class MealService extends BaseService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async generateSuggestions(params: MealSuggestionParams): Promise<MealSuggestionResult> {
    return this.withErrorHandling(async () => {
      this.log('info', 'Generating meal suggestions', params);

      // Fetch recipe and meal plan data
      const [recipes, mealPlans] = await Promise.all([
        this.fetchRecipes(params.householdId),
        this.fetchMealPlans(params.householdId)
      ]);

      // Generate AI-powered meal suggestions
      const suggestions = this.generateAIMealSuggestions(
        recipes,
        mealPlans,
        params.mealType,
        params.dietaryRestrictions,
        params.maxPrepTime,
        params.servings
      );

      // Generate insights
      const insights = this.generateInsights(
        params.mealType,
        suggestions.length,
        mealPlans,
        recipes
      );

      const result: MealSuggestionResult = {
        suggestions,
        insights,
        total_available_recipes: suggestions.length,
        ai_confidence: Math.min(100, Math.max(50, suggestions.length * 5))
      };

      this.log('info', 'Generated meal suggestions', { count: suggestions.length });
      return result;
    }, 'generateMealSuggestions');
  }

  private async fetchRecipes(householdId: string) {
    const { data, error } = await this.supabase
      .from('recipes')
      .select('*')
      .eq('household_id', householdId);

    if (error) {
      throw new Error(`Failed to fetch recipes: ${error.message}`);
    }

    return data || [];
  }

  private async fetchMealPlans(householdId: string) {
    const { data, error } = await this.supabase
      .from('meal_plans')
      .select('*')
      .eq('household_id', householdId)
      .order('week_start_date', { ascending: false })
      .limit(8);

    if (error) {
      throw new Error(`Failed to fetch meal plans: ${error.message}`);
    }

    return data || [];
  }

  private generateAIMealSuggestions(
    recipes: any[],
    mealPlans: any[],
    mealType: string,
    dietaryRestrictions: string[],
    maxPrepTime: number,
    servings: number
  ): MealSuggestion[] {
    // Analyze recipe usage patterns
    const recipeUsage = this.analyzeRecipeUsage(mealPlans);

    // Filter recipes based on criteria
    const filteredRecipes = this.filterRecipes(
      recipes,
      mealType,
      dietaryRestrictions,
      maxPrepTime,
      servings
    );

    // Score recipes based on AI analysis
    const scoredRecipes = this.scoreRecipes(filteredRecipes, recipeUsage, servings);

    // Return top suggestions
    return scoredRecipes
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
        ai_reasoning: this.generateAIReasoning(recipe, recipeUsage.get(recipe.id) || 0)
      }));
  }

  private analyzeRecipeUsage(mealPlans: any[]): Map<string, number> {
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

    return recipeUsage;
  }

  private filterRecipes(
    recipes: any[],
    mealType: string,
    dietaryRestrictions: string[],
    maxPrepTime: number,
    servings: number
  ) {
    return recipes.filter(recipe => {
      // Check meal type appropriateness
      if (!this.isAppropriateForMealType(recipe, mealType)) return false;

      // Check prep time
      const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
      if (totalTime > maxPrepTime) return false;

      // Check servings
      if (recipe.servings && recipe.servings < servings * 0.7) return false;

      // Check dietary restrictions
      if (dietaryRestrictions.length > 0 && !this.meetsDietaryRestrictions(recipe, dietaryRestrictions)) {
        return false;
      }

      return true;
    });
  }

  private isAppropriateForMealType(recipe: any, mealType: string): boolean {
    const title = recipe.title?.toLowerCase() || '';
    const tags = recipe.tags?.map((tag: string) => tag.toLowerCase()) || [];

    const mealTypeKeywords = {
      breakfast: ['breakfast', 'pancake', 'waffle', 'cereal', 'oatmeal', 'eggs', 'bacon', 'toast'],
      lunch: ['lunch', 'sandwich', 'salad', 'soup', 'wrap', 'pasta', 'rice'],
      dinner: ['dinner', 'roast', 'grill', 'casserole', 'stew', 'curry', 'stir-fry']
    };

    const keywords = mealTypeKeywords[mealType as keyof typeof mealTypeKeywords] || [];
    return keywords.some(keyword => 
      title.includes(keyword) || tags.some((tag: string) => tag.includes(keyword))
    );
  }

  private meetsDietaryRestrictions(recipe: any, restrictions: string[]): boolean {
    const recipeTags = recipe.tags || [];
    return restrictions.some(restriction => 
      recipeTags.some((tag: string) => 
        tag.toLowerCase().includes(restriction.toLowerCase())
      )
    );
  }

  private scoreRecipes(recipes: any[], recipeUsage: Map<string, number>, servings: number) {
    return recipes.map(recipe => {
      let score = 0;
      
      // Preference score (lower usage = higher score for variety)
      const usageCount = recipeUsage.get(recipe.id) || 0;
      score += Math.max(0, 10 - usageCount * 2);

      // Seasonal score
      score += this.calculateSeasonalScore(recipe);

      // Nutritional balance score
      score += this.calculateNutritionalScore(recipe);

      // Complexity score
      const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
      if (totalTime <= 30) score += 3;
      else if (totalTime <= 60) score += 2;
      else score += 1;

      // Household size compatibility
      if (recipe.servings && Math.abs(recipe.servings - servings) <= 2) {
        score += 2;
      }

      return { ...recipe, ai_score: score };
    });
  }

  private calculateSeasonalScore(recipe: any): number {
    const currentMonth = new Date().getMonth();
    const seasonalIngredients = {
      winter: ['root vegetables', 'winter squash', 'citrus', 'dark greens'],
      spring: ['asparagus', 'peas', 'spring greens', 'herbs'],
      summer: ['tomatoes', 'berries', 'zucchini', 'fresh herbs'],
      fall: ['pumpkin', 'apples', 'mushrooms', 'warm spices']
    };

    const seasons = {
      winter: [11, 0, 1],
      spring: [2, 3, 4],
      summer: [5, 6, 7],
      fall: [8, 9, 10]
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

    return seasonalMatches * 2;
  }

  private calculateNutritionalScore(recipe: any): number {
    let score = 0;
    const tags = recipe.tags?.map((tag: string) => tag.toLowerCase()) || [];
    
    if (tags.some((tag: string) => tag.includes('protein') || tag.includes('meat') || tag.includes('fish'))) {
      score += 2;
    }
    
    if (tags.some((tag: string) => tag.includes('vegetable') || tag.includes('salad') || tag.includes('green'))) {
      score += 2;
    }
    
    if (tags.some((tag: string) => tag.includes('whole grain') || tag.includes('quinoa') || tag.includes('brown rice'))) {
      score += 1;
    }
    
    return score;
  }

  private generateAIReasoning(recipe: any, usageCount: number): string {
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

  private generateInsights(
    mealType: string,
    availableRecipes: number,
    mealPlans: any[],
    recipes: any[]
  ): MealInsights {
    const recipeUsage = this.analyzeRecipeUsage(mealPlans);

    return {
      meal_type_optimization: this.generateMealTypeInsights(mealType, availableRecipes),
      variety_recommendations: this.generateVarietyRecommendations(recipeUsage, recipes),
      seasonal_tips: this.generateSeasonalTips(),
      nutritional_balance: this.generateNutritionalBalanceTips(mealType)
    };
  }

  private generateMealTypeInsights(mealType: string, availableRecipes: number): string {
    if (availableRecipes < 5) {
      return `Consider adding more ${mealType} recipes to your collection for better variety`;
    } else if (availableRecipes < 10) {
      return `Good ${mealType} variety available. Try rotating between different categories`;
    } else {
      return `Excellent ${mealType} selection. Focus on seasonal and nutritional balance`;
    }
  }

  private generateVarietyRecommendations(recipeUsage: Map<string, number>, recipes: any[]): string[] {
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

  private generateSeasonalTips(): string {
    const currentMonth = new Date().getMonth();
    const seasonalTips = {
      winter: 'Focus on warming, hearty dishes with root vegetables',
      spring: 'Incorporate fresh greens and light, refreshing flavors',
      summer: 'Opt for grilled dishes and fresh, seasonal produce',
      fall: 'Use warm spices and harvest vegetables for comforting meals'
    };
    
    const seasons = {
      winter: [11, 0, 1],
      spring: [2, 3, 4],
      summer: [5, 6, 7],
      fall: [8, 9, 10]
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

  private generateNutritionalBalanceTips(mealType: string): string {
    const tips = {
      breakfast: 'Include protein and fiber for sustained energy',
      lunch: 'Balance protein, carbs, and vegetables for midday fuel',
      dinner: 'Focus on protein and vegetables, moderate carbs'
    };
    
    return tips[mealType as keyof typeof tips] || 'Aim for balanced nutrition with variety';
  }
}
