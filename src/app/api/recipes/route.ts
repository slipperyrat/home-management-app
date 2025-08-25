import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sb, getUserAndHousehold } from '@/lib/server/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    console.log('Recipe creation API called');
    
    // Get the authenticated user and household
    const { userId, householdId } = await getUserAndHousehold();
    console.log('User ID:', userId, 'Household ID:', householdId);
    
    if (!userId || !householdId) {
      return NextResponse.json({ error: 'Unauthorized or household not found' }, { status: 401 });
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

    // Parse ingredients from text to structured format
    const parsedIngredients = parseIngredients(ingredients);
    
    // Parse instructions from text to array
    const parsedInstructions = parseInstructions(instructions);

    const supabase = sb();

    // Create the recipe in the database
    const { data: recipe, error: insertError } = await supabase
      .from('recipes')
      .insert([{
        household_id: householdId,
        title: name, // Use 'title' as per database schema
        description: description || '',
        ingredients: parsedIngredients, // JSONB array
        instructions: parsedInstructions, // TEXT array
        prep_time: prep_time || 0,
        cook_time: cook_time || 0,
        servings: servings || 1,
        created_by: userId
      }])
      .select('*')
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json({ 
        error: 'Failed to save recipe to database',
        details: insertError.message
      }, { status: 500 });
    }

    console.log('Recipe created successfully:', recipe);

    return NextResponse.json({ 
      success: true, 
      recipe: {
        id: recipe.id,
        name: recipe.title, // Map back to 'name' for frontend compatibility
        description: recipe.description,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        created_at: recipe.created_at,
        household_id: recipe.household_id,
        created_by: recipe.created_by,
        updated_at: recipe.updated_at,
        image_url: recipe.image_url,
        tags: recipe.tags || [],
        is_favorite: false, // Default value
        difficulty: 'medium' // Default value
      }
    });

  } catch (error) {
    console.error('Error in recipe creation API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('Recipe fetch API called');
    
    // Get the authenticated user and household
    const { userId, householdId } = await getUserAndHousehold();
    console.log('User ID for GET:', userId, 'Household ID:', householdId);
    
    if (!userId || !householdId) {
      return NextResponse.json({ error: 'Unauthorized or household not found' }, { status: 401 });
    }

    const supabase = sb();

    // Fetch recipes for the household
    const { data: recipes, error: fetchError } = await supabase
      .from('recipes')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Database fetch error:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch recipes from database',
        details: fetchError.message
      }, { status: 500 });
    }

    console.log(`Found ${recipes?.length || 0} recipes for household`);

    // Transform recipes to match frontend expectations
    const transformedRecipes = (recipes || []).map(recipe => ({
      id: recipe.id,
      name: recipe.title, // Map 'title' to 'name' for frontend compatibility
      description: recipe.description,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      created_at: recipe.created_at,
      household_id: recipe.household_id,
      created_by: recipe.created_by,
      updated_at: recipe.updated_at,
      image_url: recipe.image_url,
      tags: recipe.tags || [],
      is_favorite: false, // Default value
      difficulty: 'medium' // Default value
    }));
    
    return NextResponse.json({ 
      success: true, 
      recipes: transformedRecipes
    });

  } catch (error) {
    console.error('Error in recipe fetch API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to parse ingredients text into structured format
function parseIngredients(ingredientsText: string): any[] {
  if (!ingredientsText) return [];
  
  // Split by newlines or commas and clean up
  const lines = ingredientsText.split(/[\n,]+/).map(line => line.trim()).filter(Boolean);
  
  return lines.map((line, index) => {
    // Try to parse quantity and unit from the line
    const match = line.match(/^(\d+(?:\.\d+)?)?\s*([a-zA-Z]+)?\s*(.+)$/);
    
    if (match) {
      const [, amount, unit, name] = match;
      return {
        id: `temp-${index}`,
        recipe_id: '', // Will be set by database
        name: name.trim(),
        amount: amount ? parseFloat(amount) : 1,
        unit: unit ? unit.trim() : '',
        notes: ''
      };
    }
    
    // If no quantity/unit pattern, treat as just a name
    return {
      id: `temp-${index}`,
      recipe_id: '', // Will be set by database
      name: line,
      amount: 1,
      unit: '',
      notes: ''
    };
  });
}

// Helper function to parse instructions text into array
function parseInstructions(instructionsText: string): string[] {
  if (!instructionsText) return [];
  
  // Split by newlines and clean up
  return instructionsText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      // Remove step numbers if they exist (e.g., "1. ", "Step 1: ")
      const cleaned = line.replace(/^(\d+\.?\s*|Step\s*\d+:\s*)/i, '').trim();
      return cleaned || line; // If cleaning results in empty string, use original
    });
}
