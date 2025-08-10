import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';

const SeedDataSchema = z.object({
  chores: z.array(z.object({
    title: z.string().min(1).max(100),
    description: z.string().optional(),
    points: z.number().min(1).max(100),
    frequency: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
    category: z.string().default('general'),
  })),
  recipes: z.array(z.object({
    name: z.string().min(1).max(100),
    ingredients: z.array(z.object({
      name: z.string().min(1).max(100),
      amount: z.number().min(0.1),
      unit: z.string().min(1).max(20),
    })),
    instructions: z.array(z.string().min(1)),
    prepTime: z.number().min(1),
    cookTime: z.number().min(0),
    servings: z.number().min(1),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  })),
  rewards: z.array(z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    pointsCost: z.number().min(1).max(1000),
    category: z.string().default('general'),
  })),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      throw new ServerError('Unauthorized', 401);
    }

    const body = await request.json();
    const validatedData = SeedDataSchema.parse(body);
    const { chores, recipes, rewards } = validatedData;

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

    // Seed chores
    if (chores.length > 0) {
      const choresWithHousehold = chores.map(chore => ({
        ...chore,
        household_id: householdId,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: choresError } = await sb()
        .from('chores')
        .insert(choresWithHousehold);

      if (choresError) {
        console.error('Error seeding chores:', choresError);
        throw new ServerError('Failed to seed chores', 500);
      }
    }

    // Seed recipes
    if (recipes.length > 0) {
      const recipesWithHousehold = recipes.map(recipe => ({
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
        throw new ServerError('Failed to seed recipes', 500);
      }
    }

    // Seed rewards
    if (rewards.length > 0) {
      const rewardsWithHousehold = rewards.map(reward => ({
        ...reward,
        household_id: householdId,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: rewardsError } = await sb()
        .from('rewards')
        .insert(rewardsWithHousehold);

      if (rewardsError) {
        console.error('Error seeding rewards:', rewardsError);
        throw new ServerError('Failed to seed rewards', 500);
      }
    }

    console.log(`✅ Seeded data for household: ${householdId}`);

    return NextResponse.json({
      success: true,
      message: 'Data seeded successfully',
      summary: {
        chores: chores.length,
        recipes: recipes.length,
        rewards: rewards.length,
      }
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    console.error('Unexpected error:', error);
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
