import { NextResponse } from 'next/server'
import { getUserAndHousehold } from '@/lib/server/supabaseAdmin'
import { addRecipeIngredientsToGroceries } from '@/lib/server/addRecipeIngredients'

export async function POST(req: Request) {
  try {
    const { userId, householdId } = await getUserAndHousehold()
    const { recipe_id } = await req.json()
    if (!recipe_id) return NextResponse.json({ error: 'recipe_id required' }, { status: 400 })

    const result = await addRecipeIngredientsToGroceries(userId, householdId, recipe_id)
    
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ 
      ok: true, 
      added: result.added, 
      updated: result.updated, 
      list_id: result.listId 
    })
  } catch (e: any) {
    console.error('❌ Error in add-recipe-ingredients API:', e)
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}