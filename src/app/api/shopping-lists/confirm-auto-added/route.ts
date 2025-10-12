import { NextResponse } from 'next/server';
import { getUserAndHousehold } from '@/lib/server/supabaseAdmin';
import { confirmAutoAddedItems } from '@/lib/server/confirmAutoAddedItems';
import { confirmAutoAddedSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const { userId, householdId } = await getUserAndHousehold()
    
    // Parse and validate request body using Zod schema
    let validatedData: z.infer<typeof confirmAutoAddedSchema>;
    try {
      const body = await req.json();
      validatedData = confirmAutoAddedSchema.parse(body);
    } catch (validationError: unknown) {
      if (validationError instanceof z.ZodError) {
        logger.warn('Invalid confirm-auto-added payload', {
          userId,
          errors: validationError.errors,
        });
        return NextResponse.json({
          error: 'Invalid input',
          details: validationError.errors,
        }, { status: 400 });
      }
      logger.error('confirm-auto-added validation error', validationError instanceof Error ? validationError : new Error(String(validationError)), {
        userId,
      });
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { item_ids, action } = validatedData;
    if (!item_ids || item_ids.length === 0) {
      return NextResponse.json({ error: 'item_ids required' }, { status: 400 });
    }

    const result = await confirmAutoAddedItems(
      userId, 
      householdId, 
      item_ids,
      action
    );
    
    if (!result.ok) {
      logger.error('confirmAutoAddedItems failed', new Error(result.error ?? 'Unknown error'), {
        userId,
        householdId,
        itemIds: item_ids,
        action,
      });
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      confirmed: result.confirmed, 
      removed: result.removed,
      message: result.message
    });
  } catch (error) {
    logger.error('Error in confirm-auto-added API', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/shopping-lists/confirm-auto-added',
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: error instanceof Error && 'status' in error ? Number((error as { status?: number }).status) || 500 : 500 });
  }
}
