import { MealPlanningAIService } from "../services/MealPlanningAIService";
import { logger } from "@/lib/logging/logger";

export async function testMealPlanningAI() {
  logger.info("Testing Meal Planning AI Service...");

  try {
    const aiService = new MealPlanningAIService();

    const context = {
      householdId: "test-household-id",
      mealType: "dinner" as const,
      dietaryRestrictions: ["vegetarian"],
      maxPrepTime: 30,
      servings: 4,
      cuisine: "Italian",
      budget: 50,
      skillLevel: "intermediate" as const,
      availableIngredients: ["pasta", "tomatoes", "cheese"],
      avoidIngredients: ["nuts"],
      specialOccasions: ["weeknight"],
    };

    logger.debug?.("Meal planning test context", context);

    const result = await aiService.generateMealSuggestions(context);

    logger.info("Meal planning AI service result", {
      success: result.success,
      provider: result.provider,
      processingTimeMs: result.processingTime,
      fallbackUsed: result.fallbackUsed,
      suggestionCount: result.data?.length || 0,
    });

    if (result.data && result.data.length > 0) {
      const sample = result.data[0];
      logger.info("Sample meal suggestion", {
        name: sample.name,
        description: sample.description,
        prepTime: sample.prepTime,
        totalTime: sample.totalTime,
        servings: sample.servings,
        difficulty: sample.difficulty,
        cuisine: sample.cuisine,
        dietaryTags: sample.dietaryTags,
        ingredientCount: sample.ingredients.length,
        instructionCount: sample.instructions.length,
        confidence: sample.confidence,
        reasoning: sample.reasoning,
      });
    }

    return result;
  } catch (error) {
    logger.error("Meal planning test failed", error as Error);
    return null;
  }
}

export async function testMealTypes() {
  logger.info("Testing meal planning AI across meal types");

  const aiService = new MealPlanningAIService();
  const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;

  for (const mealType of mealTypes) {
    logger.info("Testing meal type", { mealType });

    const context = {
      householdId: "test-household-id",
      mealType,
      dietaryRestrictions: [],
      maxPrepTime: 20,
      servings: 2,
    };

    const result = await aiService.generateMealSuggestions(context);
    logger.info("Meal type test result", {
      mealType,
      provider: result.provider,
      suggestionCount: result.data?.length || 0,
    });
  }
}

export async function testDietaryRestrictions() {
  logger.info("Testing dietary restrictions for meal planning AI");

  const aiService = new MealPlanningAIService();
  const restrictions = [
    [],
    ["vegetarian"],
    ["vegan"],
    ["gluten-free"],
    ["vegetarian", "gluten-free"],
  ];

  for (const dietaryRestrictions of restrictions) {
    logger.info("Testing dietary restriction set", { dietaryRestrictions });

    const context = {
      householdId: "test-household-id",
      mealType: "dinner" as const,
      dietaryRestrictions,
      maxPrepTime: 30,
      servings: 4,
    };

    const result = await aiService.generateMealSuggestions(context);
    logger.info("Dietary restriction result", {
      dietaryRestrictions,
      suggestionCount: result.data?.length || 0,
      provider: result.provider,
      sampleDietaryTags: result.data?.[0]?.dietaryTags,
    });
  }
}

