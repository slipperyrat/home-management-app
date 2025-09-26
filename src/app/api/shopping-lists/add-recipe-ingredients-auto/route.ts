import { NextResponse } from 'next/server'
import { getUserAndHousehold } from '@/lib/server/supabaseAdmin'
import { addRecipeIngredientsToGroceriesAuto } from '@/lib/server/addRecipeIngredientsAuto'
import { addRecipeIngredientsAutoSchema } from '@/lib/validation/schemas'

export async function POST(req: Request) {
  try {
    const { userId, householdId } = await getUserAndHousehold()
    
    // Parse and validate request body using Zod schema
    let validatedData;
    try {
      const body = await req.json();
      // Create a temporary schema that doesn't require household_id since it comes from user context
      const tempSchema = addRecipeIngredientsAutoSchema.omit({ household_id: true });
      validatedData = tempSchema.parse(body);
    } catch (validationError: any) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: validationError.errors 
      }, { status: 400 });
    }

    const { recipe_id, auto_confirm, source_meal_plan } = validatedData;
    if (!recipe_id) return NextResponse.json({ error: 'recipe_id required' }, { status: 400 })

    const result = await addRecipeIngredientsToGroceriesAuto(
      userId, 
      householdId, 
      recipe_id,
      auto_confirm || false,
      source_meal_plan
    )
    
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ 
      ok: true, 
      added: result.added, 
      updated: result.updated, 
      autoAdded: result.autoAdded,
      pendingConfirmations: result.pendingConfirmations,
      list_id: result.listId 
    })
  } catch (e: any) {
    console.error('❌ Error in add-recipe-ingredients-auto API:', e)
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}
