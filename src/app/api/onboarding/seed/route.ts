import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import type { Database } from '@/types/supabase.generated';

const SeedDataSchema = z.object({
  sampleRecipes: z.boolean().default(true),
  samplePlans: z.boolean().default(true),
});

type RecipeInsert = Database['public']['Tables']['recipes']['Insert'];
type ChoreInsert = Database['public']['Tables']['chores']['Insert'];

type SampleRecipe = {
  title: string;
  description: string;
  ingredients: Array<{ name: string; amount: number; unit: string }>;
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
};

const generateSampleRecipes = (): SampleRecipe[] => [
  {
    title: 'Quick Breakfast Bowl',
    description: 'A simple and nutritious breakfast bowl with oats and fruit.',
    ingredients: [
      { name: 'Oats', amount: 1, unit: 'cup' },
      { name: 'Banana', amount: 1, unit: 'piece' },
      { name: 'Honey', amount: 2, unit: 'tbsp' },
      { name: 'Almonds', amount: 0.25, unit: 'cup' },
    ],
    instructions: [
      'Cook oats with water according to package directions.',
      'Slice banana and add to bowl.',
      'Drizzle with honey and sprinkle almonds.',
      'Serve hot or cold.',
    ],
    prepTime: 5,
    cookTime: 10,
    servings: 1,
  },
  {
    title: 'Simple Pasta Dinner',
    description: 'Classic garlic and parmesan pasta that is ready in minutes.',
    ingredients: [
      { name: 'Pasta', amount: 8, unit: 'oz' },
      { name: 'Olive Oil', amount: 2, unit: 'tbsp' },
      { name: 'Garlic', amount: 3, unit: 'cloves' },
      { name: 'Parmesan', amount: 0.5, unit: 'cup' },
    ],
    instructions: [
      'Boil pasta according to package directions.',
      'Heat oil in pan and sauté minced garlic.',
      'Toss cooked pasta with garlic oil.',
      'Top with grated parmesan and serve.',
    ],
    prepTime: 10,
    cookTime: 15,
    servings: 4,
  },
];

const generateSamplePlans = (): Array<Partial<ChoreInsert>> => [
  {
    title: 'Weekly Grocery Shopping',
    description: 'Plan meals and create shopping list for the week.',
    points: 25,
    frequency: 'weekly',
    category: 'planning',
    status: 'pending',
  },
  {
    title: 'House Cleaning',
    description: 'Deep clean kitchen and bathrooms.',
    points: 50,
    frequency: 'weekly',
    category: 'cleaning',
    status: 'pending',
  },
  {
    title: 'Laundry Day',
    description: 'Wash, dry, and fold all household laundry.',
    points: 30,
    frequency: 'weekly',
    category: 'household',
    status: 'pending',
  },
];

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        throw new ServerError('Unauthorized', 401);
      }

      const body = await req.json();
      const validatedData = SeedDataSchema.parse(body);
      const { sampleRecipes, samplePlans } = validatedData;

      const { data: userData, error: userError } = await sb()
        .from('users')
        .select('household_id')
        .eq('id', user.id)
        .maybeSingle();

      if (userError || !userData?.household_id) {
        throw new ServerError('User not found or not in household', 400);
      }

      const householdId = userData.household_id;
      let recipesAdded = 0;
      let plansAdded = 0;

      if (sampleRecipes) {
        const now = new Date().toISOString();
        const recipesToInsert: RecipeInsert[] = generateSampleRecipes().map((recipe) => ({
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          prep_time: recipe.prepTime,
          cook_time: recipe.cookTime,
          servings: recipe.servings,
          household_id: householdId,
          created_by: user.id,
          created_at: now,
          updated_at: now,
          tags: ['sample'],
          image_url: null,
          difficulty: 'easy',
        }));

        const { error: recipesError } = await sb()
          .from('recipes')
          .insert(recipesToInsert);

        if (!recipesError) {
          recipesAdded = recipesToInsert.length;
        } else {
          console.error('Error seeding recipes:', recipesError);
        }
      }

      if (samplePlans) {
        const now = new Date().toISOString();
        const plansToInsert: ChoreInsert[] = generateSamplePlans().map((plan) => ({
          title: plan.title ?? 'Untitled task',
          description: plan.description ?? null,
          points: plan.points ?? 0,
          frequency: plan.frequency ?? null,
          category: plan.category ?? null,
          status: plan.status ?? 'pending',
          household_id: householdId,
          created_by: user.id,
          created_at: now,
          updated_at: now,
        }));

        const { error: plansError } = await sb()
          .from('chores')
          .insert(plansToInsert);

        if (!plansError) {
          plansAdded = plansToInsert.length;
        } else {
          console.error('Error seeding planner items:', plansError);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Data seeded successfully',
        recipesAdded,
        plansAdded,
      });
    } catch (error) {
      if (error instanceof ServerError) {
        return createErrorResponse(error);
      }
      console.error('Unexpected error:', error);
      return createErrorResponse(new ServerError('Internal server error', 500));
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}
