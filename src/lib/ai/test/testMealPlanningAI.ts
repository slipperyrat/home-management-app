// Test script for Meal Planning AI Service
// This can be easily removed if the AI implementation doesn't work

import { MealPlanningAIService } from '../services/MealPlanningAIService';
import { AIConfigManager } from '../config/aiConfig';

export async function testMealPlanningAI() {
  console.log('🧪 Testing Meal Planning AI Service...');
  
  try {
    // Test with mock data
    const aiService = new MealPlanningAIService();
    
    const context = {
      householdId: 'test-household-id',
      mealType: 'dinner' as const,
      dietaryRestrictions: ['vegetarian'],
      maxPrepTime: 30,
      servings: 4,
      cuisine: 'Italian',
      budget: 50,
      skillLevel: 'intermediate' as const,
      availableIngredients: ['pasta', 'tomatoes', 'cheese'],
      avoidIngredients: ['nuts'],
      specialOccasions: ['weeknight']
    };

    console.log('📝 Test context:', context);
    
    const result = await aiService.generateMealSuggestions(context);
    
    console.log('✅ AI Service Result:');
    console.log('- Success:', result.success);
    console.log('- Provider:', result.provider);
    console.log('- Processing Time:', result.processingTime + 'ms');
    console.log('- Fallback Used:', result.fallbackUsed);
    console.log('- Suggestions Count:', result.data?.length || 0);
    
    if (result.data && result.data.length > 0) {
      console.log('🍽️ Sample Meal Suggestion:');
      const sample = result.data[0];
      console.log(`- Name: ${sample.name}`);
      console.log(`- Description: ${sample.description}`);
      console.log(`- Prep Time: ${sample.prepTime} minutes`);
      console.log(`- Total Time: ${sample.totalTime} minutes`);
      console.log(`- Servings: ${sample.servings}`);
      console.log(`- Difficulty: ${sample.difficulty}`);
      console.log(`- Cuisine: ${sample.cuisine}`);
      console.log(`- Dietary Tags: ${sample.dietaryTags.join(', ')}`);
      console.log(`- Ingredients Count: ${sample.ingredients.length}`);
      console.log(`- Instructions Count: ${sample.instructions.length}`);
      console.log(`- Confidence: ${sample.confidence}%`);
      console.log(`- Reasoning: ${sample.reasoning}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

// Test different meal types
export async function testMealTypes() {
  console.log('🧪 Testing different meal types...');
  
  const aiService = new MealPlanningAIService();
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  
  for (const mealType of mealTypes) {
    console.log(`\n🍽️ Testing ${mealType}...`);
    
    const context = {
      householdId: 'test-household-id',
      mealType,
      dietaryRestrictions: [],
      maxPrepTime: 20,
      servings: 2
    };
    
    const result = await aiService.generateMealSuggestions(context);
    console.log(`- ${mealType}: ${result.data?.length || 0} suggestions (${result.provider})`);
  }
}

// Test dietary restrictions
export async function testDietaryRestrictions() {
  console.log('🧪 Testing dietary restrictions...');
  
  const aiService = new MealPlanningAIService();
  const restrictions = [
    [],
    ['vegetarian'],
    ['vegan'],
    ['gluten-free'],
    ['vegetarian', 'gluten-free']
  ];
  
  for (const dietaryRestrictions of restrictions) {
    console.log(`\n🥗 Testing restrictions: ${dietaryRestrictions.join(', ') || 'None'}...`);
    
    const context = {
      householdId: 'test-household-id',
      mealType: 'dinner' as const,
      dietaryRestrictions,
      maxPrepTime: 30,
      servings: 4
    };
    
    const result = await aiService.generateMealSuggestions(context);
    console.log(`- Restrictions: ${dietaryRestrictions.join(', ') || 'None'}`);
    console.log(`- Suggestions: ${result.data?.length || 0} (${result.provider})`);
    
    if (result.data && result.data.length > 0) {
      const sample = result.data[0];
      console.log(`- Sample dietary tags: ${sample.dietaryTags.join(', ')}`);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('🚀 Starting Meal Planning AI Tests...\n');
  
  testMealPlanningAI().then(() => {
    return testMealTypes();
  }).then(() => {
    return testDietaryRestrictions();
  }).then(() => {
    console.log('\n🎉 All meal planning tests completed!');
  });
}
