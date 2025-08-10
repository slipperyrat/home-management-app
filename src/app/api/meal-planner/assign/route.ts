import { NextResponse } from 'next/server'
import { sb, getUserAndHousehold } from '@/lib/server/supabaseAdmin'
import { addRecipeIngredientsToGroceries } from '@/lib/server/addRecipeIngredients'
import { AssignMealSchema, validateRequest, createValidationErrorResponse } from '@/lib/validation'
import { sanitizeDeep, sanitizeText } from '@/lib/security/sanitize'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const SLOTS = ['breakfast','lunch','dinner']

export async function POST(req: Request) {
  try {
    const { userId, householdId } = await getUserAndHousehold()
    const body = await req.json()

    // Validate request body with Zod
    const validation = validateRequest(AssignMealSchema, body);
    if (!validation.success) {
      return createValidationErrorResponse(validation.error);
    }

    const { week, day, slot, recipe_id, alsoAddToList } = validation.data;

    // NOTE: When adding notes/comments to meal slots in the future, sanitize them here:
    // const clean = sanitizeDeep(body, { notes: 'rich' });
    // const notes = clean.notes || null;

    const supabase = sb()

    // fetch or create the meal_plan row
    const { data: existing, error: selErr } = await supabase
      .from('meal_plans').select('*')
      .eq('household_id', householdId).eq('week_start_date', week).maybeSingle()
    if (selErr) throw selErr

    const meals = existing?.meals ?? {}
    meals[day] = meals[day] || { breakfast: null, lunch: null, dinner: null }
    meals[day][slot] = recipe_id ?? null

    // upsert the plan
    const { data: plan, error: upErr } = await supabase
      .from('meal_plans')
      .upsert([{ household_id: householdId, week_start_date: week, meals }], { onConflict: 'household_id,week_start_date' })
      .select('*').single()
    if (upErr) throw upErr

    // optionally add ingredients to grocery list
    let ingredientResult = null
    if (alsoAddToList && recipe_id) {
      ingredientResult = await addRecipeIngredientsToGroceries(userId, householdId, recipe_id)
      if (!ingredientResult.ok) {
        return NextResponse.json({ warning: 'assigned but failed to add ingredients', plan, error: ingredientResult.error }, { status: 207 })
      }
    }

    return NextResponse.json({ 
      plan, 
      ingredients: ingredientResult ? {
        added: ingredientResult.added,
        updated: ingredientResult.updated
      } : null
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}
