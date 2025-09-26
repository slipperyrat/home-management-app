import { NextResponse } from 'next/server'
import { getUserAndHousehold } from '@/lib/server/supabaseAdmin'
import { confirmAutoAddedItems } from '@/lib/server/confirmAutoAddedItems'
import { confirmAutoAddedSchema } from '@/lib/validation/schemas'

export async function POST(req: Request) {
  try {
    const { userId, householdId } = await getUserAndHousehold()
    
    // Parse and validate request body using Zod schema
    let validatedData;
    try {
      const body = await req.json();
      validatedData = confirmAutoAddedSchema.parse(body);
    } catch (validationError: any) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: validationError.errors 
      }, { status: 400 });
    }

    const { item_ids, action } = validatedData;
    if (!item_ids || item_ids.length === 0) {
      return NextResponse.json({ error: 'item_ids required' }, { status: 400 })
    }

    const result = await confirmAutoAddedItems(
      userId, 
      householdId, 
      item_ids,
      action
    )
    
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ 
      ok: true, 
      confirmed: result.confirmed, 
      removed: result.removed,
      message: result.message
    })
  } catch (e: any) {
    console.error('❌ Error in confirm-auto-added API:', e)
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}
