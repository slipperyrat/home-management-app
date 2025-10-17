// Enhanced Meal Planning AI Service
// Uses OpenAI for intelligent meal recommendations with easy fallback

import { BaseAIService, AIResponse } from './BaseAIService';
import { createSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/supabase.generated';
import type { MealPlanRow, RecipeRow } from '@/types/database';

export interface MealSuggestion {
  id: string;
  name: string;
  description: string;
  prepTime: number; // in minutes
  cookTime: number; // in minutes
  totalTime: number; // in minutes
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  cuisine: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dietaryTags: string[];
  ingredients: MealIngredient[];
  instructions: string[];
  nutritionalInfo?: NutritionalInfo;
  confidence: number;
  reasoning?: string;
}

export interface MealIngredient {
  name: string;
  amount: string;
  unit: string;
  category: string;
  optional: boolean;
  substitutions?: string[];
}

export interface NutritionalInfo {
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
  fiber: number; // grams
  sugar: number; // grams
}

export interface MealPlanningContext {
  householdId: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dietaryRestrictions: string[];
  maxPrepTime: number; // in minutes
  servings: number;
  cuisine?: string;
  budget?: number;
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  availableIngredients?: string[];
  avoidIngredients?: string[];
  specialOccasions?: string[];
}

export class MealPlanningAIService extends BaseAIService {
  private supabase = createSupabaseAdminClient();

  constructor() {
    super('mealPlanning');
  }

  async generateMealSuggestions(context: MealPlanningContext): Promise<AIResponse<MealSuggestion[]>> {
    return this.executeWithFallback(
      () => this.generateAIMealSuggestions(context),
      () => this.getMockResponse(context),
    );
  }

  private async generateAIMealSuggestions(context: MealPlanningContext): Promise<MealSuggestion[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const mealHistory = await this.getMealHistory(context.householdId);
    const availableRecipes = await this.getAvailableRecipes(context.householdId);

    const systemPrompt = `You are an AI meal planning assistant that provides intelligent meal recommendations based on household preferences, dietary restrictions, and cooking context.

You must respond with valid JSON only. Be practical and helpful in your suggestions.`;

    const userPrompt = this.createMealPlanningPrompt(context, mealHistory, availableRecipes);

    const response = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: this.createOpenAIPrompt(systemPrompt, userPrompt),
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    });

    const aiContent = response.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error('No response from OpenAI');
    }

    return this.parseAIResponse(aiContent, []);
  }

  private createMealPlanningPrompt(
    context: MealPlanningContext,
    mealHistory: MealPlanRow[],
    availableRecipes: RecipeRow[],
  ): string {
    const recipeLookup = new Map(availableRecipes.map((recipe) => [recipe.id, recipe.title ?? 'Untitled recipe']));

    const recentMeals = mealHistory
      .flatMap(({ week_start_date: weekStart, meals }) => {
        if (!meals) {
          return [] as { week: string; day: string; slot: string; recipe: string }[];
        }

        return Object.entries(meals).flatMap(([day, slots]) =>
          Object.entries(slots ?? {}).map(([slot, recipeId]) => ({
            week: weekStart,
            day,
            slot,
            recipe: recipeId ? recipeLookup.get(recipeId) ?? `Recipe ${recipeId}` : 'Unassigned',
          })),
        );
      })
      .slice(0, 10);

    const recipeNames = availableRecipes.slice(0, 20).map((recipe) => recipe.title ?? 'Untitled recipe');

    return `Generate meal suggestions for a household based on the following context:

Meal Planning Context:
- Meal Type: ${context.mealType}
- Dietary Restrictions: ${context.dietaryRestrictions.join(', ') || 'None'}
- Max Prep Time: ${context.maxPrepTime} minutes
- Servings: ${context.servings}
- Cuisine Preference: ${context.cuisine || 'Any'}
- Budget: ${context.budget ? `$${context.budget}` : 'Not specified'}
- Skill Level: ${context.skillLevel || 'intermediate'}
- Available Ingredients: ${context.availableIngredients?.join(', ') || 'Not specified'}
- Avoid Ingredients: ${context.avoidIngredients?.join(', ') || 'None'}
- Special Occasions: ${context.specialOccasions?.join(', ') || 'None'}

Household Context:
- Recent Meals: ${JSON.stringify(recentMeals)}
- Available Recipes: ${JSON.stringify(recipeNames)}

Please provide 3-5 meal suggestions in this JSON format:

[
  {
    "id": "meal_1",
    "name": "Grilled Chicken with Roasted Vegetables",
    "description": "A healthy and flavorful dinner with tender grilled chicken and seasonal roasted vegetables",
    "prepTime": 15,
    "cookTime": 25,
    "totalTime": 40,
    "servings": ${context.servings},
    "difficulty": "easy",
    "cuisine": "Mediterranean",
    "mealType": "${context.mealType}",
    "dietaryTags": ["gluten-free", "high-protein"],
    "ingredients": [
      {
        "name": "Chicken breast",
        "amount": "1.5",
        "unit": "lbs",
        "category": "Protein",
        "optional": false,
        "substitutions": ["Turkey breast", "Tofu"]
      },
      {
        "name": "Bell peppers",
        "amount": "2",
        "unit": "pieces",
        "category": "Vegetables",
        "optional": false,
        "substitutions": ["Zucchini", "Broccoli"]
      }
    ],
    "instructions": [
      "Preheat oven to 425°F (220°C)",
      "Season chicken with salt, pepper, and herbs",
      "Cut vegetables into bite-sized pieces",
      "Place chicken and vegetables on baking sheet",
      "Roast for 20-25 minutes until chicken is cooked through"
    ],
    "nutritionalInfo": {
      "calories": 350,
      "protein": 35,
      "carbs": 15,
      "fat": 12,
      "fiber": 4,
      "sugar": 8
    },
    "confidence": 85,
    "reasoning": "Perfect for ${context.mealType} with ${context.maxPrepTime}min prep time, fits dietary restrictions"
  }
]

Focus on practical, delicious meals that fit the household's preferences and constraints.`;
  }

  private async getMealHistory(householdId: string): Promise<MealPlanRow[]> {
    try {
      const { data, error } = await this.supabase
        .from('meal_plans')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []).map((plan) => ({
        ...plan,
        meals: (plan.meals as Database['public']['Tables']['meal_plans']['Row']['meals'])
          ? (plan.meals as Record<string, Record<string, string | null>>)
          : null,
        created_at: plan.created_at ?? null,
      }));
    } catch (error) {
      logger.error('Error fetching meal history', error as Error, { householdId });
      return [];
    }
  }

  private async getAvailableRecipes(householdId: string): Promise<RecipeRow[]> {
    try {
      const { data, error } = await this.supabase
        .from('recipes')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []).map((recipe) => ({
        ...recipe,
        created_at: recipe.created_at ?? null,
      }));
    } catch (error) {
      logger.error('Error fetching available recipes', error as Error, { householdId });
      return [];
    }
  }

  protected async getMockResponse(context?: MealPlanningContext): Promise<MealSuggestion[]> {
    const servings = context?.servings ?? 4;
    const mealType = context?.mealType ?? 'dinner';

    const mockSuggestions: MealSuggestion[] = [
      {
        id: 'mock_meal_1',
        name: 'Quick Pasta Primavera',
        description: 'A fresh and colorful pasta dish with seasonal vegetables',
        prepTime: 10,
        cookTime: 15,
        totalTime: 25,
        servings,
        difficulty: 'easy',
        cuisine: 'Italian',
        mealType,
        dietaryTags: ['vegetarian', 'quick'],
        ingredients: [
          {
            name: 'Pasta',
            amount: '12',
            unit: 'oz',
            category: 'Grains',
            optional: false,
            substitutions: ['Gluten-free pasta', 'Zucchini noodles'],
          },
          {
            name: 'Mixed vegetables',
            amount: '2',
            unit: 'cups',
            category: 'Vegetables',
            optional: false,
            substitutions: ['Frozen vegetables', 'Fresh seasonal vegetables'],
          },
          {
            name: 'Olive oil',
            amount: '3',
            unit: 'tbsp',
            category: 'Fats',
            optional: false,
          },
          {
            name: 'Parmesan cheese',
            amount: '1/2',
            unit: 'cup',
            category: 'Dairy',
            optional: true,
            substitutions: ['Nutritional yeast', 'Vegan parmesan'],
          },
        ],
        instructions: [
          'Bring a large pot of salted water to boil',
          'Add pasta and cook according to package directions',
          'Meanwhile, heat olive oil in a large pan',
          'Add vegetables and sauté for 5-7 minutes',
          'Drain pasta and add to vegetables',
          'Toss with cheese and season to taste',
        ],
        nutritionalInfo: {
          calories: 420,
          protein: 15,
          carbs: 65,
          fat: 12,
          fiber: 6,
          sugar: 8,
        },
        confidence: 80,
        reasoning: 'Quick and easy meal perfect for busy weeknights',
      },
      {
        id: 'mock_meal_2',
        name: 'Mediterranean Quinoa Bowl',
        description: 'A nutritious and filling bowl with quinoa, vegetables, and Mediterranean flavors',
        prepTime: 15,
        cookTime: 20,
        totalTime: 35,
        servings,
        difficulty: 'easy',
        cuisine: 'Mediterranean',
        mealType,
        dietaryTags: ['vegan', 'gluten-free', 'high-protein'],
        ingredients: [
          {
            name: 'Quinoa',
            amount: '1',
            unit: 'cup',
            category: 'Grains',
            optional: false,
            substitutions: ['Brown rice', 'Couscous'],
          },
          {
            name: 'Cherry tomatoes',
            amount: '1',
            unit: 'cup',
            category: 'Vegetables',
            optional: false,
          },
          {
            name: 'Cucumber',
            amount: '1',
            unit: 'medium',
            category: 'Vegetables',
            optional: false,
          },
          {
            name: 'Kalamata olives',
            amount: '1/2',
            unit: 'cup',
            category: 'Vegetables',
            optional: true,
          },
          {
            name: 'Feta cheese',
            amount: '4',
            unit: 'oz',
            category: 'Dairy',
            optional: true,
            substitutions: ['Vegan feta', 'Nutritional yeast'],
          },
        ],
        instructions: [
          'Rinse quinoa and cook according to package directions',
          'Let quinoa cool to room temperature',
          'Dice tomatoes and cucumber',
          'Mix quinoa with vegetables and olives',
          'Drizzle with olive oil and lemon juice',
          'Top with feta cheese if desired',
        ],
        nutritionalInfo: {
          calories: 380,
          protein: 18,
          carbs: 45,
          fat: 15,
          fiber: 8,
          sugar: 6,
        },
        confidence: 85,
        reasoning: 'Nutritious and satisfying meal with Mediterranean flavors',
      },
      {
        id: 'mock_meal_3',
        name: 'Sheet Pan Salmon and Vegetables',
        description: 'A one-pan meal with perfectly cooked salmon and roasted vegetables',
        prepTime: 10,
        cookTime: 20,
        totalTime: 30,
        servings,
        difficulty: 'easy',
        cuisine: 'American',
        mealType,
        dietaryTags: ['gluten-free', 'high-protein', 'omega-3'],
        ingredients: [
          {
            name: 'Salmon fillets',
            amount: '4',
            unit: 'pieces',
            category: 'Protein',
            optional: false,
            substitutions: ['Cod', 'Chicken breast', 'Tofu'],
          },
          {
            name: 'Broccoli',
            amount: '1',
            unit: 'head',
            category: 'Vegetables',
            optional: false,
            substitutions: ['Asparagus', 'Green beans'],
          },
          {
            name: 'Sweet potato',
            amount: '2',
            unit: 'medium',
            category: 'Vegetables',
            optional: false,
            substitutions: ['Butternut squash', 'Carrots'],
          },
          {
            name: 'Olive oil',
            amount: '2',
            unit: 'tbsp',
            category: 'Fats',
            optional: false,
          },
          {
            name: 'Lemon',
            amount: '1',
            unit: 'whole',
            category: 'Produce',
            optional: false,
          },
        ],
        instructions: [
          'Preheat oven to 400°F (200°C)',
          'Line a sheet pan with parchment paper',
          'Arrange vegetables and salmon on the pan',
          'Drizzle with olive oil and season with salt, pepper, and herbs',
          'Bake for 18-20 minutes until salmon is cooked and vegetables are tender',
          'Finish with fresh lemon juice',
        ],
        nutritionalInfo: {
          calories: 450,
          protein: 32,
          carbs: 28,
          fat: 22,
          fiber: 6,
          sugar: 7,
        },
        confidence: 90,
        reasoning: "Healthy one-pan meal that's easy to prepare and clean up",
      },
    ];

    if (context?.dietaryRestrictions?.includes('vegetarian')) {
      return mockSuggestions.filter((meal) => meal.dietaryTags.includes('vegetarian'));
    }

    if (context?.dietaryRestrictions?.includes('vegan')) {
      return mockSuggestions.filter((meal) => meal.dietaryTags.includes('vegan'));
    }

    if (context?.avoidIngredients) {
      return mockSuggestions.filter((meal) =>
        !context.avoidIngredients?.some((ingredient) =>
          meal.ingredients.some((item) => item.name.toLowerCase().includes(ingredient.toLowerCase())),
        ),
      );
    }

    return mockSuggestions;
  }
}
