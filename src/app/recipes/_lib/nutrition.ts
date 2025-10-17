import type { RecipeDetail } from "./types";

type NormalizedIngredient = {
  name: string;
  amount: number;
};

type NutritionEstimate = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type AnalysisResult = {
  nutrition: NutritionEstimate;
  pantryMatches: string[];
};

const CALORIES_PER_SERVING = {
  default: 150,
  protein: 4,
  carbs: 4,
  fat: 9,
};

const PANTRY_KEYWORDS = ["salt", "pepper", "oil", "flour", "sugar", "rice", "pasta"];

export function analyzeRecipe(recipe: RecipeDetail, pantry: string[] = []): AnalysisResult {
  const ingredients = normalizeIngredients(recipe.ingredients);

  const nutrition = ingredients.reduce<NutritionEstimate>(
    (result, ingredient) => {
      const { amount, name } = ingredient;
      const category = classifyIngredient(name);
      if (category === "protein") {
        result.protein += amount * 3;
      } else if (category === "carb") {
        result.carbs += amount * 5;
      } else if (category === "fat") {
        result.fat += amount * 2;
      } else {
        result.calories += amount * CALORIES_PER_SERVING.default;
      }
      return result;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  nutrition.calories += nutrition.protein * CALORIES_PER_SERVING.protein;
  nutrition.calories += nutrition.carbs * CALORIES_PER_SERVING.carbs;
  nutrition.calories += nutrition.fat * CALORIES_PER_SERVING.fat;

  const pantryMatches = ingredients
    .map((item) => item.name)
    .filter((name) => pantry.includes(name) || PANTRY_KEYWORDS.some((keyword) => name.includes(keyword)));

  return { nutrition, pantryMatches };
}

function normalizeIngredients(raw: unknown[]): NormalizedIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => {
    if (typeof value === "string") {
      return { name: value.toLowerCase(), amount: 1 };
    }
    if (typeof value === "object" && value) {
      const obj = value as { name?: string; amount?: number };
      return {
        name: (obj.name ?? "").toLowerCase(),
        amount: Math.max(0.25, Number(obj.amount ?? 1)),
      };
    }
    return { name: "", amount: 1 };
  });
}

function classifyIngredient(name: string): "protein" | "carb" | "fat" | "other" {
  const value = name.toLowerCase();
  if (/(chicken|beef|pork|egg|tofu|bean|lentil|fish)/.test(value)) return "protein";
  if (/(rice|pasta|potato|bread|flour|grain|noodle|oat)/.test(value)) return "carb";
  if (/(oil|butter|cream|cheese|nut|seed)/.test(value)) return "fat";
  return "other";
}
