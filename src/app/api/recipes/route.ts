import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

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
    console.log('Recipe fetch API called');
    
    // Get the authenticated user
    const { userId } = await auth();
    console.log('User ID for GET:', userId);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, return empty recipes array to prevent 400 errors
    // This will allow the app to function while we debug the database issue
    console.log('Returning empty recipes array');
    
    return NextResponse.json({ 
      success: true, 
      recipes: [] 
    });

  } catch (error) {
    console.error('Error in recipe fetch API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
