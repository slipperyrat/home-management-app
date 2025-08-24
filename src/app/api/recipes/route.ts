import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('Recipe creation API called');
    
    // Get the authenticated user
    const { userId } = await auth();
    console.log('User ID:', userId);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body
    const body = await request.json();
    console.log('Request body:', body);
    
    const { name, description, prep_time, cook_time, servings, ingredients, instructions } = body;

    // Validate required fields
    if (!name || !ingredients || !instructions) {
      console.log('Validation failed - missing fields');
      return NextResponse.json({ 
        error: 'Missing required fields: name, ingredients, and instructions are required',
        received: { name, ingredients, instructions }
      }, { status: 400 });
    }

    // For now, just return success without database insertion
    // This will help us test if the API endpoint is working
    const mockRecipe = {
      id: 'temp-' + Date.now(),
      name,
      description: description || '',
      prep_time: prep_time || 0,
      cook_time: cook_time || 0,
      servings: servings || 1,
      ingredients,
      instructions,
      created_at: new Date().toISOString()
    };

    console.log('Recipe created successfully:', mockRecipe);

    return NextResponse.json({ 
      success: true, 
      recipe: mockRecipe,
      message: 'Recipe created successfully (test mode)' 
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
