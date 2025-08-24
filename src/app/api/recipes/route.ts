import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data to find household_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('clerk_id', userId)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'User not found or not in household' }, { status: 400 });
    }

    // Parse the request body
    const body = await request.json();
    const { name, description, prep_time, cook_time, servings, ingredients, instructions } = body;

    // Validate required fields
    if (!name || !ingredients || !instructions) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, ingredients, and instructions are required' 
      }, { status: 400 });
    }

    // Create the recipe
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        name,
        description: description || '',
        prep_time: prep_time || 0,
        cook_time: cook_time || 0,
        servings: servings || 1,
        ingredients: ingredients,
        instructions: instructions,
        household_id: userData.household_id,
        created_by: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (recipeError) {
      console.error('Error creating recipe:', recipeError);
      return NextResponse.json({ 
        error: 'Failed to create recipe',
        details: recipeError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      recipe,
      message: 'Recipe created successfully' 
    });

  } catch (error) {
    console.error('Error in recipe creation API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    // Get the authenticated user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data to find household_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('clerk_id', userId)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'User not found or not in household' }, { status: 400 });
    }

    // Get recipes for the household
    const { data: recipes, error: recipesError } = await supabase
      .from('recipes')
      .select('*')
      .eq('household_id', userData.household_id)
      .order('created_at', { ascending: false });

    if (recipesError) {
      console.error('Error fetching recipes:', recipesError);
      return NextResponse.json({ 
        error: 'Failed to fetch recipes',
        details: recipesError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      recipes: recipes || [] 
    });

  } catch (error) {
    console.error('Error in recipe fetch API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
