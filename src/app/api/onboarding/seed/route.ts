import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';

const SeedDataSchema = z.object({
  sampleRecipes: z.boolean().default(true),
  samplePlans: z.boolean().default(true),
});

// Sample data generators
const generateSampleRecipes = () => [
  {
    name: 'Quick Breakfast Bowl',
    ingredients: [
      { name: 'Oats', amount: 1, unit: 'cup' },
      { name: 'Banana', amount: 1, unit: 'piece' },
      { name: 'Honey', amount: 2, unit: 'tbsp' },
      { name: 'Almonds', amount: 0.25, unit: 'cup' }
    ],
    instructions: [
      'Cook oats with water according to package directions',
      'Slice banana and add to bowl',
      'Drizzle with honey and sprinkle almonds',
      'Serve hot or cold'
    ],
    prepTime: 5,
    cookTime: 10,
    servings: 1,
    difficulty: 'easy'
  },
  {
    name: 'Simple Pasta Dinner',
    ingredients: [
      { name: 'Pasta', amount: 8, unit: 'oz' },
      { name: 'Olive Oil', amount: 2, unit: 'tbsp' },
      { name: 'Garlic', amount: 3, unit: 'cloves' },
      { name: 'Parmesan', amount: 0.5, unit: 'cup' }
    ],
    instructions: [
      'Boil pasta according to package directions',
      'Heat oil in pan and sauté minced garlic',
      'Toss cooked pasta with garlic oil',
      'Top with grated parmesan and serve'
    ],
    prepTime: 10,
    cookTime: 15,
    servings: 4,
    difficulty: 'easy'
  }
];

const generateSamplePlans = () => [
  {
    title: 'Weekly Grocery Shopping',
    description: 'Plan meals and create shopping list for the week',
    points: 25,
    frequency: 'weekly',
    category: 'planning'
  },
  {
    title: 'House Cleaning',
    description: 'Deep clean kitchen and bathrooms',
    points: 50,
    frequency: 'weekly',
    category: 'cleaning'
  },
  {
    title: 'Laundry Day',
    description: 'Wash, dry, and fold all household laundry',
    points: 30,
    frequency: 'weekly',
    category: 'household'
  }
];

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      throw new ServerError('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = SeedDataSchema.parse(body);
    const { sampleRecipes, samplePlans } = validatedData;

    // Get user's household
    const { data: user, error: userError } = await sb()
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (userError || !user?.household_id) {
      throw new ServerError('User not found or not in household', 400);
    }

    const householdId = user.household_id;
    let recipesAdded = 0;
    let plansAdded = 0;

    // Generate and seed sample recipes if requested
    if (sampleRecipes) {
      const sampleRecipesData = generateSampleRecipes();
      const recipesWithHousehold = sampleRecipesData.map(recipe => ({
        ...recipe,
        household_id: householdId,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: recipesError } = await sb()
        .from('recipes')
        .insert(recipesWithHousehold);

      if (recipesError) {
        console.error('Error seeding recipes:', recipesError);
        // Don't fail the entire request, just log the error
      } else {
        recipesAdded = sampleRecipesData.length;
      }
    }

    // Generate and seed sample planner items if requested
    if (samplePlans) {
      const samplePlansData = generateSamplePlans();
      const plansWithHousehold = samplePlansData.map(plan => ({
        ...plan,
        household_id: householdId,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: plansError } = await sb()
        .from('chores')
        .insert(plansWithHousehold);

      if (plansError) {
        console.error('Error seeding planner items:', plansError);
        // Don't fail the entire request, just log the error
      } else {
        plansAdded = samplePlansData.length;
      }
    }

    console.log(`✅ Seeded data for household: ${householdId} - Recipes: ${recipesAdded}, Plans: ${plansAdded}`);

    return NextResponse.json({
      success: true,
      message: 'Data seeded successfully',
      recipesAdded,
      plansAdded
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    console.error('Unexpected error:', error);
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
